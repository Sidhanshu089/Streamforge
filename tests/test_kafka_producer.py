from datetime import datetime

from kafka.producer import TRUCK_IDS, generate_telemetry


def test_generated_telemetry_matches_shared_event_contract():
    event = generate_telemetry()

    assert set(event) == {"event_id", "truck_id", "temperature", "timestamp"}
    assert event["truck_id"] in TRUCK_IDS
    assert -10 <= event["temperature"] <= 50
    assert datetime.fromisoformat(event["timestamp"].replace("Z", "+00:00")).tzinfo is not None


def test_generated_event_ids_are_unique():
    assert generate_telemetry()["event_id"] != generate_telemetry()["event_id"]
