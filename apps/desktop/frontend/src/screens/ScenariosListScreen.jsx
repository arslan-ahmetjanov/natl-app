import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

/** Экран списка: все сценарии рабочей папки. */
export default function ScenariosListScreen({ onOpen, onRecord, refreshToken = 0 }) {
  const [scenarios, setScenarios] = useState([]);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const api = window.electronAPI;

  const load = useCallback(async () => {
    try {
      setScenarios((await api.natlListScenarios()) || []);
      setError(null);
    } catch (err) {
      setError(err && err.message ? err.message : String(err));
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load, refreshToken]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return scenarios;
    return scenarios.filter(
      (item) =>
        item.name.toLowerCase().includes(needle) || item.relativePath.toLowerCase().includes(needle),
    );
  }, [scenarios, query]);

  return (
    <Box sx={{ p: 2, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="h6" sx={{ flex: 1 }}>Сценарии</Typography>
        <TextField
          size="small"
          placeholder="Поиск"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          sx={{ width: 240 }}
        />
        <Tooltip title="Обновить">
          <IconButton size="small" onClick={load} aria-label="Обновить">
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Button variant="contained" startIcon={<AddIcon />} onClick={onRecord}>
          Record
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {scenarios.length === 0 && !error ? (
        <Paper sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
          <Typography variant="h6">Запишите первый сценарий</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 560 }}>
            Откройте приложение в браузере и пройдите путь руками. NATL сохранит YAML-файл
            в папку проекта — его увидит git и запустит CI.
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={onRecord}>Record</Button>
        </Paper>
      ) : (
        <Paper sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Название</TableCell>
                <TableCell>Файл</TableCell>
                <TableCell width={180}>Изменён</TableCell>
                <TableCell width={110} align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((scenario) => (
                <TableRow
                  key={scenario.relativePath}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => onOpen(scenario.relativePath, scenario.name)}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {scenario.name}
                      {scenario.error && <Chip size="small" color="warning" label="ошибка" />}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: 12 }}>
                    {scenario.relativePath}
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>
                    {scenario.updatedAt ? new Date(scenario.updatedAt).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      startIcon={<PlayArrowIcon />}
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpen(scenario.relativePath, scenario.name);
                      }}
                    >
                      Открыть
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography variant="body2" sx={{ color: 'text.secondary', py: 2 }}>
                      Ничего не найдено.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1 }}>
        Сценарий — файл в папке tests/ вашего проекта.
      </Typography>
    </Box>
  );
}
