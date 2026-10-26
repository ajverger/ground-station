import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { ThemeProvider } from '@mui/material/styles';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../i18n/config.js';
import systemInfoReducer, { setSystemInfo } from '../settings/system-info-slice.jsx';
import { setupTheme } from '../../theme.js';
import ConnectionStatus from './connection-popover.jsx';

const { socketContext } = vi.hoisted(() => ({
    socketContext: {
        trafficStatsRef: {
            current: {
                engine: { bytesReceived: 0, bytesSent: 0, packetsReceived: 0, packetsSent: 0, upgradeAttempts: 0 },
                transport: { name: 'websocket' },
                manager: { reconnecting: false, reconnectAttempts: 0 },
                rates: { bytesPerSecond: { sent: 0, received: 0 }, packetsPerSecond: { sent: 0, received: 0 } },
                session: { duration: 0 },
            },
        },
        sampleTrafficStats: vi.fn(),
        setCollectStats: vi.fn(),
        transportName: 'websocket',
    },
}));

vi.mock('../common/socket.jsx', () => ({ useSocket: () => socketContext }));

const cpuInfo = (usage) => ({
    usage_percent: usage,
    cores: { physical: null, logical: null },
});

describe('connection popover refresh', () => {
    afterEach(() => {
        vi.useRealTimers();
        socketContext.sampleTrafficStats.mockReset();
        socketContext.setCollectStats.mockReset();
    });

    it('reads system info on the single open timer without rerendering for each socket message', () => {
        vi.useFakeTimers();
        socketContext.sampleTrafficStats.mockImplementation(() => socketContext.trafficStatsRef.current);
        const store = configureStore({ reducer: { systemInfo: systemInfoReducer } });
        const { unmount } = render(
            <Provider store={store}>
                <ThemeProvider theme={setupTheme()}>
                    <ConnectionStatus />
                </ThemeProvider>
            </Provider>
        );

        act(() => store.dispatch(setSystemInfo({ cpu: cpuInfo(12) })));
        expect(socketContext.sampleTrafficStats).not.toHaveBeenCalled();

        fireEvent.click(screen.getByTestId('LanIcon').closest('button'));
        expect(socketContext.setCollectStats).toHaveBeenCalledWith(true);
        expect(socketContext.sampleTrafficStats).toHaveBeenCalledTimes(1);
        expect(screen.getByText('12.0%')).toBeInTheDocument();

        act(() => store.dispatch(setSystemInfo({ cpu: cpuInfo(23) })));
        expect(socketContext.sampleTrafficStats).toHaveBeenCalledTimes(1);
        expect(screen.getByText('12.0%')).toBeInTheDocument();

        act(() => vi.advanceTimersByTime(1000));
        expect(socketContext.sampleTrafficStats).toHaveBeenCalledTimes(2);
        expect(screen.getByText('23.0%')).toBeInTheDocument();

        unmount();
        expect(socketContext.setCollectStats).toHaveBeenLastCalledWith(false);
        act(() => vi.advanceTimersByTime(1000));
        expect(socketContext.sampleTrafficStats).toHaveBeenCalledTimes(2);
    });
});
