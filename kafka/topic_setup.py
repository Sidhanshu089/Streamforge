"""Create and verify the Kafka topics shared by StreamForge services."""

from __future__ import annotations

import argparse
import sys

from confluent_kafka.admin import AdminClient, NewPartitions, NewTopic

TOPICS = ("truck-telemetry", "truck-temperature-averages")


def ensure_topics(bootstrap_servers: str, partitions: int = 20) -> None:
    """Create missing project topics and confirm their partition count."""
    admin = AdminClient({"bootstrap.servers": bootstrap_servers})
    metadata = admin.list_topics(timeout=10)
    missing = [topic for topic in TOPICS if topic not in metadata.topics]
    if missing:
        futures = admin.create_topics(
            [NewTopic(topic, num_partitions=partitions, replication_factor=1) for topic in missing]
        )
        for topic, future in futures.items():
            future.result()
            print(f"Created topic: {topic}")

    metadata = admin.list_topics(timeout=10)
    for topic in TOPICS:
        actual_partitions = len(metadata.topics[topic].partitions)
        if actual_partitions > partitions:
            raise RuntimeError(
                f"{topic} has {actual_partitions} partitions; expected {partitions}. "
                "Kafka cannot reduce a topic's partition count."
            )
        if actual_partitions < partitions:
            admin.create_partitions([NewPartitions(topic, partitions)])[topic].result()
            actual_partitions = partitions
            print(f"Expanded topic: {topic} ({actual_partitions} partitions)")
        print(f"Verified topic: {topic} ({actual_partitions} partitions)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Set up StreamForge Kafka topics.")
    parser.add_argument("--bootstrap-servers", default="localhost:9092")
    parser.add_argument("--partitions", type=int, default=20)
    arguments = parser.parse_args()
    try:
        ensure_topics(arguments.bootstrap_servers, arguments.partitions)
    except Exception as error:
        print(f"Topic setup failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
