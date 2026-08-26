"""Measure the rate at which a Kafka consumer can read a fixed event count."""

from __future__ import annotations

import argparse
import json
import time
from uuid import uuid4

from confluent_kafka import Consumer, KafkaException


def consume_for_audit(bootstrap_servers: str, topic: str, event_count: int, timeout_sec: float) -> dict[str, float | int]:
    """Consume ``event_count`` records and report throughput."""
    consumer = Consumer(
        {
            "bootstrap.servers": bootstrap_servers,
            "group.id": f"streamforge-audit-{uuid4()}",
            "auto.offset.reset": "earliest",
            "enable.auto.commit": False,
        }
    )
    consumer.subscribe([topic])
    received = 0
    started_at = time.perf_counter()
    try:
        while received < event_count:
            message = consumer.poll(1.0)
            if message is None:
                if time.perf_counter() - started_at > timeout_sec:
                    raise TimeoutError(f"Only received {received}/{event_count} events before timeout.")
                continue
            if message.error():
                raise KafkaException(message.error())
            received += 1
    finally:
        consumer.close()

    elapsed = time.perf_counter() - started_at
    summary: dict[str, float | int] = {
        "consumed": received,
        "elapsed_seconds": round(elapsed, 3),
        "events_per_second": round(received / elapsed, 2) if elapsed else 0,
    }
    print(json.dumps(summary))
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Audit StreamForge Kafka consumer throughput.")
    parser.add_argument("--bootstrap-servers", default="localhost:9092")
    parser.add_argument("--topic", default="truck-telemetry")
    parser.add_argument("--events", type=int, default=100_000)
    parser.add_argument("--timeout", type=float, default=120)
    args = parser.parse_args()
    consume_for_audit(args.bootstrap_servers, args.topic, args.events, args.timeout)
