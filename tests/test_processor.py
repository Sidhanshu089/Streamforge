import pytest

from faust.processor import _decode_event


def test_processor_decodes_valid_telemetry():
    event = _decode_event(
        b'{"event_id":"e1","truck_id":"TTRK-00001","temperature":12.5,"timestamp":"2026-09-01T10:00:00Z"}'
    )
    assert event["truck_id"] == "TTRK-00001"
    assert event["temperature"] == 12.5


@pytest.mark.parametrize(
    "payload",
    [
        b"not json",
        b'{"event_id":"e1"}',
        b'{"event_id":"e1","truck_id":"T1","temperature":12,"timestamp":"2026-09-01T10:00:00"}',
    ],
)
def test_processor_rejects_invalid_telemetry(payload):
    with pytest.raises((ValueError, TypeError)):
        _decode_event(payload)
