# Copyright (c) 2026 Efstratios Goudelis

import time
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from common.constants import RigStates, SocketEvents
from common.events import EventBroker
from handlers.entities import tracking as tracking_handler
from handlers.entities.tracking import (
    _build_non_satellite_transmitter_target_key,
    _normalize_target_update_payload,
    _normalize_tracker_target_type,
    _pick_active_or_upcoming_pass,
)
from tracker.context import apply_context, forget_context


class _SessionContext:
    async def __aenter__(self):
        return object()

    async def __aexit__(self, exc_type, exc, traceback):
        return None


@pytest.mark.asyncio
async def test_context_read_refreshes_stopped_worker_data(monkeypatch):
    tracker_id = "target-1"
    forget_context(tracker_id)

    async def _get_state(_session, name):
        assert name == "satellite-tracking:target-1"
        return {"success": True, "data": {"value": {"norad_id": 25544}}}

    compile_data = AsyncMock(
        return_value={
            "position": {"lat": 1, "lon": 2, "alt": 400000},
            "details": {"norad_id": 25544, "name": "ISS"},
            "paths": {"past": [1], "future": [2]},
            "coverage": [{"lat": 1, "lon": 2}],
            "transmitters": [{"id": "tx-1"}],
        }
    )
    monkeypatch.setattr(tracking_handler, "AsyncSessionLocal", _SessionContext)
    monkeypatch.setattr(tracking_handler.crud.trackingstate, "get_tracking_state", _get_state)
    monkeypatch.setattr(tracking_handler, "compiled_satellite_data", compile_data)
    monkeypatch.setattr(
        tracking_handler,
        "get_tracker_supervisor",
        lambda: SimpleNamespace(get_runtime=lambda _tracker_id: None),
    )
    monkeypatch.setattr(tracking_handler, "get_live_observer_bodies", AsyncMock(return_value=[]))
    socket = SimpleNamespace(emit=AsyncMock())
    try:
        metadata = await tracking_handler.get_tracker_context(
            socket, {"tracker_id": tracker_id, "fields": ["details", "transmitters"]}, None, "sid-1"
        )
        assert metadata["success"] is True
        assert set(metadata["data"]["satellite_data"]) == {"details", "transmitters"}

        # Editing the same target while its worker is stopped must not return
        # the cached transmitter list from the previous context request.
        compile_data.return_value = {
            **compile_data.return_value,
            "transmitters": [{"id": "tx-2"}],
        }
        full = await tracking_handler.get_tracker_context(
            socket, {"tracker_id": tracker_id}, None, "sid-1"
        )
        assert full["success"] is True
        assert full["data"]["satellite_data"]["paths"] == {"past": [1], "future": [2]}
        assert full["data"]["satellite_data"]["transmitters"] == [{"id": "tx-2"}]
        assert "coverage" not in full["data"]["satellite_data"]
        assert compile_data.await_count == 2
        assert all(
            call.kwargs == {"include_context": True} for call in compile_data.await_args_list
        )
    finally:
        forget_context(tracker_id)


@pytest.mark.asyncio
async def test_context_read_uses_only_current_worker_cache(monkeypatch):
    tracker_id = "target-1"
    forget_context(tracker_id)

    async def _get_state(_session, name):
        assert name == "satellite-tracking:target-1"
        return {"success": True, "data": {"value": {"norad_id": 25544}}}

    process = SimpleNamespace(pid=71, is_alive=lambda: True)
    monkeypatch.setattr(tracking_handler, "AsyncSessionLocal", _SessionContext)
    monkeypatch.setattr(tracking_handler.crud.trackingstate, "get_tracking_state", _get_state)
    monkeypatch.setattr(
        tracking_handler,
        "get_tracker_supervisor",
        lambda: SimpleNamespace(get_runtime=lambda _tracker_id: SimpleNamespace(process=process)),
    )
    monkeypatch.setattr(tracking_handler, "get_live_observer_bodies", AsyncMock(return_value=[]))
    compile_data = AsyncMock()
    monkeypatch.setattr(tracking_handler, "compiled_satellite_data", compile_data)
    socket = SimpleNamespace(emit=AsyncMock())
    try:
        apply_context(
            {
                "tracker_id": tracker_id,
                "context_key": "satellite:25544",
                "context_revision": 10,
                "worker_pid": 71,
                "satellite_data": {"details": {"name": "ISS"}, "paths": {"future": [1]}},
            }
        )
        current = await tracking_handler.get_tracker_context(
            socket, {"tracker_id": tracker_id}, None, "sid-1"
        )
        assert current["data"]["satellite_data"]["paths"] == {"future": [1]}
        process.pid = 72
        replacement = await tracking_handler.get_tracker_context(
            socket, {"tracker_id": tracker_id}, None, "sid-1"
        )
        assert replacement == {"success": True, "pending": True, "data": None}
        compile_data.assert_not_awaited()
    finally:
        forget_context(tracker_id)


