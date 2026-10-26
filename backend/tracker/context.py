# Copyright (c) 2025 Efstratios Goudelis
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.

"""Small live tracker messages and separately cached target context."""

import hashlib
import json
import time
from typing import Any

from common.targetkey import build_target_key, normalize_target_key

CONTEXT_FIELDS = ("details", "paths", "transmitters")
SATELLITE_TRACKING_CONTEXT = "satellite-tracking-context"
OBSERVER_SKY_UPDATE = "observer-sky-update"

_latest_context: dict[str, dict[str, Any]] = {}


def context_key(tracking_state: dict[str, Any], satellite_data: dict[str, Any]) -> str:
    """Identify a target independently of its changing orbit and catalog data."""
    details = satellite_data.get("details") or {}
    target_type = str(
        tracking_state.get("target_type")
        or details.get("target_type")
        or ("mission" if tracking_state.get("command") else None)
        or ("body" if tracking_state.get("body_id") else None)
        or "satellite"
    )
    if target_type != "satellite":
        return (
            normalize_target_key(tracking_state.get("target_key"))
            or normalize_target_key(details.get("target_key"))
            or build_target_key(
                target_type=target_type,
                command=tracking_state.get("command") or details.get("command"),
                body_id=tracking_state.get("body_id") or details.get("body_id"),
            )
            or f"{target_type}:"
        )
    identifier = tracking_state.get("norad_id") or details.get("norad_id")
    return f"satellite:{identifier or ''}"


def context_chunks(satellite_data: dict[str, Any]) -> dict[str, Any]:
    return {field: satellite_data.get(field) for field in CONTEXT_FIELDS if field in satellite_data}


def chunk_digest(value: Any) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str).encode()
    return hashlib.blake2b(encoded, digest_size=12).hexdigest()


def next_revision(previous: int = 0) -> int:
    # Microseconds fit in a JavaScript Number and order worker restarts and snapshots.
    return max(time.time_ns() // 1000, previous + 1)


def live_satellite_data(satellite_data: dict[str, Any]) -> dict[str, Any]:
    """Keep identity available to pages that do not request the full context."""
    details = satellite_data.get("details") or {}
    identity = {
        field: details[field]
        for field in (
            "name",
            "norad_id",
            "target_key",
            "target_type",
            "body_id",
            "command",
            "mission_id",
        )
        if field in details
    }
    live = {
        field: satellite_data[field]
        for field in ("position", "error", "nextPass")
        if field in satellite_data
    }
    if identity:
        live["details"] = identity
    return live


def apply_context(message: dict[str, Any]) -> dict[str, Any] | None:
    """Merge partial worker changes for a later full context request."""
    tracker_id = message.get("tracker_id")
    key = message.get("context_key")
    revision = message.get("context_revision")
    if not tracker_id or not key or not isinstance(revision, int):
        return None
    previous = _latest_context.get(tracker_id)
    if previous and previous["context_revision"] >= revision:
        return None
    chunks = context_chunks(message.get("satellite_data") or {})
    if previous and previous["context_key"] == key:
        chunks = {**previous["satellite_data"], **chunks}
    snapshot = {
        "tracker_id": tracker_id,
        "context_key": key,
        "context_revision": revision,
        "worker_pid": message.get("worker_pid"),
        "satellite_data": chunks,
    }
    _latest_context[tracker_id] = snapshot
    return snapshot


def latest_context(tracker_id: str) -> dict[str, Any] | None:
    return _latest_context.get(tracker_id)


def forget_context(tracker_id: str) -> None:
    _latest_context.pop(tracker_id, None)
