import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';

function StatCard({ label, value, hint }) {
  return (
    <Card sx={{ p: 2.5, flex: 1, minWidth: 180, boxShadow: '0 10px 30px rgba(15,23,42,.06)' }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </Typography>
      <Typography variant="h4" sx={{ mt: 0.5, fontWeight: 600 }}>{value}</Typography>
      {hint && <Typography variant="caption" sx={{ color: 'text.secondary' }}>{hint}</Typography>}
    </Card>
  );
}

/** Обзор рабочей папки: что есть и с чего начать. */
export default function DashboardScreen({ workspacePath, onOpen, onRecord, onOpenAi, onOpenList }) {
  const [scenarios, setScenarios] = useState([]);
  const [error, setError] = useState(null);
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
  }, [load]);

  const stats = useMemo(() => {
    const withError = scenarios.filter((item) => item.error).length;
    const latest = scenarios
      .map((item) => item.updatedAt)
      .filter(Boolean)
      .sort()
      .pop();
    return { total: scenarios.length, withError, latest };
  }, [scenarios]);

  const recent = useMemo(
    () =>
      [...scenarios]
        .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
        .slice(0, 5),
    [scenarios],
  );

  return (
    <Box sx={{ p: 3, flex: 1, minHeight: 0, overflow: 'auto' }}>
      <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 600 }}>
        Обзор
      </Typography>
      <Typography variant="h5" sx={{ mb: 0.5 }}>Рабочая папка</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        {workspacePath}
      </Typography>

      {error && (
        <Typography variant="body2" sx={{ color: 'error.main', mb: 2 }}>{error}</Typography>
      )}

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <StatCard label="Сценариев" value={stats.total} hint="YAML-файлов в tests/" />
        <StatCard label="С ошибкой" value={stats.withError} hint="не читаются или битые" />
        <StatCard
          label="Последнее изменение"
          value={stats.latest ? new Date(stats.latest).toLocaleDateString() : '—'}
          hint={stats.latest ? new Date(stats.latest).toLocaleTimeString() : 'пока пусто'}
        />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 3 }}>
        <Card sx={{ p: 0, overflow: 'hidden' }}>
          <CardActionArea onClick={onRecord} sx={{ p: 2.5 }}>
            <AddIcon sx={{ color: 'primary.main' }} />
            <Typography variant="subtitle1" sx={{ mt: 1 }}>Записать сценарий</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Пройдите путь в браузере — NATL сохранит YAML в проект.
            </Typography>
          </CardActionArea>
        </Card>
        <Card sx={{ p: 0, overflow: 'hidden' }}>
          <CardActionArea onClick={onOpenAi} sx={{ p: 2.5 }}>
            <AutoAwesomeIcon sx={{ color: 'primary.main' }} />
            <Typography variant="subtitle1" sx={{ mt: 1 }}>ИИ-агент</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Попросить агента проверить, дополнить или запустить тесты.
            </Typography>
          </CardActionArea>
        </Card>
      </Box>

      <Card sx={{ overflow: 'hidden' }}>
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center' }}>
          <Typography variant="subtitle1" sx={{ flex: 1 }}>Последние сценарии</Typography>
          <Button size="small" startIcon={<FolderOpenIcon />} onClick={onOpenList}>
            Все сценарии
          </Button>
        </Box>
        {recent.length === 0 ? (
          <Box sx={{ px: 2.5, pb: 2.5 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Пока нет ни одного сценария. Начните с записи.
            </Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Название</TableCell>
                <TableCell>Файл</TableCell>
                <TableCell width={160}>Изменён</TableCell>
                <TableCell width={120} align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {recent.map((item) => (
                <TableRow key={item.relativePath} hover sx={{ cursor: 'pointer' }} onClick={() => onOpen(item.relativePath, item.name)}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {item.name}
                      {item.error && <Chip size="small" color="warning" label="ошибка" />}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, color: 'text.secondary' }}>
                    {item.relativePath}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>
                    {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" startIcon={<PlayArrowIcon />}>Открыть</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </Box>
  );
}
