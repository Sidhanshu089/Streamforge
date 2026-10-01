"""Read-only Kafka-backed API for the StreamForge dashboard."""

from __future__ import annotations

import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any
from urllib.request import urlopen

from confluent_kafka.admin import AdminClient, OffsetSpec
from confluent_kafka import Consumer, TopicPartition
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from prometheus_client.parser import text_string_to_metric_families

BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
TOPICS = tuple(dict.fromkeys(
    name.strip()
    for name in os.getenv(
        "KAFKA_INPUT_TOPICS",
        os.getenv("KAFKA_INPUT_TOPIC", os.getenv("KAFKA_TOPIC", "truck-telemetry")),
    ).split(",")
    if name.strip()
))
TOPIC = TOPICS[0] if TOPICS else "truck-telemetry"
PROCESSOR_GROUP = os.getenv("KAFKA_PROCESSOR_GROUP", "streamforge-temperature-processor")
PROCESSOR_METRICS_URL = os.getenv("STREAMFORGE_PROCESSOR_METRICS_URL", "http://127.0.0.1:9101/metrics")
PROCESSOR_METRICS_URLS = [
    url.strip() for url in os.getenv(
        "STREAMFORGE_PROCESSOR_METRICS_URLS",
        ",".join(f"http://127.0.0.1:{port}/metrics" for port in range(9101, 9121)),
    ).split(",") if url.strip()
]
_previous: tuple[float, int, float | None] | None = None
_previous_worker_counters: dict[str, tuple[float, float]] = {}

