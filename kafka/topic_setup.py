"""Create and verify the Kafka topics shared by StreamForge services."""

from __future__ import annotations

import argparse
import os
import sys

from confluent_kafka.admin import (
    AdminClient,
    ConfigEntry,
    AlterConfigOpType,
    ConfigResource,
    NewPartitions,
    NewTopic,
    ResourceType,
)

DEFAULT_INPUT_TOPICS = os.getenv("KAFKA_INPUT_TOPICS", os.getenv("KAFKA_INPUT_TOPIC", "truck-telemetry"))
INPUT_TOPICS = tuple(name.strip() for name in DEFAULT_INPUT_TOPICS.split(",") if name.strip())
OUTPUT_TOPICS = ("truck-temperature-averages", "truck-temperature-averages-changelog")
CHANGELOG_TOPIC = "truck-temperature-averages-changelog"


def ensure_topics(
    bootstrap_servers: str,
    partitions: int = 20,
    input_topics: tuple[str, ...] | None = None,
) -> None:
    """Create missing project topics and confirm their partition count."""
    input_topics = input_topics or INPUT_TOPICS
    topics = tuple(dict.fromkeys((*input_topics, *OUTPUT_TOPICS)))
    admin = AdminClient({"bootstrap.servers": bootstrap_servers})
    metadata = admin.list_topics(timeout=10)
    missing = [topic for topic in topics if topic not in metadata.topics]
    if missing:
        futures = admin.create_topics(
            [
                NewTopic(
                    topic,
                    num_partitions=partitions,
                    replication_factor=1,
                    config={"cleanup.policy": "compact"} if topic == CHANGELOG_TOPIC else {},
                )
                for topic in missing
            ]
        )
        for topic, future in futures.items():
            future.result()
            print(f"Created topic: {topic}")

    metadata = admin.list_topics(timeout=10)
    for topic in topics:
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

    # Existing changelog topics also need compaction so each state key can be
    # recovered from its latest snapshot without retaining unbounded history.
    resource = ConfigResource(
        ResourceType.TOPIC,
        CHANGELOG_TOPIC,
        incremental_configs=[
            ConfigEntry("cleanup.policy", "compact", incremental_operation=AlterConfigOpType.SET)
        ],
    )
    admin.incremental_alter_configs([resource])[resource].result()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Set up StreamForge Kafka topics.")
    parser.add_argument("--bootstrap-servers", default="localhost:9092")
    parser.add_argument("--partitions", type=int, default=20)
    parser.add_argument(
        "--input-topics",
        default=DEFAULT_INPUT_TOPICS,
        help="Comma-separated input topics to create and verify.",
    )
    arguments = parser.parse_args()
    try:
        ensure_topics(
            arguments.bootstrap_servers,
            arguments.partitions,
            tuple(name.strip() for name in arguments.input_topics.split(",") if name.strip()),
        )
    except Exception as error:
        print(f"Topic setup failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
