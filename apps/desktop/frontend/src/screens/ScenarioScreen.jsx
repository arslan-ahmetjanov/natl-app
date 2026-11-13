import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AddIcon from '@mui/icons-material/Add';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import YamlEditor from '../components/YamlEditor';
import StepDialog from '../components/StepDialog';
import ScenarioSteps from '../components/ScenarioSteps';
import ScreenshotCarousel from '../components/ScreenshotCarousel';

const AUTOSAVE_MS = 700;

/**
 * Экран сценария.
 *
 * Сверху — файл, снизу — отчёт. Скриншоты в отчёт по умолчанию не попадают:
 * их открывает отдельная кнопка, чтобы результат читался, а не листался.
 */
export default function ScenarioScreen({ relativePath, title, workspacePath, onBack }) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [savedText, setSavedText] = useState('');
  const [state, setState] = useState(null);
  const [mode, setMode] = useState('human');
  const [panelOpen, setPanelOpen] = useState(true);
  const [run, setRun] = useState(null);
  const [stepOpen, setStepOpen] = useState(false);
  const [shotsOpen, setShotsOpen] = useState(false);
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

  const shotCount = run && run.images ? run.images.length : 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexWrap: 'wrap',
        }}
      >
        <IconButton size="small" onClick={onBack} aria-label="Назад к списку">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="subtitle1">{title}</Typography>
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

        <ToggleButtonGroup
          size="small"
          exclusive
          value={mode}
          onChange={(_, next) => next && setMode(next)}
          aria-label="Вид сценария"
        >
          <ToggleButton value="human" sx={{ textTransform: 'none', px: 1.2 }}>Понятно</ToggleButton>
          <ToggleButton value="yaml" sx={{ textTransform: 'none', px: 1.2 }}>YAML</ToggleButton>
        </ToggleButtonGroup>

        <Button size="small" startIcon={<AddIcon />} onClick={() => setStepOpen(true)}>
          Добавить шаг
        </Button>
        <Tooltip title={shotCount ? 'Открыть скриншоты' : 'Скриншоты появятся после прогона'}>
          <span>
            <Button
              size="small"
              startIcon={<PhotoLibraryIcon />}
              onClick={() => setShotsOpen(true)}
              disabled={shotCount === 0}
            >
              Скриншоты{shotCount ? ` · ${shotCount}` : ''}
            </Button>
          </span>
        </Tooltip>
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

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {mode === 'yaml' ? (
          <YamlEditor value={text} dark={theme.palette.mode === 'dark'} onChange={setText} />
        ) : (
          <ScenarioSteps text={text} />
        )}
      </Box>

      <Box
        sx={{
          borderTop: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.5 }}>
          <Typography variant="subtitle2" sx={{ flex: 1 }}>Отчёт</Typography>
          {run && run.result && (
            <Chip
              size="small"
              color={run.result.ok ? 'success' : 'error'}
              label={`${run.result.ok ? 'Passed' : 'Failed'} · ${Math.round(run.result.durationMs || 0)} мс`}
            />
          )}
          <IconButton
            size="small"
            onClick={() => setPanelOpen((prev) => !prev)}
            aria-label={panelOpen ? 'Свернуть отчёт' : 'Развернуть отчёт'}
          >
            {panelOpen ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
          </IconButton>
        </Box>

        {panelOpen && (
          <>
            <Divider />
            <Box sx={{ maxHeight: 220, overflow: 'auto', px: 1.5, py: 1 }}>
              {!run && (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Прогонов ещё не было. Нажмите Run — здесь появятся шаги и ошибки.
                </Typography>
              )}
              {run && run.running && <Typography variant="body2">Выполняется…</Typography>}
              {run && run.result && run.result.error && (
                <Alert severity="error" sx={{ mb: 1 }}>{run.result.error}</Alert>
              )}
              {run && run.result && (
                <Box component="ol" sx={{ pl: 2, my: 0 }}>
                  {(run.result.steps || []).map((step, index) => (
                    <li key={`${index}-${step.name}`}>
                      <Typography variant="body2" sx={{ color: step.ok ? 'text.primary' : 'error.main' }}>
                        {step.ok ? '✓' : '✗'} {step.name}{step.error ? ` — ${step.error}` : ''}
                      </Typography>
                    </li>
                  ))}
                </Box>
              )}
            </Box>
          </>
        )}
      </Box>

      <StepDialog
        open={stepOpen}
        onClose={() => setStepOpen(false)}
        text={text}
        onAppend={setText}
      />
      <ScreenshotCarousel
        open={shotsOpen}
        onClose={() => setShotsOpen(false)}
        images={run && run.images ? run.images : []}
      />
    </Box>
  );
}
