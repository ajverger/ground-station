/**
 * @license
 * Copyright (c) 2026 Efstratios Goudelis
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {maplibregl} from './maplibre.js';

export const MAPLIBRE_COVERAGE_PADDING = Object.freeze({
    top: 40,
    right: 40,
    bottom: 72,
    left: 40,
});

export const MAPLIBRE_GLOBE_COVERAGE_PADDING = Object.freeze({
    top: 48,
    right: 48,
    bottom: 88,
    left: 48,
});

const MAPLIBRE_MAX_FIT_BOUNDS_LAT = 85.051129;
const GLOBE_FIT_MIN_CENTER_PIXELS = 3;
const GLOBE_FIT_MIN_ZOOM_DELTA = 0.005;

const normalizeCoveragePoint = (point) => {
    const lat = Number(Array.isArray(point) ? point[0] : point?.lat);
    const lon = Number(Array.isArray(point) ? point[1] : point?.lon ?? point?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90) return null;
    return [lat, lon];
};

/**
 * Fits a MapLibre camera to a satellite footprint. Both the tracking page and
 * satellite information maps use this function so padding, pole handling, and
 * world-copy behavior stay identical.
 */
export const fitMapLibreCoverage = ({map, coverage, globe = false}) => {
    if (!map || !Array.isArray(coverage)) return false;
    const fitBoundsPoints = coverage
        .map(normalizeCoveragePoint)
        .filter(Boolean)
        .map(([lat, lon]) => [
            lon,
            Math.max(-MAPLIBRE_MAX_FIT_BOUNDS_LAT, Math.min(MAPLIBRE_MAX_FIT_BOUNDS_LAT, lat)),
        ]);
    if (fitBoundsPoints.length < 2) return false;

    try {
        const bounds = fitBoundsPoints.reduce(
            (current, point) => current.extend(point),
            new maplibregl.LngLatBounds(fitBoundsPoints[0], fitBoundsPoints[0]),
        );
        const padding = globe ? MAPLIBRE_GLOBE_COVERAGE_PADDING : MAPLIBRE_COVERAGE_PADDING;
        if (globe && map.cameraForBounds && map.project && map.getCanvas && map.getZoom) {
            const camera = map.cameraForBounds(bounds, {padding});
            const canvas = map.getCanvas();
            const projectedCenter = camera?.center && map.project(camera.center);
            if (projectedCenter && canvas?.clientWidth > 0 && canvas?.clientHeight > 0) {
                const centerPixels = Math.hypot(
                    projectedCenter.x - canvas.clientWidth / 2,
                    projectedCenter.y - canvas.clientHeight / 2,
                );
                const zoomDelta = Math.abs(camera.zoom - map.getZoom());
                // Live tracker updates often move the desired globe camera by less
                // than a pixel. Avoid restarting a costly animation for that drift.
                if (centerPixels < GLOBE_FIT_MIN_CENTER_PIXELS && zoomDelta < GLOBE_FIT_MIN_ZOOM_DELTA) {
                    return true;
                }
            }
        }
        map.fitBounds(bounds, {
            padding,
            animate: globe,
            duration: globe ? 280 : 0,
        });
        return true;
    } catch (error) {
        console.warn('Satellite coverage fitBounds skipped due to invalid bounds:', error);
        return false;
    }
};
