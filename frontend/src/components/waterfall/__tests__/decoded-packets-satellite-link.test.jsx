/**
 * @license
 * Copyright (c) 2026 Efstratios Goudelis
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { Provider } from 'react-redux';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../../i18n/config.js';
import DecodedPacketsDrawer from '../decoded-packets-drawer.jsx';

const socket = vi.hoisted(() => ({ emit: vi.fn(), on: vi.fn(), off: vi.fn() }));

vi.mock('../../common/socket.jsx', () => ({ useSocket: () => ({ socket }) }));
vi.mock('../../filebrowser/telemetry-viewer-dialog.jsx', () => ({ default: () => null }));
vi.mock('../../satellites/satellite-info-page.jsx', () => ({
    SatelliteInfoDialog: ({ open, onClose, satelliteData }) => open && (
        <div role="dialog">
            <span>{satelliteData.name}</span>
            <span>{satelliteData.transmitters[0]?.description}</span>
            <button type="button" onClick={onClose}>Close details</button>
        </div>
    ),
}));
// Render the real From cell without DataGrid virtualization in JSDOM.
vi.mock('@mui/x-data-grid', () => ({
    gridClasses: { cell: 'MuiDataGrid-cell', columnHeader: 'MuiDataGrid-columnHeader' },
    DataGrid: ({ rows, columns }) => {
        const fromColumn = columns.find((column) => column.field === 'from');
        return <div>{rows.map((row) => <div key={row.id}>{fromColumn.renderCell({ row, value: row.from })}</div>)}</div>;
    },
}));

const theme = createTheme({ palette: { border: { main: '#888' } } });
const outputs = [
    {
        id: 'linked', type: 'decoder-output', decoder_type: 'lora', timestamp: 2,
        output: { satellite: { norad_id: 12345, name: 'TinyGS Sat' } },
    },
    {
        id: 'unlinked', type: 'decoder-output', decoder_type: 'lora', timestamp: 1,
        output: { satellite: { name: 'No NORAD' } },
    },
];

const renderDrawer = (isStreaming) => {
    const store = configureStore({
        reducer: {
            decoders: () => ({ outputs }),
            waterfall: () => ({ packetsDrawerOpen: true, packetsDrawerHeight: 300, isStreaming }),
        },
    });
    render(
        <Provider store={store}>
            <ThemeProvider theme={theme}>
                <DecodedPacketsDrawer embedded />
            </ThemeProvider>
        </Provider>,
    );
};

describe('decoded LoRa satellite link', () => {
    beforeEach(() => {
        socket.emit.mockReset();
        socket.emit.mockImplementation((_event, request, acknowledge) => {
            acknowledge({
                success: true,
                data: {
                    details: { norad_id: request.data, name: 'Catalog Sat' },
                    transmitters: [{ description: 'Catalog transmitter' }],
                },
            });
        });
    });

    it.each([false, true])('opens shared satellite details from the From link (streaming: %s)', async (isStreaming) => {
        renderDrawer(isStreaming);

        const tooltipText = 'Satellite identity was inferred from the locked transmitter you selected because this packet has no callsign.';
        fireEvent.mouseOver(screen.getAllByLabelText(tooltipText)[0]);
        expect(await screen.findByRole('tooltip')).toHaveTextContent(tooltipText);
        expect(screen.getByText('(No NORAD)')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '(No NORAD)' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '(TinyGS Sat)' }));

        await waitFor(() => expect(socket.emit).toHaveBeenCalledWith(
            'api.call',
            { cmd: 'get-satellite', data: 12345 },
            expect.any(Function),
        ));
        expect(await screen.findByRole('dialog')).toHaveTextContent('Catalog Sat');
        expect(screen.getByRole('dialog')).toHaveTextContent('Catalog transmitter');
    });
});
