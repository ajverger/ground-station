# Copyright (c) 2025 Efstratios Goudelis

"""Contract tests for rotator limit notifications."""

from queue import SimpleQueue

from common.constants import SocketEvents, TrackingEvents
from tracker.rotatorhandler import RotatorHandler


class _Tracker:
    def __init__(self):
        self.azimuth_limits = (0, 360)
        self.elevation_limits = (0, 90)
        self.current_norad_id = 25544
        self.current_rotator_state = "tracking"
        self.notified = {}
        self.rotator_details = {}
        self.rotator_data = {}
        self.satellite_data = {
            "details": {"name": "ISS (ZARYA)", "norad_id": 25544},
            "position": {"az": 180.0, "el": -0.1},
            "paths": {"future": [1, 2, 3]},
        }
        self.queue_out = SimpleQueue()

    def in_tracking_state(self):
        return self.current_rotator_state == "tracking"


def test_below_elevation_event_carries_satellite_identity_at_tracking_payload_level():
    tracker = _Tracker()
    handler = RotatorHandler(tracker)

    handler.check_position_limits((180.0, -0.1), "ISS (ZARYA)")

    message = tracker.queue_out.get_nowait()
    assert message["event"] == SocketEvents.SATELLITE_TRACKING
    assert message["data"]["events"] == [{"name": TrackingEvents.MIN_ELEVATION_OUT_OF_BOUNDS}]
    assert message["data"]["satellite_data"]["details"] == {
        "name": "ISS (ZARYA)",
        "norad_id": 25544,
    }
    assert "paths" not in message["data"]["satellite_data"]
    assert "data" not in message["data"]
