"""Transactional Kafka processor for truck temperature events.

Kafka output, state changelog, and source offsets commit atomically. RocksDB
is updated only after that transaction commits and rebuilt from the changelog
when the process starts.
"""

from __future__ import annotations

import argparse
import ctypes
import json
import logging
import os
import platform
import signal
import socket
import threading
import time
from uuid import uuid4
from datetime import datetime, timezone
from typing import Any

try:
    import resource
except ImportError:  # Windows uses the native process APIs below.
    resource = None

from confluent_kafka import Consumer, KafkaError, Producer, TopicPartition
from prometheus_client import Counter, Gauge, start_http_server

from faust.state_store import TruckState, state_key, window_start

DEFAULT_INPUT_TOPICS = os.getenv(
    "KAFKA_INPUT_TOPICS", os.getenv("KAFKA_INPUT_TOPIC", "truck-telemetry")
)
INPUT_TOPICS = [name.strip() for name in DEFAULT_INPUT_TOPICS.split(",") if name.strip()]
INPUT_TOPIC = INPUT_TOPICS[0] if INPUT_TOPICS else os.getenv("KAFKA_INPUT_TOPIC", "truck-telemetry")
OUTPUT_TOPIC = os.getenv("KAFKA_OUTPUT_TOPIC", "truck-temperature-averages")
CHANGELOG_TOPIC = os.getenv("KAFKA_CHANGELOG_TOPIC", "truck-temperature-averages-changelog")
GROUP_ID = os.getenv("KAFKA_PROCESSOR_GROUP", "streamforge-temperature-processor")
LOG = logging.getLogger("streamforge.processor")

EVENTS = Counter("streamforge_events_processed_total", "Valid source events processed")
FILTERED = Counter("streamforge_events_filtered_total", "Events excluded by temperature filter")
ERRORS = Counter("streamforge_processing_errors_total", "Malformed events skipped")
PROCESSING_SECONDS = Gauge("streamforge_last_processing_duration_seconds", "Latest processing time")
PROCESSOR_UP = Gauge("streamforge_processor_up", "Whether this processor is running")
STATE_STORE_UP = Gauge("streamforge_state_store_up", "Whether this processor's RocksDB state store is open")
WORKER_CPU_PERCENT = Gauge("streamforge_worker_cpu_percent", "Worker process CPU use as a percentage of total host CPU", ["worker_id"])
WORKER_MEMORY_PERCENT = Gauge("streamforge_worker_memory_percent", "Worker process resident memory as a percentage of host memory", ["worker_id"])
WORKER_EVENTS_PROCESSED = Counter("streamforge_worker_events_processed_total", "Valid source events committed by this worker", ["worker_id"])


def _cpu_time_seconds() -> float:
    if platform.system() == "Windows":
        class FileTime(ctypes.Structure):
            _fields_ = [("low", ctypes.c_uint32), ("high", ctypes.c_uint32)]

        creation, exit_time, kernel, user = (FileTime() for _ in range(4))
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.GetCurrentProcess.restype = ctypes.c_void_p
        kernel32.GetProcessTimes.argtypes = [
            ctypes.c_void_p, ctypes.POINTER(FileTime), ctypes.POINTER(FileTime),
            ctypes.POINTER(FileTime), ctypes.POINTER(FileTime),
        ]
        kernel32.GetProcessTimes.restype = ctypes.c_int
        process = kernel32.GetCurrentProcess()
        ok = kernel32.GetProcessTimes(
            process, ctypes.byref(creation), ctypes.byref(exit_time),
            ctypes.byref(kernel), ctypes.byref(user),
        )
        if not ok:
            raise OSError("GetProcessTimes failed")
        return sum((part.high << 32) | part.low for part in (kernel, user)) / 10_000_000

    usage = resource.getrusage(resource.RUSAGE_SELF)
    return usage.ru_utime + usage.ru_stime


