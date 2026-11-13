import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';

const AUTOSAVE_MS = 700;

/**
 * Scenarios, Postman-style: a list of files on the left, tabs above the editor.
 *
 * Tabs exist because a real check is rarely one file: you open the login flow,
 * then the checkout flow, and you keep both while you work. Every tab owns its
 * own editor buffer and its own run result, so switching never loses anything.
 */
export default function ScenariosScreen({ workspacePath, onRecord, refreshToken = 0 }) {
  const [scenarios, setScenarios] = useState([]);
  const [listError, setListError] = useState(null);
  const [query, setQuery] = useState('');
  const [tabs, setTabs] = useState([]); // [{ relativePath, name }]
  const [activePath, setActivePath] = useState(null);
  const [buffers, setBuffers] = useState({}); // relativePath -> text
  const [saved, setSaved] = useState({}); // relativePath -> last saved text
  const [saveState, setSaveState] = useState({}); // relativePath -> {status, at, message}
  const [runs, setRuns] = useState({}); // relativePath -> { running, result, images }
  const timers = useRef({});
  const api = window.electronAPI;

  const loadList = useCallback(async () => {
    if (!api || !api.natlListScenarios) return;
    try {
      const list = await api.natlListScenarios();
      setScenarios(list || []);
      setListError(null);
    } catch (err) {
      setListError(err && err.message ? err.message : String(err));
    }
  }, [api]);

  useEffect(() => {
    loadList();
  }, [loadList, refreshToken]);

  const openScenario = useCallback(
    async (scenario) => {
      setTabs((prev) =>
        prev.some((tab) => tab.relativePath === scenario.relativePath)
          ? prev
          : [...prev, { relativePath: scenario.relativePath, name: scenario.name }],
      );
      setActivePath(scenario.relativePath);

      if (buffers[scenario.relativePath] !== undefined) return;
      try {
        const read = await api.natlReadScenario(scenario.relativePath);
        setBuffers((prev) => ({ ...prev, [scenario.relativePath]: read.text || '' }));
        setSaved((prev) => ({ ...prev, [scenario.relativePath]: read.text || '' }));
        if (read.error) {
          setSaveState((prev) => ({
            ...prev,
            [scenario.relativePath]: { status: 'error', message: read.error },
          }));
        }
      } catch (err) {
        setSaveState((prev) => ({
          ...prev,
          [scenario.relativePath]: { status: 'error', message: err.message || String(err) },
        }));
      }
    },
    [api, buffers],
  );

  const closeTab = (relativePath) => {
    setTabs((prev) => {
      const next = prev.filter((tab) => tab.relativePath !== relativePath);
      if (activePath === relativePath) {
        const last = next[next.length - 1];
        setActivePath(last ? last.relativePath : null);
      }
      return next;
    });
  };

  // Autosave per tab: the file is the source of truth, every pause writes it.
  useEffect(() => {
    if (!activePath) return undefined;
    const text = buffers[activePath];
    if (text === undefined || text === saved[activePath]) return undefined;

    if (timers.current[activePath]) clearTimeout(timers.current[activePath]);
    setSaveState((prev) => ({ ...prev, [activePath]: { status: 'saving' } }));

    timers.current[activePath] = setTimeout(async () => {
      try {
        await api.natlWriteScenario({ relativePath: activePath, text });
        setSaved((prev) => ({ ...prev, [activePath]: text }));
        setSaveState((prev) => ({ ...prev, [activePath]: { status: 'saved', at: new Date() } }));
        loadList();
      } catch (err) {
        setSaveState((prev) => ({
          ...prev,
          [activePath]: { status: 'error', message: err && err.message ? err.message : String(err) },
        }));
      }
    }, AUTOSAVE_MS);

    // No cleanup that cancels the timer: switching tabs must not lose an edit.
    // The next keystroke in the same tab replaces the timer anyway.
    return undefined;
  }, [buffers, saved, activePath, api, loadList]);

  const patchRun = (relativePath, patch) => {
    setRuns((prev) => ({
      ...prev,
      [relativePath]: { running: false, result: null, images: [], ...prev[relativePath], ...patch },
    }));
  };

  const handleRun = async (relativePath) => {
    const current = runs[relativePath];
    if (!relativePath || (current && current.running)) return;

    patchRun(relativePath, { running: true, result: null, images: [] });
    try {
      const absolute = `${workspacePath}/${relativePath}`;
      const result = await api.natlRunScenario(absolute, { headless: true });
      const images = [];
      for (const shot of result.screenshots || []) {
        for (const phase of ['before', 'after']) {
          try {
            const src = await api.natlReadScreenshot(shot[phase]);
            images.push({ key: `${shot.index}-${phase}`, step: shot.index, action: shot.action, phase, src });
          } catch {
            /* a missing frame must not hide the result */
          }
        }
      }
      patchRun(relativePath, { running: false, result, images });
    } catch (err) {
      patchRun(relativePath, {
        running: false,
        result: { ok: false, error: err && err.message ? err.message : String(err), steps: [] },
      });
    }
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return scenarios;
    return scenarios.filter(
      (item) =>
        item.name.toLowerCase().includes(needle) || item.relativePath.toLowerCase().includes(needle),
    );
  }, [scenarios, query]);

  const activeName = tabs.find((tab) => tab.relativePath === activePath)?.name || '';
  const activeText = activePath ? buffers[activePath] ?? '' : '';
  const activeState = activePath ? saveState[activePath] : null;
  const activeRun = activePath ? runs[activePath] : null;

  return (
    <Box sx={{ display: 'flex', flex: 1, minHeight: 0, gap: 2, p: 2 }}>
      <Paper sx={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ p: 1.5, pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography variant="subtitle2" sx={{ flex: 1 }}>Scenarios</Typography>
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={loadList}><RefreshIcon fontSize="small" /></IconButton>
            </Tooltip>
            <Tooltip title="Record a new scenario">
              <IconButton size="small" onClick={onRecord}><AddIcon fontSize="small" /></IconButton>
            </Tooltip>
          </Box>
          <TextField
            size="small"
            fullWidth
            placeholder="Поиск"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Box>
        <Divider />
        <List dense sx={{ overflow: 'auto', flex: 1 }}>
          {filtered.map((scenario) => (
            <ListItemButton
              key={scenario.relativePath}
              selected={activePath === scenario.relativePath}
              onClick={() => openScenario(scenario)}
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
          {filtered.length === 0 && (
            <Box sx={{ p: 2 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {scenarios.length === 0
                  ? 'Пока нет сценариев. Нажмите + и запишите первый.'
                  : 'Ничего не найдено.'}
              </Typography>
            </Box>
          )}
        </List>
      </Paper>

      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid', borderColor: 'divider', minWidth: 0 }}>
        {tabs.length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider' }}>
            <Tabs
              value={activePath || false}
              onChange={(_, value) => setActivePath(value)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ flex: 1, minHeight: 40 }}
            >
              {tabs.map((tab) => (
                <Tab
                  key={tab.relativePath}
                  value={tab.relativePath}
                  sx={{ minHeight: 40, textTransform: 'none' }}
                  label={(
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <span>{tab.name}</span>
                      <CloseIcon
                        fontSize="inherit"
                        onClick={(event) => {
                          event.stopPropagation();
                          closeTab(tab.relativePath);
                        }}
                        sx={{ opacity: 0.6, '&:hover': { opacity: 1 } }}
                      />
                    </Box>
                  )}
                />
              ))}
            </Tabs>
            {activePath && (
              <Button
                size="small"
                variant="contained"
                startIcon={<PlayArrowIcon />}
                onClick={() => handleRun(activePath)}
                disabled={Boolean(activeRun && activeRun.running)}
                sx={{ mr: 1, whiteSpace: 'nowrap' }}
              >
                {activeRun && activeRun.running ? 'Running…' : 'Run'}
              </Button>
            )}
          </Box>
        )}

        {!activePath && (
          <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <Typography variant="h6">Запишите первый сценарий</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 520 }}>
              Откройте приложение в браузере, пройдите путь руками — получится YAML-файл
              в репозитории. Его можно запустить здесь или в CI той же командой.
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={onRecord}>Record</Button>
          </Box>
        )}

        {activePath && (
          <>
            <Box sx={{ px: 1.5, py: 0.75, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Chip size="small" label={activePath} variant="outlined" />
              <Box sx={{ flex: 1 }} />
              {activeState && activeState.status === 'saving' && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Сохранение…</Typography>
              )}
              {activeState && activeState.status === 'saved' && (
                <Typography variant="caption" sx={{ color: 'success.main' }}>
                  Сохранено {activeState.at ? activeState.at.toLocaleTimeString() : ''}
                </Typography>
              )}
              {activeState && activeState.status === 'error' && (
                <Typography variant="caption" sx={{ color: 'error.main' }}>{activeState.message}</Typography>
              )}
            </Box>
            <Divider />
            <Box
              component="textarea"
              value={activeText}
              onChange={(event) =>
                setBuffers((prev) => ({ ...prev, [activePath]: event.target.value }))
              }
              spellCheck={false}
              sx={{
                flex: 1,
                minHeight: 180,
                width: '100%',
                resize: 'none',
                border: 0,
                outline: 'none',
                p: 2,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                fontSize: 13,
                lineHeight: 1.5,
                bgcolor: 'background.default',
                color: 'text.primary',
              }}
            />
            {activeRun && (activeRun.result || (activeRun.images && activeRun.images.length > 0)) && (
              <Box sx={{ borderTop: '1px solid', borderColor: 'divider', maxHeight: '45%', overflow: 'auto', p: 1.5 }}>
                {activeRun.result && (
                  <Alert severity={activeRun.result.ok ? 'success' : 'error'} sx={{ mb: 1 }}>
                    {activeRun.result.ok ? 'Passed' : 'Failed'} in{' '}
                    {Math.round(activeRun.result.durationMs || 0)} ms
                    {activeRun.result.error ? ` — ${activeRun.result.error}` : ''}
                  </Alert>
                )}
                <Box component="ol" sx={{ pl: 2, my: 1 }}>
                  {((activeRun.result && activeRun.result.steps) || []).map((step, index) => (
                    <li key={`${index}-${step.name}`}>
                      <Typography variant="body2" sx={{ color: step.ok ? 'success.main' : 'error.main' }}>
                        {step.ok ? '✓' : '✗'} {step.name}{step.error ? ` — ${step.error}` : ''}
                      </Typography>
                    </li>
                  ))}
                </Box>
                {activeRun.images && activeRun.images.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 1 }}>
                    {activeRun.images.map((image) => (
                      <Box key={image.key} sx={{ flexShrink: 0, width: 200 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {image.step} · {image.action} · {image.phase}
                        </Typography>
                        <Box component="img" src={image.src} alt="" sx={{ width: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 1 }} />
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            )}
          </>
        )}

        {listError && <Alert severity="error" sx={{ m: 2 }}>{listError}</Alert>}
      </Paper>
    </Box>
  );
}
