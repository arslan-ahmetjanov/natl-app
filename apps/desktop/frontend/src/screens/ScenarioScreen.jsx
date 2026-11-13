import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  Popover,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { parse, stringify } from 'yaml';
import YamlEditor from '../components/YamlEditor';
import StepDialog from '../components/StepDialog';
import ScenarioSteps from '../components/ScenarioSteps';
import ScreenshotCarousel from '../components/ScreenshotCarousel';
import { useHotkeys } from '../utils/useHotkeys';
import { humanizeError, humanizeStep } from '../utils/errors';

const AUTOSAVE_MS = 700;
const LINT_MS = 500;
const HEADLESS_KEY = 'natl-headless';

function formatBytes(bytes) {
  if (!bytes) return '0 Б';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

/**
 * Экран сценария: файл сверху, отчёт снизу, проверка до запуска.
 * Скриншоты — отдельной каруселью и с уборкой, чтобы не копились гигабайты.
 */
export default function ScenarioScreen({ relativePath, title, workspacePath, onBack, onRenamed }) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [savedText, setSavedText] = useState('');
  const [state, setState] = useState(null);
  const [mode, setMode] = useState('human');
  const [panelOpen, setPanelOpen] = useState(true);
  const [run, setRun] = useState(null);
  const [stepOpen, setStepOpen] = useState(false);
  const [shotsOpen, setShotsOpen] = useState(false);
  const [issues, setIssues] = useState({ ok: true, issues: [] });
  const [issuesAnchor, setIssuesAnchor] = useState(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [cleanOpen, setCleanOpen] = useState(false);
  const [artifacts, setArtifacts] = useState({ runs: 0, files: 0, bytes: 0 });
  const [newName, setNewName] = useState('');
  const [actionError, setActionError] = useState(null);
  const [headless, setHeadless] = useState(() => localStorage.getItem(HEADLESS_KEY) !== '0');
  const timer = useRef(null);
  const lintTimer = useRef(null);
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
    api.natlArtifactsInfo().then(setArtifacts).catch(() => {});
  }, [api, run]);

  // Автосохранение
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

  // Проверка до запуска
  useEffect(() => {
    if (lintTimer.current) clearTimeout(lintTimer.current);
    lintTimer.current = setTimeout(async () => {
      try {
        setIssues(await api.natlLint(text));
      } catch {
        setIssues({ ok: true, issues: [] });
      }
    }, LINT_MS);
    return undefined;
  }, [text, api]);

  const handleRun = async () => {
    if (run && run.running) return;
    setPanelOpen(true);
    setRun({ running: true, result: null, images: [] });
    try {
      const result = await api.natlRunScenario(`${workspacePath}/${relativePath}`, { headless });
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
      setRun({
        running: false,
        result: { ...result, steps: (result.steps || []).map((step) => humanizeStep(step)) },
        images,
      });
    } catch (err) {
      setRun({
        running: false,
        images: [],
        result: { ok: false, error: humanizeError(err, { file: relativePath }), steps: [] },
      });
    }
  };

  const addStep = (step) => {
    try {
      const doc = parse(text || '') || {};
      if (!Array.isArray(doc.steps)) doc.steps = [];
      doc.steps.push(step);
      setText(stringify(doc, { lineWidth: 0 }));
      setActionError(null);
    } catch (err) {
      setActionError(`Не удалось изменить YAML: ${err.message || err}`);
    }
  };

  const rename = async () => {
    try {
      const result = await api.natlRenameScenario({ relativePath, name: newName });
      setRenameOpen(false);
      if (onRenamed) onRenamed(result.relativePath, result.fileName.replace(/\.ya?ml$/i, ''));
    } catch (err) {
      setActionError(humanizeError(err, { file: relativePath }));
    }
  };

  const remove = async () => {
    try {
      await api.natlDeleteScenario(relativePath);
      setDeleteOpen(false);
      onBack();
    } catch (err) {
      setActionError(humanizeError(err, { file: relativePath }));
    }
  };

  const clean = async () => {
    try {
      const result = await api.natlCleanArtifacts({ keepLast: 0 });
      setArtifacts(await api.natlArtifactsInfo());
      setRun((prev) => (prev ? { ...prev, images: [] } : prev));
      setCleanOpen(false);
      setActionError(
        result.removed
          ? `Удалено прогонов: ${result.removed}, освобождено ${formatBytes(result.freedBytes)}`
          : 'Нечего удалять',
      );
    } catch (err) {
      setActionError(humanizeError(err, { file: relativePath }));
    }
  };

  const errorCount = issues.issues.filter((item) => item.severity === 'error').length;
  const warningCount = issues.issues.length - errorCount;
  const shotCount = run && run.images ? run.images.length : 0;

  const hotkeys = useMemo(
    () => ({
      'mod+r': () => handleRun(),
      'mod+s': async () => {
        await api.natlWriteScenario({ relativePath, text });
        setSavedText(text);
        setState({ status: 'saved', at: new Date() });
      },
      'mod+shift+e': () => setMode((prev) => (prev === 'yaml' ? 'human' : 'yaml')),
      'mod+n': () => setStepOpen(true),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text, relativePath, run],
  );
  useHotkeys(hotkeys);

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

        <Tooltip title="Проверка до запуска">
          <Chip
            size="small"
            icon={errorCount ? <ErrorOutlineIcon /> : <CheckCircleIcon />}
            color={errorCount ? 'error' : warningCount ? 'warning' : 'success'}
            variant="outlined"
            label={errorCount ? `${errorCount} ошибок` : warningCount ? `${warningCount} замечаний` : 'проверено'}
            onClick={(event) => setIssuesAnchor(event.currentTarget)}
            sx={{ cursor: 'pointer' }}
          />
        </Tooltip>

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

        <Tooltip title="Добавить шаг (Ctrl+N)">
          <Button size="small" startIcon={<AddIcon />} onClick={() => setStepOpen(true)}>
            Шаг
          </Button>
        </Tooltip>
        <Tooltip title="Скриншоты прогона">
          <span>
            <Button
              size="small"
              startIcon={<PhotoLibraryIcon />}
              onClick={() => setShotsOpen(true)}
              disabled={shotCount === 0}
            >
              {shotCount ? `Кадры · ${shotCount}` : 'Кадры'}
            </Button>
          </span>
        </Tooltip>
        <Tooltip title={`Убрать артефакты (${formatBytes(artifacts.bytes)})`}>
          <IconButton size="small" onClick={() => setCleanOpen(true)} aria-label="Очистить скриншоты">
            <CleaningServicesIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Переименовать">
          <IconButton
            size="small"
            onClick={() => {
              setNewName(relativePath.split('/').pop().replace(/\.ya?ml$/i, ''));
              setRenameOpen(true);
            }}
            aria-label="Переименовать сценарий"
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Удалить сценарий">
          <IconButton size="small" onClick={() => setDeleteOpen(true)} aria-label="Удалить сценарий">
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Показывать окно браузера при прогоне">
          <FormControlLabel
            sx={{ mr: 0 }}
            control={(
              <Switch
                size="small"
                checked={!headless}
                onChange={(event) => {
                  const next = !event.target.checked;
                  setHeadless(next);
                  localStorage.setItem(HEADLESS_KEY, next ? '1' : '0');
                }}
              />
            )}
            label={<Typography variant="caption">С окном</Typography>}
          />
        </Tooltip>
        <Tooltip title="Запустить (Ctrl+R)">
          <span>
            <Button
              variant="contained"
              size="small"
              startIcon={<PlayArrowIcon />}
              onClick={handleRun}
              disabled={Boolean(run && run.running) || errorCount > 0}
            >
              {run && run.running ? 'Running…' : 'Run'}
            </Button>
          </span>
        </Tooltip>
      </Box>

      {actionError && (
        <Alert severity="info" onClose={() => setActionError(null)} sx={{ borderRadius: 0 }}>
          {actionError}
        </Alert>
      )}
      {errorCount > 0 && (
        <Alert severity="error" sx={{ borderRadius: 0 }}>
          Запуск заблокирован: исправьте ошибки в сценарии. Нажмите на счётчик проверки, чтобы увидеть список.
        </Alert>
      )}

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {mode === 'yaml' ? (
          <YamlEditor value={text} dark={theme.palette.mode === 'dark'} onChange={setText} />
        ) : (
          <ScenarioSteps text={text} />
        )}
      </Box>

      <Box sx={{ borderTop: '1px solid', borderColor: 'divider', flexShrink: 0, bgcolor: 'background.paper' }}>
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
                  Прогонов ещё не было. Нажмите Run или Ctrl+R.
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

      <Popover
        open={Boolean(issuesAnchor)}
        anchorEl={issuesAnchor}
        onClose={() => setIssuesAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 2, maxWidth: 460 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Проверка сценария</Typography>
          {issues.issues.length === 0 && (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>Замечаний нет.</Typography>
          )}
          {issues.issues.map((issue, index) => (
            <Typography
              key={index}
              variant="body2"
              sx={{ color: issue.severity === 'error' ? 'error.main' : 'warning.main', mb: 0.5 }}
            >
              {issue.severity === 'error' ? '✗' : '!'} {issue.message}
            </Typography>
          ))}
        </Box>
      </Popover>

      <StepDialog
        open={stepOpen}
        onClose={() => setStepOpen(false)}
        onSave={(step) => addStep(step)}
      />
      <ScreenshotCarousel open={shotsOpen} onClose={() => setShotsOpen(false)} images={run && run.images ? run.images : []} />

      <Dialog open={cleanOpen} onClose={() => setCleanOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Очистить скриншоты</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Прогонов в папке artifacts: {artifacts.runs}, файлов: {artifacts.files}, всего {formatBytes(artifacts.bytes)}.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
            Удаляются кадры и трассы всех прогонов рабочей папки.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCleanOpen(false)} sx={{ color: 'text.secondary' }}>Отмена</Button>
          <Button color="error" variant="contained" onClick={clean}>Удалить</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Переименовать сценарий</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Имя файла"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameOpen(false)} sx={{ color: 'text.secondary' }}>Отмена</Button>
          <Button variant="contained" onClick={rename}>Переименовать</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Удалить сценарий?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">{relativePath} будет удалён с диска.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} sx={{ color: 'text.secondary' }}>Отмена</Button>
          <Button color="error" variant="contained" onClick={remove}>Удалить</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