app = FastAPI(title="StreamForge API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("UI_ORIGINS", "http://localhost:3000").split(","),
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _cluster_snapshot() -> dict[str, Any]:
    global _previous
    try:
        admin = AdminClient({"bootstrap.servers": BOOTSTRAP_SERVERS})
        if not TOPICS:
            raise RuntimeError("No Kafka input topics are configured")
        metadata = admin.list_topics(timeout=5)
        topic_metadata = {}
        for topic_name in TOPICS:
            topic_meta = metadata.topics.get(topic_name)
            if topic_meta is None or topic_meta.error:
                raise RuntimeError(f"Kafka topic '{topic_name}' is unavailable")
            topic_metadata[topic_name] = topic_meta

        topic_partitions = [
            TopicPartition(topic_name, partition_id)
            for topic_name, topic_meta in topic_metadata.items()
            for partition_id in topic_meta.partitions
        ]
        watermark_futures = admin.list_offsets({
            tp: OffsetSpec.latest() for tp in topic_partitions
        })
        watermarks = {
            (topic_partition.topic, topic_partition.partition): future.result(timeout=5).offset
            for topic_partition, future in watermark_futures.items()
        }
        total_end_offset = sum(max(0, offset) for offset in watermarks.values())
        partitions = []
        # Every processor publishes its own metrics endpoint. Scrape the local
        # worker port range concurrently so local RocksDB health is real data.
        metrics: dict[str, float] = {}
        worker_resources: dict[str, dict[str, float]] = {}
        def scrape(url: str) -> tuple[dict[str, float], dict[str, dict[str, float]]]:
            # Avoid dropping worker counters during load because of a very short scrape timeout.
            with urlopen(url, timeout=2.0) as response:
                exposition = response.read().decode("utf-8")
            worker_metrics: dict[str, float] = {}
            resources: dict[str, dict[str, float]] = {}
            for family in text_string_to_metric_families(exposition):
                for sample in family.samples:
                    if sample.name in (
                        "streamforge_worker_cpu_percent",
                        "streamforge_worker_memory_percent",
                        "streamforge_worker_events_processed_total",
                    ):
                        worker_id = sample.labels.get("worker_id")
                        if worker_id:
                            metric = {
                                "streamforge_worker_cpu_percent": "cpu",
                                "streamforge_worker_memory_percent": "memory",
                                "streamforge_worker_events_processed_total": "events_total",
                            }[sample.name]
                            resources.setdefault(worker_id, {})[metric] = float(sample.value)
                    else:
                        worker_metrics[sample.name] = float(sample.value)
            return worker_metrics, resources

        with ThreadPoolExecutor(max_workers=min(20, len(PROCESSOR_METRICS_URLS))) as pool:
            futures = [pool.submit(scrape, url) for url in PROCESSOR_METRICS_URLS]
            for future in as_completed(futures):
                try:
                    worker_metrics, resources = future.result()
                except Exception:
                    continue
                worker_resources.update(resources)
                for name, value in worker_metrics.items():
                    if name.endswith("_total") or name == "streamforge_state_store_up":
                        metrics[name] = metrics.get(name, 0) + value
                    else:
                        metrics[name] = max(metrics.get(name, value), value)
        now_for_worker_rate = time.monotonic()

        workers: list[dict[str, Any]] = []
        partition_worker: dict[tuple[str, int], str] = {}
        consumer_lag: int | None = None
        lag_by_partition: dict[tuple[str, int], int] = {}
        try:
            descriptions = admin.describe_consumer_groups([PROCESSOR_GROUP])
            group = descriptions[PROCESSOR_GROUP].result(timeout=5)
            for index, member in enumerate(group.members, start=1):
                worker_id = member.member_id or f"processor-{index}"
                worker_instance_id = (member.client_id or "").removeprefix("streamforge-")
                worker_sample = worker_resources.get(worker_instance_id, {})
                events_total = worker_sample.get("events_total")
                events_rate = None
                if events_total is not None:
                    previous_worker = _previous_worker_counters.get(worker_instance_id)
                    if previous_worker is not None:
                        previous_time, previous_total = previous_worker
                        elapsed = now_for_worker_rate - previous_time
                        if elapsed > 0:
                            events_rate = max(0, events_total - previous_total) / elapsed
                    _previous_worker_counters[worker_instance_id] = (now_for_worker_rate, events_total)
                workers.append({
                    "id": worker_id,
                    "name": member.client_id or f"Processor {index}",
                    "status": "healthy",
                    "eventsPerSecond": events_rate,
                    "lag": 0,
                    "cpu": worker_sample.get("cpu"),
                    "memory": worker_sample.get("memory"),
                    "partitions": [],
                })
                assignment = getattr(member, "assignment", None)
                for assigned in getattr(assignment, "topic_partitions", []) or []:
                    if assigned.topic in topic_metadata:
                        partition_worker[(assigned.topic, assigned.partition)] = worker_id
                        workers[-1]["partitions"].append(f"{assigned.topic}:{assigned.partition}")

            offset_reader = Consumer({
                "bootstrap.servers": BOOTSTRAP_SERVERS,
                "group.id": PROCESSOR_GROUP,
                "enable.auto.commit": False,
            })
            try:
                committed = offset_reader.committed(
                    topic_partitions,
                    timeout=5,
                )
            finally:
                offset_reader.close()
            for item in committed:
                key = (item.topic, item.partition)
                if key in watermarks and item.offset >= 0:
                    lag_by_partition[key] = max(
                        0, watermarks.get(key, item.offset) - item.offset
                    )
            consumer_lag = sum(lag_by_partition.values()) if committed else None
            by_id = {worker["id"]: worker for worker in workers}
            for partition_key, worker_id in partition_worker.items():
                if worker_id in by_id:
                    by_id[worker_id]["lag"] += lag_by_partition.get(partition_key, 0)
        except Exception:
            workers = []
            partition_worker = {}
            lag_by_partition = {}

        healthy_state_stores = int(metrics.get("streamforge_state_store_up", 0))
        state_store_healthy = bool(workers) and healthy_state_stores >= len(workers)

        for topic_name, topic_meta in topic_metadata.items():
            for partition_id, partition in sorted(topic_meta.partitions.items()):
                partition_key = (topic_name, partition_id)
                partitions.append({
                    "id": f"{topic_name}:{partition_id}",
                    "partitionId": partition_id,
                    "topic": topic_name,
                    "name": f"{topic_name} / Partition {partition_id}",
                    "status": "active" if partition.leader >= 0 else "inactive",
                    "leader": partition.leader if partition.leader >= 0 else None,
                    "replicas": partition.replicas,
                    "inSyncReplicas": partition.isrs,
                    "workerId": partition_worker.get(partition_key),
                    "lag": lag_by_partition.get(partition_key),
                })

        now = time.monotonic()
        rate = None
        processed_events = metrics.get("streamforge_events_processed_total")
        if _previous is not None:
            previous_time, previous_offset, previous_processed = _previous
            elapsed = now - previous_time
            if elapsed > 0:
                if processed_events is not None and previous_processed is not None:
                    rate = max(0, processed_events - previous_processed) / elapsed
                else:
                    rate = max(0, total_end_offset - previous_offset) / elapsed
        _previous = (now, total_end_offset, processed_events)
        return {
            "connected": True,
            "brokerCount": len(metadata.brokers),
            "topic": TOPIC if len(TOPICS) == 1 else f"{len(TOPICS)} input topics",
            "topics": list(TOPICS),
            "partitions": partitions,
            "eventsPerSecond": rate,
            "consumerLag": consumer_lag,
            "workers": workers,
            "processingLatency": metrics.get("streamforge_last_processing_duration_seconds"),
            "processedEvents": processed_events or 0,
            "filteredEvents": metrics.get("streamforge_events_filtered_total", 0),
            "processingErrors": metrics.get("streamforge_processing_errors_total", 0),
            "rateSource": "processor" if processed_events is not None else "broker",
            "processorUp": metrics.get("streamforge_processor_up", 0) > 0,
            "stateStore": {
                "healthy": state_store_healthy,
                "healthyInstances": min(healthy_state_stores, len(workers)),
                "workerCount": len(workers),
            },
            "updatedAt": time.time(),
        }
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Kafka unavailable: {exc}") from exc


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/cluster")
def cluster() -> dict[str, Any]:
    return _cluster_snapshot()


@app.get("/metrics", response_class=PlainTextResponse)
def metrics() -> str:
    """Expose the processor's Prometheus-format metrics through the API port."""
    try:
        with urlopen(PROCESSOR_METRICS_URL, timeout=2) as response:
            return response.read().decode("utf-8")
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Processor metrics unavailable: {exc}") from exc
