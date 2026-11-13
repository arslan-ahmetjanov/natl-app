import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import BugReportIcon from '@mui/icons-material/BugReport';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import SaveAltIcon from '@mui/icons-material/SaveAlt';

const LEVELS = ['all', 'debug', 'info', 'warn', 'error', 'fatal'];

const LEVEL_COLORS = {
  debug: 'text.secondary',
  info: 'text.primary',
  warn: 'warning.main',
  error: 'error.main',
  fatal: 'error.main',
};

/**
 * Everything the app wrote down, in one place.
 *
 * The screen exists for support, not for decoration: a user reports "не
 * работает", and the answer should be read here instead of guessed.
 */
export default function LogsScreen({ onBack }) {
  const [entries, setEntries] = useState([]);
  const [level, setLevel] = useState('error');
  const [query, setQuery] = useState('');
  const [live, setLive] = useState(true);
  const [error, setError] = useState(null);
  const [logPath, setLogPath] = useState('');
  const [copied, setCopied] = useState(false);
  const [saveState, setSaveState] = useState(null);
  const bottomRef = useRef(null);

  const api = window.electronAPI;

  const load = useCallback(async () => {
    if (!api || !api.logsList) return;
    try {
      const list = await api.logsList({ level, query, limit: 1000 });
      setEntries(list);
      setError(null);
    } catch (err) {
      setError(err && err.message ? err.message : String(err));
    }
  }, [api, level, query]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!api || !api.logsPath) return;
    api.logsPath().then((value) => setLogPath(value || '')).catch(() => {});
  }, [api]);

  useEffect(() => {
    if (!api || !api.onLogEntry || !live) return undefined;
    return api.onLogEntry((entry) => {
      if (level !== 'all' && entry.level !== level) return;
      if (query && !`${entry.scope} ${entry.message}`.toLowerCase().includes(query.toLowerCase())) return;
      setEntries((prev) => [...prev.slice(-999), entry]);
    });
  }, [api, level, live, query]);

  useEffect(() => {
    if (live && bottomRef.current) bottomRef.current.scrollIntoView({ block: 'end' });
  }, [entries, live]);

  const copyAll = async () => {
    if (!api || !api.logsText) return;
    const text = await api.logsText({ level, query });
    await navigator.clipboard.writeText(text || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const clear = async () => {
    if (!api || !api.logsClear) return;
    await api.logsClear();
    load();
  };

  // Сохраняем то, что видно на экране: те же фильтры уходят в файл.
  const saveToFile = async () => {
    if (!api || !api.logsSave) return;
    try {
      const result = await api.logsSave({ level, query });
      if (result && result.saved) setSaveState({ path: result.path });
      else if (result && result.error) setSaveState({ error: result.error });
      else setSaveState(null);
    } catch (err) {
      setSaveState({ error: err && err.message ? err.message : String(err) });
    }
  };

  const counts = useMemo(() => {
    const result = { all: entries.length };
    for (const entry of entries) result[entry.level] = (result[entry.level] || 0) + 1;
    return result;
  }, [entries]);

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <BugReportIcon sx={{ color: 'text.secondary' }} />
        <Typography variant="h6" sx={{ mr: 2 }}>Logs</Typography>
        {onBack && (
          <Button size="small" onClick={onBack} sx={{ color: 'text.secondary' }}>Back</Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button size="small" startIcon={<SaveAltIcon />} onClick={saveToFile}>
          Сохранить в файл
        </Button>
        <Button size="small" startIcon={<ContentCopyIcon />} onClick={copyAll}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button size="small" startIcon={<FolderOpenIcon />} onClick={() => api && api.logsOpenFile && api.logsOpenFile()}>
          Open file
        </Button>
        <Button size="small" startIcon={<DeleteOutlineIcon />} onClick={clear} sx={{ color: 'error.main' }}>
          Clear
        </Button>
      </Box>

      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        {LEVELS.map((item) => (
          <Chip
            key={item}
            label={item === 'all' ? `all (${counts.all || 0})` : `${item} (${counts[item] || 0})`}
            size="small"
            color={level === item ? 'primary' : 'default'}
            variant={level === item ? 'filled' : 'outlined'}
            onClick={() => setLevel(item)}
          />
        ))}
      </Stack>

      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          label="Поиск"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          sx={{ minWidth: 260 }}
        />
        <Button
          size="small"
          variant={live ? 'contained' : 'outlined'}
          onClick={() => setLive((value) => !value)}
        >
          {live ? 'Live' : 'Paused'}
        </Button>
        <Button size="small" onClick={load}>Refresh</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {saveState && saveState.path && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaveState(null)}>
          Журнал сохранён: {saveState.path}
        </Alert>
      )}
      {saveState && saveState.error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveState(null)}>
          Не удалось сохранить журнал: {saveState.error}
        </Alert>
      )}
      {logPath && (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
          Файл: {logPath}
        </Typography>
      )}

      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          maxHeight: '60vh',
          overflow: 'auto',
          p: 1,
          bgcolor: 'background.default',
        }}
      >
        {entries.length === 0 && (
          <Typography variant="body2" sx={{ color: 'text.secondary', p: 2 }}>
            Записей нет. Если что-то сломалось — вернитесь сюда после ошибки.
          </Typography>
        )}
        {entries.map((entry) => (
          <Box
            key={entry.id}
            sx={{
              fontFamily: 'monospace',
              fontSize: 12,
              py: 0.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            <Box component="span" sx={{ color: 'text.secondary' }}>{entry.ts}</Box>{' '}
            <Box component="span" sx={{ color: LEVEL_COLORS[entry.level] || 'text.primary', fontWeight: 600 }}>
              {entry.level.toUpperCase()}
            </Box>{' '}
            <Box component="span" sx={{ color: 'text.secondary' }}>[{entry.scope}]</Box>{' '}
            {entry.message}
            {entry.details && (
              <Box component="span" sx={{ color: 'text.secondary' }}> {JSON.stringify(entry.details)}</Box>
            )}
          </Box>
        ))}
        <div ref={bottomRef} />
      </Box>
    </Box>
  );
}
