import {describe, expect, it} from 'vitest';
import reducer, {setSatelliteContext, setSatelliteData, setTrackerId} from '../target-slice.jsx';
import {satelliteCoverageSelector} from '../state-selectors.jsx';
import {getSatelliteCoverageCircle} from '../../common/tracking-logic.jsx';

describe('split tracking context', () => {
    it('does not restore old tracking controls from a context response', () => {
        let state = reducer(undefined, {type: '@@init'});
        state = reducer(state, setTrackerId('target-1'));
        const currentState = {target_type: 'satellite', norad_id: 25544, rig_vfo: 'B', group_id: 'current'};
        state = reducer(state, setSatelliteData({
            tracker_id: 'target-1', context_key: 'satellite:25544', context_revision: 10,
            tracking_state: currentState,
            satellite_data: {position: {lat: 1, lon: 2, alt: 400000}},
        }));
        state = reducer(state, setSatelliteContext({
            tracker_id: 'target-1', context_key: 'satellite:25544', context_revision: 10,
            tracking_state: {target_type: 'satellite', norad_id: 25544, rig_vfo: 'A', group_id: 'old'},
            satellite_data: {details: {norad_id: 25544, name: 'ISS'}},
        }));
        expect(state.trackingState).toEqual(currentState);
        expect(state.trackerViews['target-1'].trackingState).toEqual(currentState);
        expect(state.trackerViews['target-1'].selectedRigVFO).toBe('B');
    });

    it('keeps paths through live ticks and transmitter edits, then clears them on a target switch', () => {
        let state = reducer(undefined, {type: '@@init'});
        state = reducer(state, setTrackerId('target-1'));
        const trackingState = {target_type: 'satellite', norad_id: 25544};
        const paths = {past: [[{lat: 1, lon: 2}]], future: []};
        state = reducer(state, setSatelliteContext({
            tracker_id: 'target-1', context_key: 'satellite:25544', context_revision: 10,
            tracking_state: trackingState,
            satellite_data: {
                details: {norad_id: 25544, name: 'ISS', tle1: 'line 1'},
                paths,
                transmitters: [{id: 'tx-1', mode: 'FM'}],
            },
        }));
        state = reducer(state, setSatelliteData({
            tracker_id: 'target-1', context_key: 'satellite:25544', context_revision: 10,
            tracking_state: trackingState,
            satellite_data: {position: {lat: 1, lon: 2, alt: 400000, az: 3, el: 4}, details: {norad_id: 25544, name: 'ISS'}},
        }));
        expect(state.satelliteData.paths).toEqual(paths);
        expect(state.satelliteData.details.tle1).toBe('line 1');
        expect(state.trackerViews['target-1'].contextData.paths).toEqual(paths);
        expect(satelliteCoverageSelector({targetSatTrack: state})).toHaveLength(301);

        state = reducer(state, setSatelliteContext({
            tracker_id: 'target-1', context_key: 'satellite:25544', context_revision: 11,
            satellite_data: {transmitters: [{id: 'tx-1', mode: 'SSB'}]},
        }));
        expect(state.satelliteData.paths).toEqual(paths);
        expect(state.satelliteData.transmitters[0].mode).toBe('SSB');

        state = reducer(state, setSatelliteContext({
            tracker_id: 'target-1', context_key: 'satellite:25544', context_revision: 9,
            satellite_data: {transmitters: [{id: 'tx-1', mode: 'FM'}]},
        }));
        expect(state.satelliteData.transmitters[0].mode).toBe('SSB');

        state = reducer(state, setSatelliteData({
            tracker_id: 'target-1', context_key: 'satellite:12345', context_revision: 12,
            tracking_state: {target_type: 'satellite', norad_id: 12345},
            satellite_data: {position: {lat: 5, lon: 6, alt: 500000}, details: {norad_id: 12345, name: 'New'}},
        }));
        expect(state.satelliteData.paths).toEqual({past: [], future: []});
        expect(state.satelliteData.details.tle1).toBe('');
        expect(state.trackerViews['target-1'].contextData).toEqual({});

        state = reducer(state, setSatelliteData({
            tracker_id: 'target-1', context_key: 'satellite:25544', context_revision: 11,
            tracking_state: trackingState,
            satellite_data: {position: {lat: 1, lon: 2, alt: 400000}},
        }));
        expect(state.satelliteData.details.norad_id).toBe(12345);
    });

    it('matches the backend footprint at the poles', () => {
        const north = getSatelliteCoverageCircle(75, 20, 35786, 8);
        const south = getSatelliteCoverageCircle(-75, 20, 35786, 8);
        expect(north).toHaveLength(10);
        expect(north[0].lat).toBe(90);
        expect(north[0].lon).toBeCloseTo(152.29946368895835, 8);
        expect(north.at(-1)).toEqual({lat: 90, lon: -160});
        expect(south).toHaveLength(11);
        expect(south[5]).toEqual({lat: -90, lon: 200});
        expect(south[6].lat).toBe(-90);
        expect(south[6].lon).toBeCloseTo(-112.29946368895835, 8);
    });
});
