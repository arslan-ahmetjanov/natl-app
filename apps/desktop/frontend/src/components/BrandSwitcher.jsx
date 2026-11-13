import { useState } from 'react';
import {
  Box,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import PaletteIcon from '@mui/icons-material/Palette';
import CheckIcon from '@mui/icons-material/Check';
import { BRANDS } from '../themes';

function Swatch({ colors }) {
  return (
    <Box sx={{ display: 'flex', gap: 0.25 }}>
      {colors.map((color) => (
        <Box
          key={color}
          sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color, border: '1px solid rgba(0,0,0,.15)' }}
        />
      ))}
    </Box>
  );
}

/** Переключатель миров: пять брендов, выбор сохраняется. */
export default function BrandSwitcher({ brand, onChange }) {
  const [anchor, setAnchor] = useState(null);

  return (
    <>
      <Tooltip title="Сменить мир">
        <IconButton
          size="small"
          onClick={(event) => setAnchor(event.currentTarget)}
          aria-label="Сменить мир"
        >
          <PaletteIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 280, mt: 0.5 } } }}
      >
        {BRANDS.map((item) => (
          <MenuItem
            key={item.id}
            selected={item.id === brand}
            onClick={() => {
              onChange(item.id);
              setAnchor(null);
            }}
            sx={{ py: 1 }}
          >
            <ListItemIcon sx={{ minWidth: 34 }}>
              <Swatch colors={item.swatch} />
            </ListItemIcon>
            <ListItemText
              primary={item.name}
              secondary={item.hint}
              slotProps={{
                primary: { fontWeight: 600, fontSize: 14 },
                secondary: { fontSize: 11 },
              }}
            />
            {item.id === brand && <CheckIcon fontSize="small" sx={{ color: 'primary.main', ml: 1 }} />}
          </MenuItem>
        ))}
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Мир меняет палитру, шрифт и эффекты интерфейса.
          </Typography>
        </Box>
      </Menu>
    </>
  );
}
