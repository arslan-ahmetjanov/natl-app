import {
  Box,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';

/** Left column: every scenario file in the workspace. */
export default function ScenarioList({
  scenarios,
  query,
  onQueryChange,
  activePath,
  onOpen,
  onRefresh,
  onRecord,
}) {
  return (
    <Paper
      sx={{
        width: 260,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box sx={{ p: 1.25, pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <Typography variant="subtitle2" sx={{ flex: 1 }}>Сценарии</Typography>
          <Tooltip title="Обновить">
            <IconButton size="small" onClick={onRefresh} aria-label="Обновить список">
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Записать сценарий">
            <IconButton size="small" onClick={onRecord} aria-label="Записать сценарий">
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <TextField
          size="small"
          fullWidth
          placeholder="Поиск"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </Box>
      <Divider />
      <List dense sx={{ overflow: 'auto', flex: 1 }}>
        {scenarios.map((scenario) => (
          <ListItemButton
            key={scenario.relativePath}
            selected={activePath === scenario.relativePath}
            onClick={() => onOpen(scenario)}
          >
            <ListItemText
              primary={scenario.name}
              secondary={scenario.relativePath}
              slotProps={{
                primary: { noWrap: true },
                secondary: { noWrap: true, sx: { fontSize: 11 } },
              }}
            />
          </ListItemButton>
        ))}
        {scenarios.length === 0 && (
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Ничего не найдено.
            </Typography>
          </Box>
        )}
      </List>
    </Paper>
  );
}
