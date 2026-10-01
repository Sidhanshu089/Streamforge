from pathlib import Path

from rocksdict import Rdict
from faust.state_store import TruckState, window_start

TEST_DB_ROOT = Path(__file__).resolve().parent.parent / "rocksdb"


def test_window_state_aggregates_events_and_round_trips():
    path = TEST_DB_ROOT / "test-state-round-trip"
    Rdict.destroy(str(path)) if path.exists() else None
    store = TruckState(str(path))
    timestamp = "2026-09-01T10:00:01Z"
    start = window_start(timestamp)

    first = store.update("TTRK-00001", 20, timestamp)
    second = store.update("TTRK-00001", 30, "2026-09-01T10:04:59Z")

    assert first["average"] == 20
    assert second["count"] == 2
    assert second["average"] == 25
    assert store.get_avg("TTRK-00001", timestamp) == 25
    store.close()

    reopened = TruckState(str(path))
    assert reopened.get("TTRK-00001", start)["average"] == 25
    reopened.close()
    Rdict.destroy(str(path))


def test_events_in_next_window_start_a_new_aggregate():
    path = TEST_DB_ROOT / "test-state-window-boundary"
    Rdict.destroy(str(path)) if path.exists() else None
    store = TruckState(str(path))
    first = store.update("TTRK-00001", 20, "2026-09-01T10:04:59Z")
    next_window = store.update("TTRK-00001", 30, "2026-09-01T10:05:00Z")

    assert first["count"] == 1
    assert next_window["count"] == 1
    assert next_window["average"] == 30
    store.close()
    Rdict.destroy(str(path))


def test_changelog_restore_replaces_state_with_latest_snapshot():
    path = TEST_DB_ROOT / "test-state-changelog-restore"
    Rdict.destroy(str(path)) if path.exists() else None
    store = TruckState(str(path))
    latest = {
        "state_key": "TTRK-00002|1790858400",
        "truck_id": "TTRK-00002",
        "window_start": 1790858400,
        "window_end": 1790858700,
        "sum": 50.0,
        "count": 2,
        "average": 25.0,
        "last_event_timestamp": "2026-09-01T10:04:00Z",
    }
    store.restore(latest)
    assert store.get("TTRK-00002", latest["window_start"]) == latest
    store.close()
    Rdict.destroy(str(path))
