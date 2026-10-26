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
 *
 */

import {createSelector} from '@reduxjs/toolkit';
import {getSatelliteCoverageCircle} from '../common/tracking-logic.jsx';


const normalizeTargetType = (trackingState = {}) => {
    const explicitType = String(trackingState?.target_type || '').trim().toLowerCase();
    if (explicitType === 'satellite' || explicitType === 'mission' || explicitType === 'body') {
        return explicitType;
    }
    if (trackingState?.command) {
        return 'mission';
    }
    if (trackingState?.body_id) {
        return 'body';
    }
    return 'satellite';
};

export const trackingStateSelector = (state) => state.targetSatTrack.trackingState || {};
export const targetTypeSelector = (state) => normalizeTargetType(trackingStateSelector(state));
export const targetIdentifierSelector = (state) => {
    const trackingState = trackingStateSelector(state);
    const targetType = normalizeTargetType(trackingState);
    if (targetType === 'mission') {
        return String(trackingState?.command || '').trim();
    }
    if (targetType === 'body') {
        return String(trackingState?.body_id || '').trim().toLowerCase();
    }
    return String(trackingState?.norad_id || '').trim();
};

export const satellitePositionSelector = state => state.targetSatTrack.satelliteData.position;
export const satellitePathsSelector = state => state.targetSatTrack.satelliteData.paths;
export const satelliteCoverageSelector = createSelector(
    [satellitePositionSelector, targetTypeSelector, state => state.targetSatTrack.satelliteData.details?.norad_id],
    (position, targetType, noradId) => {
        const lat = Number(position?.lat);
        const lon = Number(position?.lon ?? position?.lng);
        const altitudeMeters = Number(position?.alt);
        if (targetType !== 'satellite' || !noradId
            || !Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(altitudeMeters)) {
            return [];
        }
        // Only mounted map consumers select this polygon. All other pages avoid
        // calculating or receiving its 300 points on each tracking tick.
        return getSatelliteCoverageCircle(lat, lon, altitudeMeters / 1000, 300)
            .map(point => [point.lat, point.lon]);
    },
);
export const satelliteTrackingStateSelector = state => state.targetSatTrack.trackingState;
export const satelliteDetailsSelector = state => state.targetSatTrack.satelliteData.details;
export const satelliteTransmittersSelector = state => state.targetSatTrack.satelliteData.transmitters;
