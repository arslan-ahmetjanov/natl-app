import { Box, Button, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

/**
 * Standard screen top row: Back + title + optional right slot.
 */
export default function ScreenHeader({ title, onBack, backLabel = 'Back', actions = null, sx }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        mb: 2,
        flexWrap: 'wrap',
        ...sx,
      }}
    >
      {onBack && (
        <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ color: 'primary.main' }}>
          {backLabel}
        </Button>
      )}
      <Typography variant="h6" sx={{ color: 'text.primary', flex: 1, minWidth: 120 }}>
        {title}
      </Typography>
      {actions}
    </Box>
  );
}
