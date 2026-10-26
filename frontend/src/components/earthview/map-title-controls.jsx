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

import {Box, IconButton, Tooltip} from '@mui/material';
import FilterCenterFocusIcon from '@mui/icons-material/FilterCenterFocus';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import HomeIcon from '@mui/icons-material/Home';
import SettingsIcon from '@mui/icons-material/Settings';
import {useTranslation} from 'react-i18next';

// Match the compact outlined icon group in the tracking map title bar.
const actionButtonSx = {
    width: 24,
    height: 24,
    p: 0.25,
    border: '1px solid',
    borderColor: 'primary.main',
    borderRadius: 1,
    color: 'primary.main',
    bgcolor: 'transparent',
    '&:hover': {bgcolor: 'action.hover'},
};

export default function MapTitleControls({homeDisabled, isFullscreen, onHome, onCenter, onFullscreen, onSettings, tooltipContainer}) {
    const {t} = useTranslation('earthview');
    const homeLabel = t('map_controls.go_home');
    const centerLabel = t('map_controls.go_to_center');
    const fullscreenLabel = isFullscreen ? t('map_controls.exit_fullscreen') : t('map_controls.go_fullscreen');
    const tooltipSlotProps = {popper: {container: tooltipContainer}};

    return (
        <Box
            sx={{display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0}}
            onMouseDown={(event) => event.stopPropagation()}
            onTouchStart={(event) => event.stopPropagation()}
        >
            <Box role="group" aria-label={t('title')} sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                <Tooltip title={homeLabel} slotProps={tooltipSlotProps}>
                    <span style={{display: 'inline-flex'}}>
                        <IconButton size="small" sx={actionButtonSx} aria-label={homeLabel} onClick={onHome} disabled={homeDisabled}>
                            <HomeIcon sx={{fontSize: 16}} />
                        </IconButton>
                    </span>
                </Tooltip>
                <Tooltip title={centerLabel} slotProps={tooltipSlotProps}>
                    <IconButton size="small" sx={actionButtonSx} aria-label={centerLabel} onClick={onCenter}>
                        <FilterCenterFocusIcon sx={{fontSize: 16}} />
                    </IconButton>
                </Tooltip>
                <Tooltip title={fullscreenLabel} slotProps={tooltipSlotProps}>
                    <IconButton
                        size="small"
                        aria-label={fullscreenLabel}
                        aria-pressed={isFullscreen}
                        onClick={onFullscreen}
                        sx={{
                            ...actionButtonSx,
                            ...(isFullscreen && {
                                color: 'primary.contrastText',
                                bgcolor: 'primary.main',
                                '&:hover': {bgcolor: 'primary.dark'},
                            }),
                        }}
                    >
                        {isFullscreen ? <FullscreenExitIcon sx={{fontSize: 16}} /> : <FullscreenIcon sx={{fontSize: 16}} />}
                    </IconButton>
                </Tooltip>
            </Box>
            <Tooltip title={t('map_settings.title')} slotProps={tooltipSlotProps}>
                <IconButton size="small" sx={{p: '2px'}} aria-label={t('map_settings.title')} onClick={onSettings}>
                    <SettingsIcon fontSize="small" />
                </IconButton>
            </Tooltip>
        </Box>
    );
}