@pytest.mark.asyncio
async def test_tracking_read_targets_requester_and_state_change_broadcasts(monkeypatch):
    class _TwoClientSocket:
        def __init__(self):
            self.received = {"existing-client": [], "joining-client": []}

        async def emit(self, event, data, to=None):
            recipients = [to] if to is not None else self.received
            for recipient in recipients:
                self.received[recipient].append((event, data))

    class _Logger:
        def debug(self, *args):
            pass

        def info(self, *args):
            pass

    async def _get_state(_session, name):
        assert name == "satellite-tracking:target-1"
        return {"success": True, "data": {"value": {"norad_id": 25544, "group_id": 1}}}

    compiled_modes = []

    async def _satellite_data(_session, _norad_id, *, include_context=True):
        compiled_modes.append(include_context)
        return {"details": {"name": "ISS"}}

    async def _ui_state(_group_id, _norad_id, _tracker_id):
        return {"data": {"groups": [], "satellites": []}}

    async def _update_state(**_kwargs):
        return {"success": True, "result": {"success": True, "data": {"value": {}}}}

    async def _emit_instances(_sio):
        return None

    monkeypatch.setattr(tracking_handler, "AsyncSessionLocal", _SessionContext)
    monkeypatch.setattr(tracking_handler.crud.trackingstate, "get_tracking_state", _get_state)
    monkeypatch.setattr(tracking_handler, "compiled_satellite_data", _satellite_data)
    monkeypatch.setattr(tracking_handler, "get_ui_tracker_state", _ui_state)
    monkeypatch.setattr(tracking_handler, "update_tracking_state_with_ownership", _update_state)
    monkeypatch.setattr(tracking_handler, "emit_tracker_instances", _emit_instances)
    monkeypatch.setattr(
        tracking_handler,
        "get_tracker_instances_payload",
        lambda: {"instances": [{"tracker_id": "target-1"}]},
    )

    sio = _TwoClientSocket()
    logger = _Logger()
    read_reply = await tracking_handler.get_tracking_state(
        sio, {"tracker_id": "target-1"}, logger, "joining-client"
    )

    assert read_reply["success"] is True
    assert sio.received["existing-client"] == []
    expected_events = [SocketEvents.SATELLITE_TRACKING, SocketEvents.UI_TRACKER_STATE]
    assert [event for event, _ in sio.received["joining-client"]] == expected_events
    assert all(data["tracker_id"] == "target-1" for _, data in sio.received["joining-client"])

    write_reply = await tracking_handler.set_tracking_state(
        sio,
        {
            "tracker_id": "target-1",
            "value": {},
            "operation": {
                "command_id": "update-1",
                "epoch": tracking_handler.operations.epoch,
                "accept_before": time.time() + 10,
            },
        },
        logger,
        "existing-client",
    )

    assert write_reply["success"] is True
    assert [event for event, _ in sio.received["existing-client"]] == expected_events
    assert [event for event, _ in sio.received["joining-client"]] == expected_events * 2
    assert compiled_modes == [False, False]


@pytest.mark.asyncio
async def test_delete_tracker_keeps_operations_lock_free_during_process_stop(monkeypatch):
    lock_states = []
    broker = EventBroker()
    subscription = broker.subscribe("station-token", ["station:read"])
    monkeypatch.setattr(tracking_handler, "public_events", broker)

    def _remove_tracker(_tracker_id):
        lock_states.append(tracking_handler.operations.lock.locked())
        return {"success": True}

    async def _delete_tracking_state(_session, _state_name):
        return {"success": True, "deleted": True}

    async def _emit_instances(_sio):
        return None

    monkeypatch.setattr(
        tracking_handler,
        "get_tracker_instances_payload",
        lambda: {"instances": [{"tracker_id": "target-1"}]},
    )
    monkeypatch.setattr(tracking_handler, "remove_tracker_instance", _remove_tracker)
    monkeypatch.setattr(tracking_handler, "AsyncSessionLocal", _SessionContext)
    monkeypatch.setattr(
        tracking_handler.crud.trackingstate,
        "delete_tracking_state",
        _delete_tracking_state,
    )
    monkeypatch.setattr(tracking_handler, "emit_tracker_instances", _emit_instances)

    result = await tracking_handler.delete_tracker_instance(
        sio=object(),
        data={"tracker_id": "target-1"},
        logger=None,
        sid="client-1",
    )

    assert result["success"] is True
    assert lock_states == [False]
    assert subscription.queue.get_nowait() == (
        "target.slot.deleted",
        {"tracker_id": "target-1"},
    )