def _memory_percent() -> float:
    if platform.system() == "Windows":
        class MemoryCounters(ctypes.Structure):
            _fields_ = [
                ("cb", ctypes.c_uint32), ("PageFaultCount", ctypes.c_uint32),
                ("PeakWorkingSetSize", ctypes.c_size_t), ("WorkingSetSize", ctypes.c_size_t),
                ("QuotaPeakPagedPoolUsage", ctypes.c_size_t), ("QuotaPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t), ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                ("PagefileUsage", ctypes.c_size_t), ("PeakPagefileUsage", ctypes.c_size_t),
                ("PrivateUsage", ctypes.c_size_t),
            ]

        class MemoryStatus(ctypes.Structure):
            _fields_ = [
                ("dwLength", ctypes.c_uint32), ("dwMemoryLoad", ctypes.c_uint32),
                ("ullTotalPhys", ctypes.c_uint64), ("ullAvailPhys", ctypes.c_uint64),
                ("ullTotalPageFile", ctypes.c_uint64), ("ullAvailPageFile", ctypes.c_uint64),
                ("ullTotalVirtual", ctypes.c_uint64), ("ullAvailVirtual", ctypes.c_uint64),
                ("ullAvailExtendedVirtual", ctypes.c_uint64),
            ]

        counters = MemoryCounters()
        counters.cb = ctypes.sizeof(counters)
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        psapi = ctypes.WinDLL("psapi", use_last_error=True)
        kernel32.GetCurrentProcess.restype = ctypes.c_void_p
        psapi.GetProcessMemoryInfo.argtypes = [ctypes.c_void_p, ctypes.POINTER(MemoryCounters), ctypes.c_uint32]
        psapi.GetProcessMemoryInfo.restype = ctypes.c_int
        process = kernel32.GetCurrentProcess()
        if not psapi.GetProcessMemoryInfo(process, ctypes.byref(counters), counters.cb):
            raise OSError("GetProcessMemoryInfo failed")
        status = MemoryStatus()
        status.dwLength = ctypes.sizeof(status)
        kernel32.GlobalMemoryStatusEx.argtypes = [ctypes.POINTER(MemoryStatus)]
        kernel32.GlobalMemoryStatusEx.restype = ctypes.c_int
        if not kernel32.GlobalMemoryStatusEx(ctypes.byref(status)) or not status.ullTotalPhys:
            raise OSError("GlobalMemoryStatusEx failed")
        return counters.WorkingSetSize * 100 / status.ullTotalPhys

    try:
        with open("/proc/self/statm", encoding="ascii") as statm:
            resident_pages = int(statm.read().split()[1])
        with open("/proc/meminfo", encoding="ascii") as meminfo:
            total_kb = int(next(line.split()[1] for line in meminfo if line.startswith("MemTotal:")))
        return resident_pages * os.sysconf("SC_PAGE_SIZE") * 100 / (total_kb * 1024)
    except (OSError, ValueError, StopIteration, IndexError):
        usage = resource.getrusage(resource.RUSAGE_SELF)
        resident_bytes = usage.ru_maxrss * (1024 if platform.system() != "Darwin" else 1)
        total_bytes = os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES")
        return resident_bytes * 100 / total_bytes


def _resource_monitor(worker_id: str, stop_event: threading.Event) -> None:
    """Publish process CPU and RSS-based memory usage for this worker."""
    logical_cpus = max(1, os.cpu_count() or 1)
    previous_cpu = _cpu_time_seconds()
    previous_at = time.monotonic()
    while not stop_event.wait(2.0):
        try:
            now = time.monotonic()
            cpu = _cpu_time_seconds()
            WORKER_CPU_PERCENT.labels(worker_id).set(max(0, cpu - previous_cpu) * 100 / max(now - previous_at, 0.001) / logical_cpus)
            WORKER_MEMORY_PERCENT.labels(worker_id).set(_memory_percent())
            previous_cpu, previous_at = cpu, now
        except (OSError, AttributeError, ValueError):
            return


def _restore_state(bootstrap_servers: str, topic: str, state: TruckState) -> int:
    """Replay the committed changelog up to the startup watermarks."""
    consumer = Consumer({
        "bootstrap.servers": bootstrap_servers,
        "group.id": f"{GROUP_ID}-restore-{os.getpid()}",
        "enable.auto.commit": False,
        "isolation.level": "read_committed",
        "enable.partition.eof": True,
    })
    metadata = consumer.list_topics(topic=topic, timeout=10)
    topic_metadata = metadata.topics.get(topic)
    if topic_metadata is None or topic_metadata.error:
        consumer.close()
        raise RuntimeError(f"Changelog topic '{topic}' is unavailable")

    partitions: list[TopicPartition] = []
    targets: dict[int, int] = {}
    for partition_id in topic_metadata.partitions:
        low, high = consumer.get_watermark_offsets(TopicPartition(topic, partition_id), timeout=10)
        targets[partition_id] = high
        if low < high:
            partitions.append(TopicPartition(topic, partition_id, low))

    if not partitions:
        consumer.close()
        return 0

    consumer.assign(partitions)
    restored = 0
    completed: set[int] = {p for p, high in targets.items() if high == 0}
    try:
        while len(completed) < len(targets):
            message = consumer.poll(0.5)
            if message is not None and not message.error():
                try:
                    value = json.loads(message.value())
                    state.restore(value)
                    restored += 1
                except (ValueError, KeyError, TypeError):
                    LOG.exception("Skipping invalid changelog record at %s[%s]@%s", topic, message.partition(), message.offset())

            for position in consumer.position(partitions):
                if position.offset >= targets[position.partition]:
                    completed.add(position.partition)
    finally:
        consumer.close()
    state.flush()
    return restored


def _decode_event(raw: bytes | None) -> dict[str, Any]:
    event = json.loads(raw or b"")
    if not isinstance(event, dict):
        raise ValueError("event must be a JSON object")
    required = {"event_id", "truck_id", "temperature", "timestamp"}
    missing = required - event.keys()
    if missing:
        raise ValueError(f"missing fields: {', '.join(sorted(missing))}")
    event["truck_id"] = str(event["truck_id"])
    event["temperature"] = float(event["temperature"])
    parsed = datetime.fromisoformat(str(event["timestamp"]).replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("timestamp must include a timezone")
    return event


def run_processor(
    *,
    bootstrap_servers: str = "localhost:9092",
    input_topic: str = INPUT_TOPIC,
    input_topics: list[str] | None = None,
    output_topic: str = OUTPUT_TOPIC,
    changelog_topic: str = CHANGELOG_TOPIC,
    state_path: str = "./rocksdb/state",
    metrics_port: int = 9101,
    stop_after: int | None = None,
    batch_size: int = 128,
) -> int:
    """Consume, aggregate, and transactionally publish records until stopped."""
    # Each consumer process needs its own RocksDB directory. Kafka's committed
    # changelog is the source of truth when a worker starts or gains partitions.
    if state_path == "./rocksdb/state":
        state_path = f"./rocksdb/state-{os.getpid()}"
    subscribed_topics = list(dict.fromkeys(input_topics or [input_topic]))
    if not subscribed_topics or any(not name.strip() for name in subscribed_topics):
        raise ValueError("At least one non-empty input topic is required")
    if batch_size < 1:
        raise ValueError("batch_size must be at least 1")
    if metrics_port:
        start_http_server(metrics_port)
    state = TruckState(state_path)
    STATE_STORE_UP.set(1)
    worker_id = f"{socket.gethostname()}-{os.getpid()}"
    worker_events_processed = WORKER_EVENTS_PROCESSED.labels(worker_id)
    resource_monitor_stop = threading.Event()
    resource_monitor = threading.Thread(
        target=_resource_monitor,
        args=(worker_id, resource_monitor_stop),
        name="resource-monitor",
        daemon=True,
    )
    resource_monitor.start()
    restored = _restore_state(bootstrap_servers, changelog_topic, state)
    LOG.info("Restored %d changelog snapshots from %s", restored, changelog_topic)

    consumer = Consumer({
        "bootstrap.servers": bootstrap_servers,
        "group.id": GROUP_ID,
        "client.id": f"streamforge-{worker_id}",
        "enable.auto.commit": False,
        "auto.offset.reset": "earliest",
        "isolation.level": "read_committed",
        "max.poll.interval.ms": 300000,
    })
    # Kafka transactional IDs are cluster-wide unique. Treat the configured
    # value as a prefix so multiple local processes cannot fence one another.
    transactional_prefix = os.getenv("KAFKA_TRANSACTIONAL_ID", "streamforge-processor")
    transactional_id = f"{transactional_prefix}-{os.getenv('HOSTNAME', 'local')}-{os.getpid()}-{uuid4().hex[:8]}"
    producer = Producer({
        "bootstrap.servers": bootstrap_servers,
        "transactional.id": transactional_id,
        "enable.idempotence": True,
        "acks": "all",
        "compression.type": "lz4",
    })
    producer.init_transactions(30)

    def on_assign(assigned_consumer: Consumer, partitions: list[TopicPartition]) -> None:
        # A consumer can receive partitions it did not own before a rebalance.
        # Restore the latest committed state before allowing it to process them.
        restored_count = _restore_state(bootstrap_servers, changelog_topic, state)
        LOG.info("Restored %d changelog snapshots before assigning %d input partitions", restored_count, len(partitions))
        assigned_consumer.assign(partitions)

    consumer.subscribe(subscribed_topics, on_assign=on_assign)
    PROCESSOR_UP.set(1)
    processed = 0
    running = True

    def stop(_signum: int, _frame: Any) -> None:
        nonlocal running
        running = False

    previous_sigterm = signal.signal(signal.SIGTERM, stop)
    previous_sigint = signal.signal(signal.SIGINT, stop)
    try:
        last_state_flush = time.monotonic()
        while running and (stop_after is None or processed < stop_after):
            started = time.perf_counter()
            messages = consumer.consume(num_messages=batch_size, timeout=1.0)
            if not messages:
                continue

            prepared: list[tuple[Any, dict[str, Any] | None, dict[str, Any] | None]] = []
            pending_state: dict[str, dict[str, Any]] = {}
            next_offsets: dict[tuple[str, int], int] = {}
            filtered_count = 0
            error_count = 0

            for message in messages:
                if message is None:
                    continue
                if message.error():
                    if message.error().code() == KafkaError._PARTITION_EOF:
                        continue
                    raise RuntimeError(str(message.error()))

                key = (message.topic(), message.partition())
                next_offsets[key] = max(next_offsets.get(key, 0), message.offset() + 1)
                changelog_value: dict[str, Any] | None = None
                output_value: dict[str, Any] | None = None
                try:
                    event = _decode_event(message.value())
                    if event["temperature"] <= 0:
                        filtered_count += 1
                    else:
                        current_key = state_key(
                            event["truck_id"], window_start(event["timestamp"]), message.topic()
                        )
                        changelog_value = state.prepare_update(
                            event["truck_id"], event["temperature"], event["timestamp"],
                            message.topic(), previous_value=pending_state.get(current_key),
                        )
                        pending_state[current_key] = changelog_value
                        start = int(changelog_value["window_start"])
                        output_value = {
                            "event_id": event["event_id"],
                            "input_topic": message.topic(),
                            "truck_id": event["truck_id"],
                            "window_start": datetime.fromtimestamp(start, timezone.utc).isoformat().replace("+00:00", "Z"),
                            "window_end": datetime.fromtimestamp(start + 300, timezone.utc).isoformat().replace("+00:00", "Z"),
                            "average_temperature": changelog_value["average"],
                            "count": changelog_value["count"],
                            "last_event_timestamp": event["timestamp"],
                        }
                except (ValueError, TypeError, KeyError, json.JSONDecodeError):
                    error_count += 1
                    LOG.exception("Skipping invalid event at %s[%s]@%s", message.topic(), message.partition(), message.offset())
                prepared.append((message, changelog_value, output_value))

            if not prepared:
                continue

            producer.begin_transaction()
            try:
                for message, changelog_value, output_value in prepared:
                    if changelog_value is None:
                        continue
                    records = (
                        (changelog_topic, changelog_value["state_key"], changelog_value),
                        (
                            output_topic,
                            changelog_value["truck_id"] if message.topic() == "truck-telemetry"
                            else f"{message.topic()}|{changelog_value['truck_id']}",
                            output_value,
                        ),
                    )
                    for destination, record_key, record_value in records:
                        while True:
                            try:
                                producer.produce(
                                    destination,
                                    key=record_key,
                                    value=json.dumps(record_value, separators=(",", ":")),
                                )
                                break
                            except BufferError:
                                producer.poll(0.01)
                offsets = [
                    TopicPartition(topic, partition, offset)
                    for (topic, partition), offset in next_offsets.items()
                ]
                producer.send_offsets_to_transaction(offsets, consumer.consumer_group_metadata(), 30)
                producer.commit_transaction(30)
            except Exception:
                producer.abort_transaction(30)
                raise

            for changelog_value in pending_state.values():
                state.restore(changelog_value)
            valid_count = sum(1 for _, value, _ in prepared if value is not None)
            if valid_count:
                EVENTS.inc(valid_count)
                worker_events_processed.inc(valid_count)
            if filtered_count:
                FILTERED.inc(filtered_count)
            if error_count:
                ERRORS.inc(error_count)
            processed += len(prepared)
            if time.monotonic() - last_state_flush >= 5:
                state.flush()
                last_state_flush = time.monotonic()
            PROCESSING_SECONDS.set(time.perf_counter() - started)
    finally:
        PROCESSOR_UP.set(0)
        STATE_STORE_UP.set(0)
        state.flush()
        resource_monitor_stop.set()
        resource_monitor.join(timeout=2)
        consumer.close()
        producer.flush(30)
        state.close()
        signal.signal(signal.SIGTERM, previous_sigterm)
        signal.signal(signal.SIGINT, previous_sigint)
    return processed


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the StreamForge transactional telemetry processor.")
    parser.add_argument("--bootstrap-servers", default=os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"))
    parser.add_argument("--input-topics", "--input-topic", dest="input_topics", default=DEFAULT_INPUT_TOPICS,
                        help="Comma-separated Kafka input topics (legacy --input-topic is also accepted).")
    parser.add_argument("--output-topic", default=OUTPUT_TOPIC)
    parser.add_argument("--changelog-topic", default=CHANGELOG_TOPIC)
    parser.add_argument("--state-path", default=os.getenv("STREAMFORGE_STATE_PATH", "./rocksdb/state"))
    parser.add_argument("--metrics-port", type=int, default=int(os.getenv("STREAMFORGE_METRICS_PORT", "9101")))
    parser.add_argument("--stop-after", type=int, help="Exit after processing this many source records (for smoke checks).")
    parser.add_argument("--batch-size", type=int, default=int(os.getenv("STREAMFORGE_BATCH_SIZE", "128")),
                        help="Maximum messages included in each Kafka transaction.")
    args = parser.parse_args()
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(message)s")
    run_processor(
        bootstrap_servers=args.bootstrap_servers,
        input_topics=[name.strip() for name in args.input_topics.split(",") if name.strip()],
        output_topic=args.output_topic,
        changelog_topic=args.changelog_topic,
        state_path=args.state_path,
        metrics_port=args.metrics_port,
        stop_after=args.stop_after,
        batch_size=args.batch_size,
    )


if __name__ == "__main__":
    main()
