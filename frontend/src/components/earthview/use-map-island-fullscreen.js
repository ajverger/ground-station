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

import {useCallback, useEffect, useRef, useState} from 'react';

const getFullscreenElement = () => (
    document.fullscreenElement
    || document.webkitFullscreenElement
    || document.mozFullScreenElement
    || document.msFullscreenElement
    || null
);

export default function useMapIslandFullscreen(onResize) {
    const islandRef = useRef(null);
    const onResizeRef = useRef(onResize);
    const fullscreenRef = useRef(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    onResizeRef.current = onResize;

    useEffect(() => {
        let resizeFrame;
        let resizeTimeout;

        const handleFullscreenChange = () => {
            const nextFullscreen = getFullscreenElement() === islandRef.current;
            if (nextFullscreen === fullscreenRef.current) return;

            fullscreenRef.current = nextFullscreen;
            setIsFullscreen(nextFullscreen);
            // Both engines need a size update after the island changes dimensions.
            cancelAnimationFrame(resizeFrame);
            clearTimeout(resizeTimeout);
            resizeFrame = requestAnimationFrame(() => onResizeRef.current?.());
            resizeTimeout = setTimeout(() => onResizeRef.current?.(), 120);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
            document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
            cancelAnimationFrame(resizeFrame);
            clearTimeout(resizeTimeout);
        };
    }, []);

    const toggleFullscreen = useCallback(() => {
        const island = islandRef.current;
        if (!island) return;
        if (getFullscreenElement() === island) {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
            else document.msExitFullscreen?.();
        } else {
            if (island.requestFullscreen) island.requestFullscreen();
            else if (island.webkitRequestFullscreen) island.webkitRequestFullscreen();
            else if (island.mozRequestFullScreen) island.mozRequestFullScreen();
            else island.msRequestFullscreen?.();
        }
    }, []);

    return {islandRef, isFullscreen, toggleFullscreen};
}
