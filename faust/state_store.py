"""Persistent RocksDB state for five-minute per-truck temperature windows."""

from __future__ import annotations

import threading
from pathlib import Path
from typing import Any

from rocksdict import Rdict

WINDOW_SECONDS = 5 * 60
DEFAULT_STREAM = "truck-telemetry"


def window_start(timestamp: str) -> int:
    """Return the UTC epoch start of an event's five-minute tumbling window."""
    from datetime import datetime

    parsed = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("timestamp must include a timezone")
    epoch = int(parsed.timestamp())
    return epoch - epoch % WINDOW_SECONDS


def state_key(truck_id: str, start: int, stream_id: str = DEFAULT_STREAM) -> str:
    # Preserve existing single-stream RocksDB and changelog keys for the
    # original topic; namespace every additional stream to avoid state mixing.
    if stream_id == DEFAULT_STREAM:
        return f"{truck_id}|{start}"
    return f"{stream_id}|{truck_id}|{start}"


class TruckState:
    """Thread-safe durable mapping backed by RocksDB.

    State values are JSON dictionaries so the same representation can be
    written to and restored from the Kafka changelog topic.
    """

    def __init__(self, db_path: str = "./rocksdb/state") -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._db = Rdict(str(self.db_path))
        self._lock = threading.RLock()

    @staticmethod
    def make_value(
        truck_id: str,
        temperature: float,
        timestamp: str,
        stream_id: str = DEFAULT_STREAM,
        previous_value: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        start = window_start(timestamp)
        key = state_key(truck_id, start, stream_id)
        return {
            "truck_id": truck_id,
            "input_topic": stream_id,
            "window_start": start,
            "window_end": start + WINDOW_SECONDS,
            "sum": float(temperature),
            "count": 1,
            "average": float(temperature),
            "last_event_timestamp": timestamp,
            "state_key": key,
        }

    def prepare_update(
        self,
        truck_id: str,
        temperature: float,
        timestamp: str,
        stream_id: str = DEFAULT_STREAM,
        previous_value: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Calculate the next value without mutating state before Kafka commits."""
        value = self.make_value(truck_id, temperature, timestamp, stream_id)
        key = value["state_key"]
        with self._lock:
            previous = previous_value if previous_value is not None else self._db.get(key)
            if previous:
                value["sum"] += float(previous["sum"])
                value["count"] += int(previous["count"])
                value["average"] = value["sum"] / value["count"]
        return value

    def update(
        self,
        truck_id: str,
        temperature: float,
        timestamp: str,
        stream_id: str = DEFAULT_STREAM,
    ) -> dict[str, Any]:
        """Calculate and persist a new window snapshot."""
        value = self.prepare_update(truck_id, temperature, timestamp, stream_id)
        self.restore(value)
        return value

    def restore(self, value: dict[str, Any]) -> None:
        """Apply one committed changelog snapshot to the local state store."""
        key = value.get("state_key") or state_key(
            value["truck_id"], int(value["window_start"]), value.get("input_topic", DEFAULT_STREAM)
        )
        restored = dict(value)
        restored["state_key"] = key
        with self._lock:
            self._db[key] = restored

    def get(
        self, truck_id: str, start: int, stream_id: str = DEFAULT_STREAM
    ) -> dict[str, Any] | None:
        with self._lock:
            value = self._db.get(state_key(truck_id, start, stream_id))
            return dict(value) if value else None

    def get_avg(
        self, truck_id: str, timestamp: str, stream_id: str = DEFAULT_STREAM
    ) -> float | None:
        value = self.get(truck_id, window_start(timestamp), stream_id)
        return float(value["average"]) if value else None

    def snapshots(self) -> list[dict[str, Any]]:
        with self._lock:
            return [dict(value) for _, value in self._db.items()]

    def flush(self) -> None:
        with self._lock:
            self._db.flush()

    def close(self) -> None:
        with self._lock:
            if self._db is not None:
                self._db.close()
                self._db = None

    def __enter__(self) -> "TruckState":
        return self

    def __exit__(self, exc_type: Any, exc: Any, traceback: Any) -> None:
        self.close()
