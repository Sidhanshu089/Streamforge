"""High-throughput Python producer for mock IoT truck telemetry."""
import json
import random
import time
from datetime import datetime, timedelta
from uuid import uuid4

from confluent_kafka import Producer

TOPIC = "truck-telemetry"
BOOTSTRAP_SERVERS = "localhost:9092"

truck_ids = [f"TTRK-{i:05d}" for i in range(1, 50001)]


def generate_telemetry():
    """Generate a single truck telemetry event."""
    truck_id = random.choice(truck_ids)
    temp = round(random.uniform(-10.0, 50.0), 2)
    timestamp = datetime.utcnow().isoformat() + "Z"
    return {
        "truck_id": truck_id,
        "temperature": temp,
        "timestamp": timestamp,
        "event_id": str(uuid4()),
    }


def delivery_report(err, msg):
    """Callback for delivery report."""
    if err is not None:
        print(f"Message delivery failed: {err}")
    else:
        print(f"Message delivered to {msg.topic()} [{msg.partition()}]")


def produce_events(rate_hz: float = 10000, duration_sec: int = 60):
    """Produce mock IoT truck telemetry events at a given rate."""
    conf = {"bootstrap.servers": BOOTSTRAP_SERVERS}
    producer = Producer(conf)

    end_time = time.time() + duration_sec
    interval = 1.0 / rate_hz

    print(f"Producing {rate_hz} events/sec for {duration_sec}s (~{rate_hz * duration_sec} total events)")

    while time.time() < end_time:
        start = time.time()
        event = generate_telemetry()
        producer.produce(
            TOPIC,
            key=event["truck_id"],
            value=json.dumps(event).encode("utf-8"),
            callback=delivery_report,
        )
        # Poll for delivery reports
        producer.poll(0)

        elapsed = time.time() - start
        sleep_time = max(0, interval - elapsed)
        time.sleep(sleep_time)

    # Wait for final messages to be delivered
    producer.flush()
    print("Production complete.")


if __name__ == "__main__":
    produce_events(rate_hz=10000, duration_sec=60)