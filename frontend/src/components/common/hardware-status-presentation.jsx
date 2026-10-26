/**
 * @license
 * Copyright (c) 2025 Efstratios Goudelis
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import CloseIcon from '@mui/icons-material/Close';
import LocationSearchingIcon from '@mui/icons-material/LocationSearching';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import WarningIcon from '@mui/icons-material/Warning';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

// The LED label table lives at module level, where the `useTranslation` hook cannot
// be called, so the active `t` function is supplied by the caller.
export const resolveTabLedPresentation = ({ source, status, usedRigFallback, t }) => {
    const bySource = {
        rotator: {
            none: {
                label: t('target_selector_bar.no_rotator', { defaultValue: 'No rotator' }),
                bgColor: 'action.disabled',
                borderColor: 'action.disabledBackground',
                Icon: null,
                iconColor: 'text.disabled',
            },
            disconnected: {
                label: t('target_selector_bar.rotator_disconnected', { defaultValue: 'Rotator disconnected' }),
                // Neutral gray: disconnected is not an error state.
                bgColor: 'action.disabled',
                borderColor: 'action.disabledBackground',
                Icon: CloseIcon,
                iconColor: 'text.disabled',
            },
            parked: {
                label: t('target_selector_bar.rotator_parked', { defaultValue: 'Rotator parked' }),
                bgColor: 'warning.main',
                borderColor: 'warning.dark',
                Icon: LocalParkingIcon,
                iconColor: 'common.white',
            },
            outofbounds: {
                label: t('target_selector_bar.rotator_out_of_bounds', { defaultValue: 'Rotator out of bounds' }),
                bgColor: 'secondary.main',
                borderColor: 'secondary.dark',
                Icon: WarningIcon,
                iconColor: 'common.white',
            },
            minelevation: {
                label: t('target_selector_bar.below_minimum_elevation', { defaultValue: 'Below minimum elevation' }),
                bgColor: 'error.light',
                borderColor: 'error.main',
                Icon: ArrowDownwardIcon,
                iconColor: 'common.white',
            },
            slewing: {
                label: t('target_selector_bar.rotator_slewing', { defaultValue: 'Rotator slewing' }),
                bgColor: 'warning.main',
                borderColor: 'warning.dark',
                Icon: PlayArrowIcon,
                iconColor: 'common.white',
            },
            tracking: {
                label: t('target_selector_bar.rotator_tracking', { defaultValue: 'Rotator tracking' }),
                bgColor: 'success.light',
                borderColor: 'success.main',
                Icon: LocationSearchingIcon,
                iconColor: 'common.white',
            },
            stopped: {
                label: t('target_selector_bar.rotator_stopped', { defaultValue: 'Rotator stopped' }),
                // Neutral informational state (not warning/error).
                bgColor: 'info.light',
                borderColor: 'info.main',
                Icon: PauseIcon,
                iconColor: 'common.white',
            },
            motion_unconfirmed: {
                label: t('target_selector_bar.rotator_motion_unconfirmed', { defaultValue: 'Rotator motion unconfirmed' }),
                bgColor: 'warning.main',
                borderColor: 'warning.dark',
                Icon: WarningIcon,
                iconColor: 'common.white',
            },
            connected: {
                label: t('target_selector_bar.rotator_connected', { defaultValue: 'Rotator connected' }),
                bgColor: 'success.dark',
                borderColor: 'success.main',
                Icon: null,
                iconColor: 'common.white',
            },
            unknown: {
                label: t('target_selector_bar.rotator_status_unknown', { defaultValue: 'Rotator status unknown' }),
                bgColor: 'action.disabled',
                borderColor: 'action.disabledBackground',
                Icon: null,
                iconColor: 'text.disabled',
            },
        },
        rig: {
            none: {
                label: t('target_selector_bar.no_rig', { defaultValue: 'No rig' }),
                bgColor: 'action.disabled',
                borderColor: 'action.disabledBackground',
                Icon: null,
                iconColor: 'text.disabled',
            },
            disconnected: {
                label: t('target_selector_bar.rig_disconnected', { defaultValue: 'Rig disconnected' }),
                bgColor: 'action.disabled',
                borderColor: 'action.disabledBackground',
                Icon: CloseIcon,
                iconColor: 'text.disabled',
            },
            tracking: {
                label: t('target_selector_bar.rig_tracking', { defaultValue: 'Rig tracking' }),
                bgColor: 'success.light',
                borderColor: 'success.main',
                Icon: LocationSearchingIcon,
                iconColor: 'common.white',
            },
            stopped: {
                label: t('target_selector_bar.rig_stopped', { defaultValue: 'Rig stopped' }),
                bgColor: 'info.light',
                borderColor: 'info.main',
                Icon: PauseIcon,
                iconColor: 'common.white',
            },
            connected: {
                label: t('target_selector_bar.rig_connected', { defaultValue: 'Rig connected' }),
                bgColor: 'success.dark',
                borderColor: 'success.main',
                Icon: null,
                iconColor: 'common.white',
            },
            unknown: {
                label: t('target_selector_bar.rig_status_unknown', { defaultValue: 'Rig status unknown' }),
                bgColor: 'action.disabled',
                borderColor: 'action.disabledBackground',
                Icon: null,
                iconColor: 'text.disabled',
            },
        },
    };

    const fallback = bySource[source]?.unknown || bySource.rig.unknown;
    const resolved = bySource[source]?.[status] || fallback;
    return {
        ...resolved,
        label: usedRigFallback ? `${resolved.label} (rig fallback)` : resolved.label,
        fallbackSource: source,
    };
};
