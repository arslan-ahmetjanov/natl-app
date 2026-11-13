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
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';

const AUTOSAVE_MS = 700;

/**
 * The whole product on one screen, Postman-style: list on the left,
 * scenario on the right.
 *
 * A scenario is a YAML file in the repository, so the editor is a plain text
 * editor with autosave — there is nothing to "publish" and nowhere else to
 * look. Run results stay in the same screen, next to the file they came from.
 */
export default function ScenariosScreen({ workspacePath, onRecord, refreshToken = 0 }) {
  const [scenarios, setScenarios] = useState([]);
  const [listError, setListError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [text, setText] = useState('');
  const [loadedText, setLoadedText] = useState('');
  const [saveState, setSaveState] = useState(null); // { status: 'saved'|'saving'|'error', at }
  const [query, setQuery] = useState('');
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [images, setImages] = useState([]);
  const timerRef = useRef(null);
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
      setSelected(scenario);
      setRunResult(null);
      setImages([]);
      setSaveState(null);
      try {
        const read = await api.natlReadScenario(scenario.relativePath);
        setText(read.text || '');
        setLoadedText(read.text || '');
        if (read.error) setSaveState({ status: 'error', message: read.error });
      } catch (err) {
        setSaveState({ status: 'error', message: err.message || String(err) });
      }
    },
    [api],
  );

  // Autosave: the file is the source of truth, so every pause writes it.
  useEffect(() => {
    if (!selected || text === loadedText) return undefined;
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaveState({ status: 'saving' });

    timerRef.current = setTimeout(async () => {
      try {
        await api.natlWriteScenario({ relativePath: selected.relativePath, text });
        setLoadedText(text);
        setSaveState({ status: 'saved', at: new Date() });
        loadList();
      } catch (err) {
        setSaveState({ status: 'error', message: err && err.message ? err.message : String(err) });
      }
    }, AUTOSAVE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [text, loadedText, selected, api, loadList]);

  const handleRun = async () => {
    if (!selected || running) return;
    setRunning(true);
    setRunResult(null);
    setImages([]);
    try {
      const absolute = `${workspacePath}/${selected.relativePath}`;
      const result = await api.natlRunScenario(absolute, { headless: true });
      setRunResult(result);

      const shots = [];
      for (const shot of result.screenshots || []) {
        for (const phase of ['before', 'after']) {
          try {
            const src = await api.natlReadScreenshot(shot[phase]);
            shots.push({ key: `${shot.index}-${phase}`, step: shot.index, action: shot.action, phase, src });
          } catch {
            /* a missing frame must not hide the result */
          }
        }
      }
      setImages(shots);
    } catch (err) {
      setRunResult({ ok: false, error: err && err.message ? err.message : String(err), steps: [] });
    } finally {
      setRunning(false);
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

  return (
    <Box sx={{ display: 'flex', flex: 1, minHeight: 0, gap: 2, p: 2 }}>
      <Paper sx={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', border: '1px solid', borderColor: 'divider' }}>
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
              selected={selected && selected.relativePath === scenario.relativePath}
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
        {!selected && (
          <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <Typography variant="h6">Запишите первый сценарий</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 520 }}>
              Откройте приложение в браузере, пройдите путь руками — получится YAML-файл
              в репозитории. Его можно запустить здесь или в CI той же командой.
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={onRecord}>Record</Button>
          </Box>
        )}

        {selected && (
          <>
            <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{selected.name}</Typography>
              <Chip size="small" label={selected.relativePath} variant="outlined" />
              <Box sx={{ flex: 1 }} />
              {saveState && saveState.status === 'saving' && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Сохранение…</Typography>
              )}
              {saveState && saveState.status === 'saved' && (
                <Typography variant="caption" sx={{ color: 'success.main' }}>
                  Сохранено {saveState.at ? saveState.at.toLocaleTimeString() : ''}
                </Typography>
              )}
              {saveState && saveState.status === 'error' && (
                <Typography variant="caption" sx={{ color: 'error.main' }}>{saveState.message}</Typography>
              )}
              <Button
                variant="contained"
                size="small"
                startIcon={<PlayArrowIcon />}
                onClick={handleRun}
                disabled={running}
              >
                {running ? 'Running…' : 'Run'}
              </Button>
            </Box>
            <Divider />
            <Box
              component="textarea"
              value={text}
              onChange={(event) => setText(event.target.value)}
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
            {(runResult || images.length > 0) && (
              <Box sx={{ borderTop: '1px solid', borderColor: 'divider', maxHeight: '45%', overflow: 'auto', p: 1.5 }}>
                {runResult && (
                  <Alert severity={runResult.ok ? 'success' : 'error'} sx={{ mb: 1 }}>
                    {runResult.ok ? 'Passed' : 'Failed'} in {Math.round(runResult.durationMs || 0)} ms
                    {runResult.error ? ` — ${runResult.error}` : ''}
                  </Alert>
                )}
                <Box component="ol" sx={{ pl: 2, my: 1 }}>
                  {(runResult?.steps || []).map((step, index) => (
                    <li key={`${index}-${step.name}`}>
                      <Typography variant="body2" sx={{ color: step.ok ? 'success.main' : 'error.main' }}>
                        {step.ok ? '✓' : '✗'} {step.name}{step.error ? ` — ${step.error}` : ''}
                      </Typography>
                    </li>
                  ))}
                </Box>
                {images.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 1 }}>
                    {images.map((image) => (
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
