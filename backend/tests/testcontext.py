# Copyright (c) 2026 Efstratios Goudelis

import json
import queue
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from tracker import data as datamodule
from tracker.context import apply_context, forget_context, latest_context
from tracker.logic import SatelliteTracker


@pytest.mark.asyncio
async def test_live_bootstrap_skips_geometry_and_context_queries(monkeypatch):
    orbit = SimpleNamespace(tle1="line 1", tle2="line 2")
    monkeypatch.setattr(
        datamodule.crud.satellites,
        "fetch_satellites",
        AsyncMock(return_value={"success": True, "data": [{"norad_id": 25544, "name": "ISS"}]}),
    )
    monkeypatch.setattr(
        datamodule.crud.locations,
        "fetch_all_locations",
        AsyncMock(return_value={"success": True, "data": [{"lat": 1, "lon": 2}]}),
    )
    monkeypatch.setattr(datamodule, "get_propagation_input", lambda *_args, **_kwargs: orbit)
    monkeypatch.setattr(datamodule, "_is_geostationary_orbit", lambda _orbit: False)
    monkeypatch.setattr(
        datamodule,
        "get_satellite_position_from_propagation",
        lambda _orbit: {"lat": 3, "lon": 4, "alt": 400000},
    )
    monkeypatch.setattr(datamodule, "get_satellite_az_el_from_propagation", lambda *_args: (5, 6))
    fetch_paths = AsyncMock(side_effect=AssertionError("paths should not be requested"))
    monkeypatch.setattr(datamodule.crud.preferences, "get_map_settings", fetch_paths)
    monkeypatch.setattr(
        datamodule.crud.transmitters, "fetch_transmitters_for_satellite", fetch_paths
    )

    def _unexpected_paths(*_args):
        raise AssertionError("paths should not be built")

    monkeypatch.setattr(datamodule, "get_cached_satellite_paths", _unexpected_paths)

    result = await datamodule.compiled_satellite_data(object(), 25544, include_context=False)

    assert result["error"] is False
    assert result["position"]["az"] == 5
    assert set(result) == {"details", "position", "error"}
    fetch_paths.assert_not_awaited()


def test_worker_queues_geometry_once_and_only_changed_transmitters_later():
    tracker = SatelliteTracker(queue.Queue(), queue.Queue(), tracker_id="target-1")
    state = {"target_type": "satellite", "norad_id": 25544}
    path = {"past": [[{"lat": 1.0, "lon": 2.0}] * 900], "future": []}
    tracker.satellite_data = {
        "details": {"name": "ISS", "norad_id": 25544, "tle1": "line 1"},
        "paths": path,
        "coverage": [{"lat": 1.0, "lon": 2.0}] * 300,
        "transmitters": [{"id": "tx-1", "mode": "FM"}],
        "position": {"lat": 1.0, "lon": 2.0, "alt": 400000, "az": 3.0, "el": 4.0},
    }

    tracker._queue_tracking_update(state)
    first_context, first_tick = list(tracker.queue_out._queue_out.queue)
    assert first_context["event"] == "satellite-tracking-context"
    assert set(first_context["data"]["satellite_data"]) == {"details", "paths", "transmitters"}
    assert first_tick["event"] == "satellite-tracking"
    assert set(first_tick["data"]["satellite_data"]) == {"details", "position"}
    assert len(json.dumps(first_tick["data"])) < 2000

    tracker.queue_out._queue_out.queue.clear()
    tracker.satellite_data["position"]["lat"] = 1.1
    tracker._queue_tracking_update(state)
    assert [message["event"] for message in tracker.queue_out._queue_out.queue] == [
        "satellite-tracking"
    ]

    tracker.queue_out._queue_out.queue.clear()
    tracker.satellite_data["transmitters"] = [{"id": "tx-1", "mode": "SSB"}]
    tracker._queue_tracking_update(state)
    changed_context, _ = list(tracker.queue_out._queue_out.queue)
    assert set(changed_context["data"]["satellite_data"]) == {"transmitters"}


def test_partial_context_is_merged_for_a_later_page_request():
    tracker_id = "target-1"
    forget_context(tracker_id)
    try:
        assert apply_context(
            {
                "tracker_id": tracker_id,
                "context_key": "satellite:25544",
                "context_revision": 10,
                "satellite_data": {"details": {"name": "ISS"}, "paths": {"future": [1]}},
            }
        )
        assert apply_context(
            {
                "tracker_id": tracker_id,
                "context_key": "satellite:25544",
                "context_revision": 11,
                "satellite_data": {"transmitters": [{"id": 1}]},
            }
        )
        assert latest_context(tracker_id)["satellite_data"] == {
            "details": {"name": "ISS"},
            "paths": {"future": [1]},
            "transmitters": [{"id": 1}],
        }
        assert (
            apply_context(
                {
                    "tracker_id": tracker_id,
                    "context_key": "satellite:25544",
                    "context_revision": 9,
                    "satellite_data": {"paths": {"future": [0]}},
                }
            )
            is None
        )
        assert latest_context(tracker_id)["satellite_data"]["paths"] == {"future": [1]}
    finally:
        forget_context(tracker_id)