def test_mission_target_normalization_preserves_rig_control_fields():
    result = _normalize_target_update_payload(
        {
            "target_type": "mission",
            "command": "Juno",
            "target_name": "Juno",
            "rig_id": "rig-123",
            "rig_state": RigStates.CONNECTED,
            "transmitter_id": "tx-123",
            "rig_vfo": "1",
        }
    )

    assert result["success"] is True
    payload = result["value"]
    assert payload["target_type"] == "mission"
    assert payload["target_key"] == "mission:juno"
    assert payload["rig_id"] == "rig-123"
    assert payload["rig_state"] == RigStates.CONNECTED
    assert payload["transmitter_id"] == "tx-123"
    assert payload["rig_vfo"] == "1"


def test_body_target_normalization_preserves_rig_control_fields():
    result = _normalize_target_update_payload(
        {
            "target_type": "body",
            "body_id": "JUPITER",
            "target_name": "JUPITER",
            "rig_id": "rig-abc",
            "rig_state": RigStates.TRACKING,
            "transmitter_id": "tx-abc",
            "rig_vfo": "2",
        }
    )

    assert result["success"] is True
    payload = result["value"]
    assert payload["target_type"] == "body"
    assert payload["body_id"] == "jupiter"
    assert payload["target_key"] == "body:jupiter"
    assert payload["rig_id"] == "rig-abc"
    assert payload["rig_state"] == RigStates.TRACKING
    assert payload["transmitter_id"] == "tx-abc"
    assert payload["rig_vfo"] == "2"


def test_tracker_target_type_inference_uses_command_and_body_id():
    assert _normalize_tracker_target_type({"mission_id": "mission:command_id"}) == "mission"
    assert _normalize_tracker_target_type({"command": "Voyager 1"}) == "mission"
    assert _normalize_tracker_target_type({"body_id": "rhea"}) == "body"
    assert _normalize_tracker_target_type({"norad_id": "25544"}) == "satellite"


def test_tracking_target_uses_backend_key_as_stable_identity():
    result = _normalize_target_update_payload(
        {
            "target_type": "mission",
            "target_key": "mission:pioneer_10",
            "command": "Pioneer 10 Extended",
        }
    )

    assert result["success"] is True
    assert result["value"]["target_key"] == "mission:pioneer_10"


def test_tracking_target_rejects_legacy_key_namespace():
    result = _normalize_target_update_payload(
        {
            "target_type": "mission",
            "target_key": "missioncmd:Voyager 1",
            "command": "Voyager 1",
        }
    )

    assert result["success"] is False
    assert result["error"] == "invalid_target_key"


def test_transmitter_lookup_never_rebuilds_identity_from_metadata():
    assert (
        _build_non_satellite_transmitter_target_key(
            {
                "target_key": "mission:pioneer_10",
                "command": "Pioneer 10 Extended",
            },
            "mission",
        )
        == "mission:pioneer_10"
    )
    assert _build_non_satellite_transmitter_target_key({"command": "Pioneer 10"}, "mission") == ""


def test_pick_active_or_upcoming_pass_supports_celestial_peak_elevation_field():
    now = datetime.now(timezone.utc)
    live_pass = {
        "event_start": (now - timedelta(minutes=5)).isoformat(),
        "event_end": (now + timedelta(minutes=5)).isoformat(),
        "peak_elevation_deg": 21.0,
    }
    next_pass = {
        "event_start": (now + timedelta(minutes=20)).isoformat(),
        "event_end": (now + timedelta(minutes=32)).isoformat(),
        "peak_elevation_deg": 43.0,
    }
    active, upcoming = _pick_active_or_upcoming_pass(
        candidate_passes=[live_pass, next_pass],
        now_ms=int(now.timestamp() * 1000),
        min_elevation=10.0,
    )
    assert active == live_pass
    assert upcoming == next_pass
