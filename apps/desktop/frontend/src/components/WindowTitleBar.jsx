import { useEffect, useState } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import MinimizeIcon from '@mui/icons-material/Minimize';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import FilterNoneIcon from '@mui/icons-material/FilterNone';
import CloseIcon from '@mui/icons-material/Close';

export default function WindowTitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const api = typeof window !== 'undefined' ? window.electronAPI : null;

  useEffect(() => {
    if (!api?.windowIsMaximized) return undefined;
    api.windowIsMaximized().then(setIsMaximized).catch(() => {});
    const off = api.onWindowMaximized?.((next) => setIsMaximized(Boolean(next)));
    return typeof off === 'function' ? off : undefined;
  }, [api]);

  if (!api?.windowMinimize) return null;

  return (
    <Box
      sx={{
        height: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Box
        sx={{
          px: 1.25,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          userSelect: 'none',
          WebkitAppRegion: 'drag',
          flex: 1,
          minWidth: 0,
        }}
      >
        <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 600, letterSpacing: '-0.02em' }}>
          Test
          <Box component="span" sx={{ color: 'primary.main' }}>Blox</Box>
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'stretch', WebkitAppRegion: 'no-drag' }}>
        <IconButton size="small" onClick={() => api.windowMinimize()} sx={{ borderRadius: 0, width: 46 }}>
          <MinimizeIcon fontSize="inherit" />
        </IconButton>
        <IconButton size="small" onClick={() => api.windowToggleMaximize()} sx={{ borderRadius: 0, width: 46 }}>
          {isMaximized ? <FilterNoneIcon fontSize="inherit" /> : <CropSquareIcon fontSize="inherit" />}
        </IconButton>
        <IconButton
          size="small"
          onClick={() => api.windowClose()}
          sx={{
            borderRadius: 0,
            width: 46,
            '&:hover': { bgcolor: 'error.main', color: 'error.contrastText' },
          }}
        >
          <CloseIcon fontSize="inherit" />
        </IconButton>
      </Box>
    </Box>
  );
}
