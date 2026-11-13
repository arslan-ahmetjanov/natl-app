import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Tab,
  Tabs,
  Typography,
  useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import YamlEditor from '../components/YamlEditor';
import ScenarioList from './ScenarioList';
import WorkPanel from './WorkPanel';

const AUTOSAVE_MS = 700;

/**
 * The workbench: scenarios on the left, the file in the middle, the working
 * panel on the right. Building, running and reading the outcome share one
 * screen — the file is the only source of truth, so nothing is "saved" twice.
 */
export default function ScenariosScreen({ workspacePath, onRecord, refreshToken = 0 }) {
  const theme = useTheme();
  const [scenarios, setScenarios] = useState([]);
  const [listError, setListError] = useState(null);
  const [query, setQuery] = useState('');
  const [tabs, setTabs] = useState([]);
  const [activePath, setActivePath] = useState(null);
  const [buffers, setBuffers] = useState({});
  const [saved, setSaved] = useState({});
  const [saveState, setSaveState] = useState({});
  const [runs, setRuns] = useState({});
  const [panelTab, setPanelTab] = useState('build');
  const timers = useRef({});
  const api = window.electronAPI;

  const loadList = useCallback(async () => {
    if (!api || !api.natlListScenarios) return;
    try {
      setScenarios((await api.natlListScenarios()) || []);
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

  // Autosave per tab. No cleanup that cancels the timer: switching tabs must
  // not lose an edit, and the next keystroke replaces the timer anyway.
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
    return undefined;
  }, [buffers, saved, activePath, api, loadList]);

  const handleRun = async (relativePath) => {
    const current = runs[relativePath];
    if (!relativePath || (current && current.running)) return;

    setPanelTab('run');
    setRuns((prev) => ({ ...prev, [relativePath]: { running: true, result: null, images: [] } }));
    try {
      const absolute = `${workspacePath}/${relativePath}`;
      const result = await api.natlRunScenario(absolute, { headless: true });
      const images = [];
      for (const shot of result.screenshots || []) {
        for (const phase of ['before', 'after']) {
          try {
            images.push({
              key: `${shot.index}-${phase}`,
              step: shot.index,
              action: shot.action,
              phase,
              src: await api.natlReadScreenshot(shot[phase]),
            });
          } catch {
            /* a missing frame must not hide the result */
          }
        }
      }
      setRuns((prev) => ({ ...prev, [relativePath]: { running: false, result, images } }));
    } catch (err) {
      setRuns((prev) => ({
        ...prev,
        [relativePath]: {
          running: false,
          images: [],
          result: { ok: false, error: err && err.message ? err.message : String(err), steps: [] },
        },
      }));
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

  const activeText = activePath ? buffers[activePath] ?? '' : '';
  const activeState = activePath ? saveState[activePath] : null;

  return (
    <Box sx={{ display: 'flex', flex: 1, minHeight: 0, gap: 1.5, p: 1.5 }}>
      <ScenarioList
        scenarios={filtered}
        query={query}
        onQueryChange={setQuery}
        activePath={activePath}
        onOpen={openScenario}
        onRefresh={loadList}
        onRecord={onRecord}
      />

      <Paper
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid',
          borderColor: 'divider',
          minWidth: 0,
        }}
      >
        {tabs.length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider' }}>
            <Tabs
              value={activePath || false}
              onChange={(_, value) => setActivePath(value)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ flex: 1, minHeight: 38 }}
            >
              {tabs.map((tab) => (
                <Tab
                  key={tab.relativePath}
                  value={tab.relativePath}
                  sx={{ minHeight: 38, textTransform: 'none' }}
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
                disabled={Boolean(runs[activePath] && runs[activePath].running)}
                sx={{ mr: 1, whiteSpace: 'nowrap' }}
              >
                {runs[activePath] && runs[activePath].running ? 'Running…' : 'Run'}
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
            <Box sx={{ px: 1.5, py: 0.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
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
            <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <YamlEditor
                value={activeText}
                dark={theme.palette.mode === 'dark'}
                onChange={(next) => setBuffers((prev) => ({ ...prev, [activePath]: next }))}
              />
            </Box>
          </>
        )}

        {listError && <Alert severity="error" sx={{ m: 2 }}>{listError}</Alert>}
      </Paper>

      <WorkPanel
        tab={panelTab}
        onTabChange={setPanelTab}
        text={activeText}
        onAppend={(next) => {
          if (activePath) setBuffers((prev) => ({ ...prev, [activePath]: next }));
        }}
        run={activePath ? runs[activePath] : null}
      />
    </Box>
  );
}
