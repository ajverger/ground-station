"""LASARSAT AX.25 information-field parser.

Field order follows the SatNOGS LASARSAT Kaitai schema:
https://gitlab.com/librespacefoundation/satnogs/satnogs-decoders/-/blob/master/ksy/lasarsat.ksy

The beacon contains ASCII integers, not binary floating-point measurements.
The published schema does not define engineering-unit scaling for these fields,
so values remain in their transmitted units.
"""

from __future__ import annotations

import re
from typing import Any

# The first column is the transmitted beacon identifier. Remaining columns
# follow the published schema's field order exactly.
BEACON_FIELDS = {
    "OBC": (
        "obc_reset_cnt",
        "obc_uptime",
        "obc_uptime_tot",
        "obc_temp_mcu",
        "obc_freemem",
    ),
    "PSU": (
        "psu_reset_cnt",
        "psu_uptime",
        "psu_uptime_tot",
        "psu_battery",
        "psu_temp_sys",
        "psu_temp_bat",
        "psu_cur_in",
        "psu_cur_out",
        "psu_ch_state_num",
        "psu_sys_state",
        "psu_gnd_wdt",
    ),
    "SOL": (
        "sol_temp_zp",
        "sol_temp_xp",
        "sol_temp_yp",
        "sol_temp_zn",
        "sol_temp_xn",
        "sol_temp_yn",
        "sol_diode_zp",
        "sol_diode_xp",
        "sol_diode_yp",
        "sol_diode_zn",
        "sol_diode_xn",
        "sol_diode_yn",
    ),
    "MGS": (
        "mgs_temp_int_mag",
        "mgs_temp_int_gyr",
        "mgs_int_mag_x",
        "mgs_int_mag_y",
        "mgs_int_mag_z",
        "mgs_int_gyr_x",
        "mgs_int_gyr_y",
        "mgs_int_gyr_z",
    ),
    "DOS": (
        "dos_mode",
        "dos_gyr_x",
        "dos_gyr_y",
        "dos_gyr_z",
        "dos_mag_x",
        "dos_mag_y",
        "dos_mag_z",
        "dos_plasma",
        "dos_phd",
        "dos_dozi",
        "dos_gyr_t",
        "dos_mag_t",
        "dos_lppa",
        "dos_bus_cur",
        "dos_bus_vol",
        "dos_uptime",
    ),
    "NAV": (
        "nav_week",
        "nav_time",
        "nav_pos_x",
        "nav_pos_y",
        "nav_pos_z",
        "nav_vel_x",
        "nav_vel_y",
        "nav_vel_z",
        "nav_sats",
        "nav_dop",
        "nav_ant_cur",
        "nav_volt",
        "nav_max_snr",
    ),
    "U": (
        "uhf_uptime",
        "uhf_uptime_tot",
        "uhf_reset_cnt",
        "uhf_rf_reset_cnt",
        "uhf_trx_temp",
        "uhf_rf_temp",
        "uhf_pa_temp",
        "uhf_digipeater_cnt",
        "uhf_last_digipeater",
        "uhf_rx_cnt",
        "uhf_tx_cnt",
        "uhf_act_rssi_raw",
        "uhf_dcd_rssi_raw",
    ),
    "V": (
        "vhf_uptime",
        "vhf_uptime_tot",
        "vhf_reset_cnt",
        "vhf_rf_reset_cnt",
        "vhf_trx_temp",
        "vhf_rf_temp",
        "vhf_pa_temp",
        "vhf_digipeater_cnt",
        "vhf_last_digipeater",
        "vhf_rx_cnt",
        "vhf_tx_cnt",
        "vhf_act_rssi_raw",
        "vhf_dcd_rssi_raw",
    ),
}


class LasarsatAx25Parser:
    """Decode a LASARSAT beacon after AX.25 addresses, control, and PID."""

    def parse(self, payload: bytes) -> dict[str, Any]:
        result: dict[str, Any] = {"satellite": "LASARSAT", "length": len(payload)}

        # The radio terminates beacon text with NUL. Reject embedded NULs so
        # a damaged or concatenated packet cannot yield plausible values.
        body = payload.removesuffix(b"\x00")
        try:
            beacon = body.decode("ascii")
        except UnicodeDecodeError:
            return {**result, "format": "raw", "hex": payload.hex()}

        kind, _, _ = beacon.partition(",")
        fields = BEACON_FIELDS.get(kind)
        if fields is None:
            return {**result, "format": "text", "text": beacon}

        values_text = beacon.split(",")[1:]
        if len(values_text) != len(fields) or "\x00" in beacon:
            return {
                **result,
                "format": "malformed",
                "type": kind,
                "error": f"Expected {len(fields)} {kind} fields, received {len(values_text)}",
                "text": beacon,
            }

        values: dict[str, Any] = {}
        for name, value in zip(fields, values_text):
            if name in ("uhf_last_digipeater", "vhf_last_digipeater"):
                values[name] = value
            elif name == "psu_ch_state_num":
                if not re.fullmatch(r"[0-9A-Fa-f]+", value):
                    return self._invalid(result, kind, name, value)
                values[name] = int(value, 16)
            elif kind == "SOL" and value == "nan":
                # The source schema uses -32768 as a missing-value sentinel.
                # A JSON null keeps it distinct from an actual sensor reading.
                values[name] = None
            elif re.fullmatch(r"[+-]?\d+", value):
                values[name] = int(value)
            else:
                return self._invalid(result, kind, name, value)

        if kind == "PSU":
            # The channel-state field is hexadecimal; bit 0 corresponds to CH0.
            state = values["psu_ch_state_num"]
            for channel in range(7):
                values[f"psu_ch{channel}_state"] = bool(state & (1 << channel))

        return {**result, "format": "beacon", "type": kind, "values": values}

    @staticmethod
    def _invalid(result: dict[str, Any], kind: str, name: str, value: str) -> dict[str, Any]:
        return {
            **result,
            "format": "malformed",
            "type": kind,
            "error": f"Invalid {name}: {value!r}",
        }
