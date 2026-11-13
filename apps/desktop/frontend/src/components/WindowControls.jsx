import { useEffect, useState } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import MinimizeIcon from '@mui/icons-material/Minimize';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import FilterNoneIcon from '@mui/icons-material/FilterNone';
import CloseIcon from '@mui/icons-material/Close';

/**
 * Единственная верхняя панель приложения: заголовок, слот действий
 * и кнопки управления окном. Второй шапки быть не должно.
 */
export default function WindowControls({ title = 'NATL', subtitle, right = null }) {
  const [isMaximized, setIsMaximized] = useState(false);
  const api = typeof window !== 'undefined' ? window.electronAPI : null;

  useEffect(() => {
    if (!api?.windowIsMaximized) return undefined;
    api.windowIsMaximized().then(setIsMaximized).catch(() => {});
    const off = api.onWindowMaximized?.((next) => setIsMaximized(Boolean(next)));
    return typeof off === 'function' ? off : undefined;
  }, [api]);

  return (
    <Box
      sx={{
        height: 48,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        flexShrink: 0,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 1.5,
          flex: 1,
          minWidth: 0,
          userSelect: 'none',
          WebkitAppRegion: 'drag',
        }}
      >
        <Typography sx={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, letterSpacing: '0.14em', fontSize: 13 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" sx={{ color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {subtitle}
          </Typography>
        )}
      </Box>

      {right && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, WebkitAppRegion: 'no-drag' }}>
          {right}
        </Box>
      )}

      {api?.windowMinimize && (
        <Box sx={{ display: 'flex', alignItems: 'stretch', WebkitAppRegion: 'no-drag', ml: 0.5 }}>
          <IconButton size="small" onClick={() => api.windowMinimize()} sx={{ borderRadius: 1, width: 36 }} aria-label="Свернуть">
            <MinimizeIcon fontSize="inherit" />
          </IconButton>
          <IconButton size="small" onClick={() => api.windowToggleMaximize()} sx={{ borderRadius: 1, width: 36 }} aria-label="Развернуть">
            {isMaximized ? <FilterNoneIcon fontSize="inherit" /> : <CropSquareIcon fontSize="inherit" />}
          </IconButton>
          <IconButton
            size="small"
            onClick={() => api.windowClose()}
            sx={{ borderRadius: 1, width: 36, '&:hover': { bgcolor: 'error.main', color: 'error.contrastText' } }}
            aria-label="Закрыть"
          >
            <CloseIcon fontSize="inherit" />
          </IconButton>
        </Box>
      )}
    </Box>
  );
}
