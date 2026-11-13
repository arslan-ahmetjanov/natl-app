import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Paper,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import YamlEditor from '../components/YamlEditor';
import StepBuilder from '../components/StepBuilder';
import AiPanel from '../components/AiPanel';

const AUTOSAVE_MS = 700;

/** Экран одного сценария: редактор и панель, которую можно свернуть. */
export default function ScenarioScreen({
  relativePath,
  title,
  workspacePath,
  onBack,
  onOpenSettings,
}) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [savedText, setSavedText] = useState('');
  const [state, setState] = useState(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelTab, setPanelTab] = useState('run');
  const [run, setRun] = useState(null);
  const timer = useRef(null);
  const api = window.electronAPI;

  const load = useCallback(async () => {
    try {
      const read = await api.natlReadScenario(relativePath);
      setText(read.text || '');
      setSavedText(read.text || '');
      setState(read.error ? { status: 'error', message: read.error } : null);
    } catch (err) {
      setState({ status: 'error', message: err.message || String(err) });
    }
  }, [api, relativePath]);

  useEffect(() => {
    load();
    setRun(null);
  }, [load]);

  useEffect(() => {
    if (text === savedText) return undefined;
    if (timer.current) clearTimeout(timer.current);
    setState({ status: 'saving' });

    timer.current = setTimeout(async () => {
      try {
        await api.natlWriteScenario({ relativePath, text });
        setSavedText(text);
        setState({ status: 'saved', at: new Date() });
      } catch (err) {
        setState({ status: 'error', message: err && err.message ? err.message : String(err) });
      }
    }, AUTOSAVE_MS);
    return undefined;
  }, [text, savedText, api, relativePath]);

  const handleRun = async () => {
    if (run && run.running) return;
    setPanelOpen(true);
    setPanelTab('run');
    setRun({ running: true, result: null, images: [] });
    try {
      const result = await api.natlRunScenario(`${workspacePath}/${relativePath}`, { headless: true });
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
            /* кадр не должен скрывать результат */
          }
        }
      }
      setRun({ running: false, result, images });
    } catch (err) {
      setRun({
        running: false,
        images: [],
        result: { ok: false, error: err && err.message ? err.message : String(err), steps: [] },
      });
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <IconButton size="small" onClick={onBack} aria-label="Назад к списку">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{title}</Typography>
        <Chip size="small" label={relativePath} variant="outlined" />
        <Box sx={{ flex: 1 }} />
        {state && state.status === 'saving' && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Сохранение…</Typography>
        )}
        {state && state.status === 'saved' && (
          <Typography variant="caption" sx={{ color: 'success.main' }}>
            Сохранено {state.at ? state.at.toLocaleTimeString() : ''}
          </Typography>
        )}
        {state && state.status === 'error' && (
          <Typography variant="caption" sx={{ color: 'error.main' }}>{state.message}</Typography>
        )}
        <Button
          variant="contained"
          size="small"
          startIcon={<PlayArrowIcon />}
          onClick={handleRun}
          disabled={Boolean(run && run.running)}
        >
          {run && run.running ? 'Running…' : 'Run'}
        </Button>
      </Box>

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Box sx={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
          <YamlEditor value={text} dark={theme.palette.mode === 'dark'} onChange={setText} />
        </Box>

        <Paper
          square
          elevation={0}
          sx={{
            width: panelOpen ? 340 : 44,
            flexShrink: 0,
            borderLeft: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            transition: 'width 120ms ease',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider' }}>
            <Tooltip title={panelOpen ? 'Свернуть панель' : 'Развернуть панель'}>
              <IconButton
                size="small"
                onClick={() => setPanelOpen((prev) => !prev)}
                aria-label={panelOpen ? 'Свернуть панель' : 'Развернуть панель'}
                sx={{ m: 0.5 }}
              >
                {panelOpen ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            {panelOpen && (
              <Tabs
                value={panelTab}
                onChange={(_, next) => setPanelTab(next)}
                variant="fullWidth"
                sx={{ flex: 1, minHeight: 38 }}
              >
                <Tab value="build" label="Шаг" sx={{ minHeight: 38, textTransform: 'none' }} />
                <Tab value="ai" label="ИИ" sx={{ minHeight: 38, textTransform: 'none' }} />
                <Tab value="run" label="Прогон" sx={{ minHeight: 38, textTransform: 'none' }} />
              </Tabs>
            )}
          </Box>

          {panelOpen && (
            <>
              <Divider />
              <Box sx={{ overflow: 'auto', flex: 1 }}>
                {panelTab === 'build' && <StepBuilder text={text} onAppend={setText} />}
                {panelTab === 'ai' && (
                  <AiPanel text={text} onAppend={setText} onOpenSettings={onOpenSettings} />
                )}
                {panelTab === 'run' && <RunResult run={run} />}
              </Box>
            </>
          )}
        </Paper>
      </Box>
    </Box>
  );
}

function RunResult({ run }) {
  if (!run) {
    return (
      <Box sx={{ p: 1.5 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Прогонов ещё не было. Нажмите Run выше.
        </Typography>
      </Box>
    );
  }
  return (
    <Box sx={{ p: 1.5 }}>
      {run.running && <Typography variant="body2">Выполняется…</Typography>}
      {run.result && (
        <Alert severity={run.result.ok ? 'success' : 'error'} sx={{ mb: 1.5 }}>
          {run.result.ok ? 'Passed' : 'Failed'} in {Math.round(run.result.durationMs || 0)} ms
          {run.result.error ? ` — ${run.result.error}` : ''}
        </Alert>
      )}
      {run.result && (
        <Box component="ol" sx={{ pl: 2, my: 1 }}>
          {(run.result.steps || []).map((step, index) => (
            <li key={`${index}-${step.name}`}>
              <Typography variant="body2" sx={{ color: step.ok ? 'success.main' : 'error.main' }}>
                {step.ok ? '✓' : '✗'} {step.name}{step.error ? ` — ${step.error}` : ''}
              </Typography>
            </li>
          ))}
        </Box>
      )}
      {run.images && run.images.length > 0 && (
        <Box sx={{ display: 'grid', gap: 1 }}>
          {run.images.map((image) => (
            <Box key={image.key}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {image.step} · {image.action} · {image.phase}
              </Typography>
              <Box
                component="img"
                src={image.src}
                alt={`Шаг ${image.step}, ${image.phase}`}
                sx={{ width: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
              />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
