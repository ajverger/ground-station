import React from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import '../../i18n/config.js';
import MapTitleControls from './map-title-controls.jsx';
import useMapIslandFullscreen from './use-map-island-fullscreen.js';

function MapIslandHarness({onResize}) {
    const {islandRef, isFullscreen, toggleFullscreen} = useMapIslandFullscreen(onResize);

    return (
        <div ref={islandRef} data-testid="map-island">
            <header>
                <MapTitleControls
                    homeDisabled={false}
                    isFullscreen={isFullscreen}
                    onHome={() => {}}
                    onCenter={() => {}}
                    onFullscreen={toggleFullscreen}
                    onSettings={() => {}}
                />
            </header>
            <div data-testid="map-viewport" />
        </div>
    );
}

describe('Earth View map island controls', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('fullscreens the island and keeps its title controls available after an Escape exit', () => {
        let fullscreenElement = null;
        const requestFullscreen = vi.fn(function requestFullscreen() {
            fullscreenElement = this;
            document.dispatchEvent(new Event('fullscreenchange'));
        });
        const exitFullscreen = vi.fn(() => {
            fullscreenElement = null;
            document.dispatchEvent(new Event('fullscreenchange'));
        });
        const originalFullscreenElement = Object.getOwnPropertyDescriptor(document, 'fullscreenElement');
        const originalExitFullscreen = Object.getOwnPropertyDescriptor(document, 'exitFullscreen');
        const originalRequestFullscreen = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'requestFullscreen');
        Object.defineProperty(document, 'fullscreenElement', {
            configurable: true,
            get: () => fullscreenElement,
        });
        Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
            configurable: true,
            value: requestFullscreen,
        });
        Object.defineProperty(document, 'exitFullscreen', {
            configurable: true,
            value: exitFullscreen,
        });
        vi.stubGlobal('requestAnimationFrame', (callback) => {
            callback();
            return 1;
        });
        vi.stubGlobal('cancelAnimationFrame', vi.fn());

        const onResize = vi.fn();
        try {
            render(<MapIslandHarness onResize={onResize} />);
            const island = screen.getByTestId('map-island');
            const controls = screen.getByRole('group');
            expect(island).toContainElement(controls);
            expect(island).toContainElement(screen.getByTestId('map-viewport'));

            fireEvent.click(screen.getByRole('button', {name: 'Go fullscreen'}));
            expect(requestFullscreen.mock.instances[0]).toBe(island);
            expect(onResize).toHaveBeenCalled();
            expect(screen.getByRole('button', {name: 'Exit fullscreen'})).toBeInTheDocument();

            // The browser can leave fullscreen through Escape without clicking the button.
            act(() => {
                fullscreenElement = null;
                document.dispatchEvent(new Event('fullscreenchange'));
            });
            expect(screen.getByRole('button', {name: 'Go fullscreen'})).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', {name: 'Go fullscreen'}));
            fireEvent.click(screen.getByRole('button', {name: 'Exit fullscreen'}));
            expect(exitFullscreen).toHaveBeenCalledOnce();
        } finally {
            if (originalFullscreenElement) {
                Object.defineProperty(document, 'fullscreenElement', originalFullscreenElement);
            } else {
                delete document.fullscreenElement;
            }
            if (originalExitFullscreen) {
                Object.defineProperty(document, 'exitFullscreen', originalExitFullscreen);
            } else {
                delete document.exitFullscreen;
            }
            if (originalRequestFullscreen) {
                Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', originalRequestFullscreen);
            } else {
                delete HTMLElement.prototype.requestFullscreen;
            }
        }
    });
});
