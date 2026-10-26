"""Captured OK0LSR frames and LASARSAT beacon validation."""

import pytest

from telemetry.parser import TelemetryParser
from telemetry.parsers.lasarsat import LasarsatAx25Parser

pytestmark = pytest.mark.unit

# AX.25 UI frames captured on rfbox5 on 2026-10-26. The recorder stores one
# HDLC flag at either end; BaseDecoder removes them before telemetry parsing.
CAPTURES = {
    "SOL": "7e86a240404040609e966098a6a46103f0534f4c2c313631322c313532352c333135302c323438312c323531322c313430302c3133362c3133342c3133352c3133342c3133362c313334007e",
    "PSU": "7e86a240404040609e966098a6a46103f05053552c342c33393532343636302c35383235393338382c383134382c323330322c313736382c312c38382c37632c312c3935007e",
    "OBC": "7e86a240404040609e966098a6a46103f04f42432c3231312c323336353031322c35383234383839322c323036342c37373538007e",
    "U": "7e86a240404040609e966098a6a46103f0552c33393531373839382c35383234383238382c342c312c323834342c323837362c333038372c313931302c444c374e44522c35313835362c343135313431392c38312c3937007e",
    "MGS": "7e86a240404040609e966098a6a46103f04d47532c313836302c323237352c31333133322c2d363734392c333930352c3133362c3234392c2d3730007e",
}


@pytest.mark.parametrize("kind", CAPTURES)
def test_captured_lasarsat_frames_route_to_payload_parser(kind):
    frame = bytes.fromhex(CAPTURES[kind])[1:-1]
    result = TelemetryParser().parse(frame, protocol_hint="ax25")

    assert result["success"] is True
    assert result["parser"] == "ax25+LasarsatAx25Parser"
    assert result["frame"]["source"] == "OK0LSR-0"
    assert result["frame"]["destination"] == "CQ-0"
    assert result["telemetry"]["format"] == "beacon"
    assert result["telemetry"]["type"] == kind


def test_captured_psu_has_hex_channel_bits_and_unscaled_values():
    frame = bytes.fromhex(CAPTURES["PSU"])[1:-1]
    values = TelemetryParser().parse(frame, protocol_hint="ax25")["telemetry"]["values"]

    assert values["psu_battery"] == 8148
    assert values["psu_temp_sys"] == 2302
    assert values["psu_ch_state_num"] == 0x7C
    assert [values[f"psu_ch{i}_state"] for i in range(7)] == [
        False,
        False,
        True,
        True,
        True,
        True,
        True,
    ]


def test_captured_other_fields_are_signed_and_named():
    mgs = bytes.fromhex(CAPTURES["MGS"])[1:-1]
    sol = bytes.fromhex(CAPTURES["SOL"])[1:-1]
    radio = bytes.fromhex(CAPTURES["U"])[1:-1]
    parser = TelemetryParser()

    assert parser.parse(mgs, protocol_hint="ax25")["telemetry"]["values"]["mgs_int_mag_y"] == -6749
    assert parser.parse(sol, protocol_hint="ax25")["telemetry"]["values"]["sol_temp_zp"] == 1612
    assert (
        parser.parse(radio, protocol_hint="ax25")["telemetry"]["values"]["uhf_last_digipeater"]
        == "DL7NDR"
    )


def test_missing_solar_value_is_null_and_malformed_beacons_have_no_measurements():
    parser = LasarsatAx25Parser()
    solar = parser.parse(b"SOL,nan,1,2,3,4,5,6,7,8,9,10,11\x00")
    assert solar["values"]["sol_temp_zp"] is None

    for payload in (b"PSU,4,1,2\x00", b"OBC,1,2,bad,4,5\x00", b"MGS,1,2,3,4,5,6,7,8\x00extra"):
        result = parser.parse(payload)
        assert result["format"] == "malformed"
        assert "values" not in result
