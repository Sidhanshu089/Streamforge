"""Configurable, batched Kafka producer for mock truck telemetry."""

from __future__ import annotations

import argparse
import json
import random
import time
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from confluent_kafka import Producer

DEFAULT_TOPIC = "truck-telemetry"
DEFAULT_BOOTSTRAP_SERVERS = "localhost:9092"
TRUCK_IDS = [f"TTRK-{number:05d}" for number in range(1, 50_001)]


def generate_telemetry() -> dict[str, Any]:
    """Return one schema-valid mock telemetry event."""
    return {
        "event_id": str(uuid4()),
        "truck_id": random.choice(TRUCK_IDS),
        "temperature": round(random.uniform(-10.0, 50.0), 2),
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


def _delivery_callback(state: dict[str, int]):
    def callback(error: Any, _message: Any) -> None:
        if error is None:
            state["delivered"] += 1
        else:
            state["failed"] += 1

    return callback


def produce_events(
    *,
    topic: str = DEFAULT_TOPIC,
    topics: list[str] | None = None,
    bootstrap_servers: str = DEFAULT_BOOTSTRAP_SERVERS,
    event_count: int | None = None,
    duration_sec: float | None = 60,
    rate_hz: int | None = None,
) -> dict[str, Any]:
    """Produce telemetry, optionally spread round-robin across input topics."""
    target_topics = list(dict.fromkeys(topics or [topic]))
    if not target_topics or any(not name.strip() for name in target_topics):
        raise ValueError("At least one non-empty Kafka topic is required.")
    if event_count is None and duration_sec is None:
        raise ValueError("Provide event_count, duration_sec, or both.")
    if event_count is not None and event_count <= 0:
        raise ValueError("event_count must be positive.")
    if duration_sec is not None and duration_sec <= 0:
        raise ValueError("duration_sec must be positive.")
    if rate_hz is not None and rate_hz <= 0:
        raise ValueError("rate_hz must be positive.")

    delivery_state = {"delivered": 0, "failed": 0}
    producer = Producer(
        {
            "bootstrap.servers": bootstrap_servers,
            "acks": "all",
            "enable.idempotence": True,
            "linger.ms": 10,
            "batch.num.messages": 10_000,
            "compression.type": "lz4",
        }
    )
    callback = _delivery_callback(delivery_state)
    started_at = time.perf_counter()
    deadline = started_at + duration_sec if duration_sec is not None else None
    produced = 0
    next_event_at = started_at

    while (event_count is None or produced < event_count) and (
        deadline is None or time.perf_counter() < deadline
    ):
        if rate_hz is not None:
            now = time.perf_counter()
            if now < next_event_at:
                time.sleep(next_event_at - now)
            next_event_at += 1 / rate_hz

        event = generate_telemetry()
        payload = json.dumps(event, separators=(",", ":")).encode("utf-8")
        target_topic = target_topics[produced % len(target_topics)]
        while True:
            try:
                producer.produce(target_topic, key=event["truck_id"], value=payload, on_delivery=callback)
                break
            except BufferError:
                producer.poll(0.1)
        produced += 1
        producer.poll(0)

    remaining = producer.flush(30)
    elapsed = time.perf_counter() - started_at
    if remaining:
        delivery_state["failed"] += remaining
    summary: dict[str, Any] = {
        "produced": produced,
        "topics": target_topics,
        "delivered": delivery_state["delivered"],
        "failed": delivery_state["failed"],
        "elapsed_seconds": round(elapsed, 3),
        "events_per_second": round(produced / elapsed, 2) if elapsed else 0,
    }
    print(json.dumps(summary))
    return summary


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Produce StreamForge truck telemetry.")
    parser.add_argument("--bootstrap-servers", default=DEFAULT_BOOTSTRAP_SERVERS)
    parser.add_argument("--topic", default=DEFAULT_TOPIC)
    parser.add_argument("--topics", help="Comma-separated topics for round-robin multi-stream input.")
    parser.add_argument("--events", type=int, help="Produce exactly this many events.")
    parser.add_argument("--duration", type=float, default=60, help="Maximum duration in seconds.")
    parser.add_argument("--rate", type=int, help="Optional maximum events per second.")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    produce_events(
        topic=args.topic,
        topics=[name.strip() for name in args.topics.split(",") if name.strip()] if args.topics else None,
        bootstrap_servers=args.bootstrap_servers,
        event_count=args.events,
        duration_sec=args.duration,
        rate_hz=args.rate,
    )
