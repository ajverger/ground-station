/**
 * @license
 * Copyright (c) 2026 Efstratios Goudelis
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

import React from 'react';
import { Box } from '@mui/material';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { orderNavigationStatuses, selectTrackingNavigationStatus } from '../components/common/hardware-status.js';
import { resolveTabLedPresentation } from '../components/common/hardware-status-presentation.jsx';

const EMPTY_INSTANCES = [];
const EMPTY_VIEWS = {};

const useTrackingNavigationStatus = () => {
    const instances = useSelector((state) => state.trackerInstances?.instances || EMPTY_INSTANCES);
    const trackerViews = useSelector((state) => state.targetSatTrack?.trackerViews || EMPTY_VIEWS);
    const connected = useSelector((state) => Boolean(state.dashboard?.connected));
    const connectedAt = useSelector((state) => state.dashboard?.connectedAt || 0);
    const [now, setNow] = React.useState(Date.now());

    // A quiet socket still needs the sidebar to expire old hardware reports.
    React.useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 5000);
        return () => window.clearInterval(timer);
    }, []);

    return React.useMemo(() => selectTrackingNavigationStatus({
        trackerInstances: { instances },
        targetSatTrack: { trackerViews },
        dashboard: { connected, connectedAt },
    }, Date.now()), [instances, trackerViews, connected, connectedAt, now]);
};

const StatusBadge = ({ type, summary, t }) => {
    if (!summary.assignedCount) return null;
    const { Icon, bgColor, borderColor, iconColor } = resolveTabLedPresentation({
        source: type,
        status: summary.status,
        t,
    });

    return (
        <Box
            aria-hidden="true"
            data-testid={`tracking-${type}-status`}
            data-status={summary.status}
            sx={{
                position: 'absolute',
                [type === 'rotator' ? 'top' : 'bottom']: -4,
                right: -4,
                width: 13,
                height: 13,
                borderRadius: '50%',
                bgcolor: bgColor,
                border: '1px solid',
                borderColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                zIndex: 1,
            }}
        >
            {Icon && <Icon sx={{ fontSize: 9, color: iconColor }} />}
        </Box>
    );
};

export const TrackingIconWithStatus = () => {
    const { t } = useTranslation('target');
    const summary = useTrackingNavigationStatus();

    return (
        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
            <GpsFixedIcon aria-hidden="true" />
            <StatusBadge type="rotator" summary={summary.rotator} t={t} />
            <StatusBadge type="rig" summary={summary.rig} t={t} />
        </Box>
    );
};

export const TrackingStatusTooltip = () => {
    const { t } = useTranslation('target');
    const summary = useTrackingNavigationStatus();
    const connected = useSelector((state) => Boolean(state.dashboard?.connected));
    const lines = [];

    for (const type of ['rotator', 'rig']) {
        const hardware = summary[type];
        if (!hardware.assignedCount) continue;
        const statuses = orderNavigationStatuses(Object.keys(hardware.counts));
        lines.push(statuses.map((status) => {
            const { label } = resolveTabLedPresentation({ source: type, status, t });
            const count = hardware.counts[status];
            return hardware.assignedCount > 1 ? `${label} ×${count}` : label;
        }).join(', '));
    }

    return (
        <Box>
            <Box>{t('live_tracking', { ns: 'navigation', defaultValue: 'Live Tracking' })}</Box>
            {!connected && lines.length > 0 && (
                <Box>{t('hardware_popover.socket_disconnected', { ns: 'dashboard', defaultValue: 'Socket: Disconnected' })}</Box>
            )}
            {lines.map((line, index) => <Box key={index}>{line}</Box>)}
        </Box>
    );
};
