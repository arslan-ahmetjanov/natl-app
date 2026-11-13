import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Chip,
  Checkbox,
  CircularProgress,
  LinearProgress,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AddIcon from '@mui/icons-material/Add';
import ScreenHeader from '../components/ScreenHeader';
import SectionLabel from '../components/SectionLabel';

export default function RunScreen({ onBack, onRefresh, onViewReport }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedTests, setSelectedTests] = useState([]);
  const [workers, setWorkers] = useState(1);
  const [screenshotOnFailureOnly, setScreenshotOnFailureOnly] = useState(false);
  const [fileRunLogging, setFileRunLogging] = useState(false);
  const [running, setRunning] = useState(false);
  const runProgressActiveRef = useRef(false);
  const [runOrderIds, setRunOrderIds] = useState([]);
  const [runProgressById, setRunProgressById] = useState({});
  const [lastReportId, setLastReportId] = useState(null);
  const [lastRunLogDir, setLastRunLogDir] = useState(null);
  const [runError, setRunError] = useState(null);
  const [buildOpen, setBuildOpen] = useState(false);
  const [pages, setPages] = useState([]);
  const [builderPageId, setBuilderPageId] = useState('');
  const [builderQuery, setBuilderQuery] = useState('');
  const [builderType, setBuilderType] = useState('');
  const [builderList, setBuilderList] = useState([]);
  const [builderLoading, setBuilderLoading] = useState(false);
  const [builderOffset, setBuilderOffset] = useState(0);
  const builderLimit = 100;

  useEffect(() => {
    if (!window.electronAPI?.onTestRunProgress) return;
    const unsub = window.electronAPI.onTestRunProgress((e) => {
      if (!runProgressActiveRef.current || !e?.testId) return;
      setRunProgressById((prev) => {
        const id = e.testId;
        const row = prev[id] || {
          title: e.testTitle || id,
          status: 'queued',
          message: '',
          stepIndex: 0,
          total: 0,
          error: null,
          runStage: 'step',
        };
        if (e.phase === 'started') {
          return {
            ...prev,
            [id]: {
              ...row,
              title: e.testTitle || row.title,
              status: 'running',
              message: 'Starting…',
              stepIndex: 0,
              total: 0,
              runStage: 'step',
            },
          };
        }
        if (e.phase === 'finished') {
          const passed = e.passed === true;
          const total = row.total > 0 ? row.total : Math.max(1, row.stepIndex || 1);
          return {
            ...prev,
            [id]: {
              ...row,
              title: e.testTitle || row.title,
              status: passed ? 'passed' : 'failed',
              message: e.message || '',
              error: e.error ?? null,
              stepIndex: total,
              total,
              runStage: null,
            },
          };
        }
        const runStage = e.runStage != null ? e.runStage : 'step';
        return {
          ...prev,
          [id]: {
            ...row,
            title: e.testTitle || row.title,
            status: 'running',
            stepIndex: e.stepIndex ?? row.stepIndex,
            total: e.total ?? row.total,
            message: e.message != null ? e.message : row.message,
            runStage,
          },
        };
      });
    });
    return () => unsub?.();
  }, []);

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.listPages().then(setPages).catch(() => setPages([]));
  }, []);

  const syncSelectedTests = (nextIds, sourceList) => {
    setSelectedIds(nextIds);
    setSelectedTests((prev) => {
      const byId = new Map(prev.map((t) => [t.id, t]));
      for (const t of sourceList || []) byId.set(t.id, t);
      return nextIds.map((id) => byId.get(id)).filter(Boolean);
    });
  };

  const toggleTest = (test, sourceList) => {
    const nextIds = selectedIds.includes(test.id)
      ? selectedIds.filter((x) => x !== test.id)
      : [...selectedIds, test.id];
    syncSelectedTests(nextIds, sourceList || [test]);
  };

  const currentFilterOptions = () => ({
    pageId: builderPageId || null,
    titleQuery: builderQuery || '',
    type: builderType || '',
  });

  const loadBuilderTests = async (offset = 0, append = false) => {
    setBuilderLoading(true);
    try {
      const list = await window.electronAPI.listTests({
        ...currentFilterOptions(),
        limit: builderLimit,
        offset,
      });
      setBuilderList((prev) => (append ? [...prev, ...(list || [])] : (list || [])));
      setBuilderOffset(offset);
    } catch {
      if (!append) setBuilderList([]);
    } finally {
      setBuilderLoading(false);
    }
  };

  const handleSelectAllMatching = async () => {
    try {
      const idRows = await window.electronAPI.listTests({
        ...currentFilterOptions(),
        fields: 'id',
      });
      const allIds = (idRows || []).map((x) => x.id).filter(Boolean);
      if (allIds.length === 0) return;
      const nextIds = Array.from(new Set([...selectedIds, ...allIds]));
      syncSelectedTests(nextIds, builderList);
      const missingIds = allIds.filter((id) => !selectedTests.some((t) => t.id === id) && !builderList.some((t) => t.id === id));
      if (missingIds.length > 0) {
        const loadedAll = await window.electronAPI.listTests({
          ...currentFilterOptions(),
        });
        syncSelectedTests(nextIds, [...builderList, ...(loadedAll || [])]);
      }
    } catch {
      // ignore selection fetch errors; existing selection remains
    }
  };

  const handleClearAllMatching = async () => {
    try {
      const idRows = await window.electronAPI.listTests({
        ...currentFilterOptions(),
        fields: 'id',
      });
      const matchingIds = new Set((idRows || []).map((x) => x.id).filter(Boolean));
      if (matchingIds.size === 0) return;
      const nextIds = selectedIds.filter((id) => !matchingIds.has(id));
      syncSelectedTests(nextIds, builderList);
    } catch {
      // ignore clear errors; existing selection remains
    }
  };

  const openBuilder = async () => {
    setBuildOpen(true);
    setBuilderPageId('');
    setBuilderQuery('');
    setBuilderType('');
    await loadBuilderTests(0, false);
  };

  useEffect(() => {
    if (!buildOpen) return;
    const t = setTimeout(() => {
      loadBuilderTests(0, false);
    }, 250);
    return () => clearTimeout(t);
  }, [builderPageId, builderQuery, builderType]);

  const handleRun = async () => {
    if (selectedIds.length === 0) return;
    const orderedIds = [...selectedIds];
    const initialById = {};
    for (const id of orderedIds) {
      const t = selectedTests.find((s) => s.id === id);
      initialById[id] = {
        title: t?.title || id,
        status: 'queued',
        message: '',
        stepIndex: 0,
        total: 0,
        error: null,
        runStage: 'step',
      };
    }
    setRunning(true);
    setRunError(null);
    setRunOrderIds(orderedIds);
    setRunProgressById(initialById);
    setLastReportId(null);
    setLastRunLogDir(null);
    runProgressActiveRef.current = true;
    try {
      const runRes = await window.electronAPI.runTests({
        testIds: selectedIds,
        concurrency: workers,
        screenshotOnFailureOnly,
        fileRunLogging,
      });
      if (runRes?.runLogDir) setLastRunLogDir(runRes.runLogDir);
      const list = await window.electronAPI.reportsList(null);
      if (list?.length > 0) setLastReportId(list[0].id);
      onRefresh?.();
    } catch (e) {
      setRunError(e.message || 'Run failed');
    } finally {
      runProgressActiveRef.current = false;
      setRunning(false);
      setRunOrderIds([]);
      setRunProgressById({});
    }
  };

  const handleOpenRunLogDir = async () => {
    if (!lastRunLogDir || !window.electronAPI?.openPathInExplorer) return;
    try {
      await window.electronAPI.openPathInExplorer(lastRunLogDir);
    } catch (e) {
      setRunError(e?.message || String(e));
    }
  };

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <ScreenHeader title="Run tests" onBack={onBack} />
      <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
        <SectionLabel>Run set</SectionLabel>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
          Create run set through modal filters (safe for thousands of tests). Selected: {selectedIds.length}
        </Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={openBuilder} sx={{ color: 'primary.main', mb: 1 }}>
          Add tests to run set
        </Button>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          {selectedTests.map((t) => (
            <Chip
              key={t.id}
              size="small"
              label={t.title || t.id}
              onDelete={() => {
                const next = selectedIds.filter((id) => id !== t.id);
                syncSelectedTests(next, []);
              }}
            />
          ))}
          {selectedTests.length === 0 && (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Run set is empty.
            </Typography>
          )}
        </Box>
      </Paper>
      <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
        <SectionLabel>Run options</SectionLabel>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, mt: 1, columnGap: 2, rowGap: 1 }}>
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel id="run-workers-label" sx={{ color: 'text.secondary' }}>Workers</InputLabel>
            <Select
              labelId="run-workers-label"
              value={workers}
              label="Workers"
              onChange={(e) => setWorkers(Number(e.target.value))}
              sx={{ color: 'text.primary', '.MuiOutlinedInput-notchedOutline': { borderColor: 'divider' } }}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <MenuItem key={n} value={n}>{n}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: { xs: 1, sm: 2 } }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={screenshotOnFailureOnly}
                  onChange={(e) => setScreenshotOnFailureOnly(e.target.checked)}
                  sx={{ color: 'primary.main' }}
                />
              }
              label={<Typography sx={{ color: 'text.primary', fontSize: '0.875rem' }}>Screenshots only on failure</Typography>}
              sx={{ mr: 0 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={fileRunLogging}
                  onChange={(e) => setFileRunLogging(e.target.checked)}
                  sx={{ color: 'primary.main' }}
                />
              }
              label={<Typography sx={{ color: 'text.primary', fontSize: '0.875rem' }}>Write run logs to disk (debug)</Typography>}
              sx={{ mr: 0 }}
            />
          </Box>
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75, ml: 0.25 }}>
          {`When enabled, logs are written under .testblox/run-logs/<session id>/ (run.log, meta.json, one .log per test).`}
        </Typography>
        <Button
          variant="contained"
          startIcon={running ? <CircularProgress size={20} color="inherit" /> : <PlayArrowIcon />}
          disabled={running || selectedIds.length === 0}
          onClick={handleRun}
          title={selectedIds.length === 0 ? 'Select at least one test' : undefined}
          sx={{ mt: 2, bgcolor: 'primary.main' }}
        >
          {running ? 'Running...' : `Run selected${selectedIds.length ? ` (${selectedIds.length})` : ''}`}
        </Button>
      </Paper>
      {runOrderIds.length > 0 && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
          <SectionLabel>Run progress</SectionLabel>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1.5 }}>
            {runOrderIds.map((id) => {
              const row = runProgressById[id];
              if (!row) return null;
              const { title, status, message, stepIndex, total, error, runStage } = row;
              const secondary =
                status === 'queued'
                  ? 'Queued'
                  : status === 'passed'
                    ? (message || 'Passed')
                    : status === 'failed'
                      ? [message, error].filter(Boolean).join(' — ') || 'Failed'
                      : (message || 'Running…');
              let progressBar = null;
              if (status === 'queued') {
                progressBar = <LinearProgress variant="indeterminate" sx={{ mt: 1, opacity: 0.45 }} />;
              } else if (status === 'running' && (runStage === 'teardown' || runStage === 'persist')) {
                progressBar = (
                  <LinearProgress variant="determinate" value={100} color="info" sx={{ mt: 1 }} />
                );
              } else if (status === 'running' && total > 0) {
                const pct = (stepIndex / total) * 100;
                progressBar = (
                  <LinearProgress
                    variant="determinate"
                    value={pct}
                    color={runStage === 'screenshot' ? 'secondary' : 'primary'}
                    sx={{ mt: 1, ...(runStage === 'screenshot' ? { opacity: 0.9 } : {}) }}
                  />
                );
              } else if (status === 'running') {
                progressBar = <LinearProgress variant="indeterminate" sx={{ mt: 1, opacity: 0.7 }} />;
              } else if (status === 'passed') {
                progressBar = <LinearProgress variant="determinate" value={100} color="success" sx={{ mt: 1 }} />;
              } else if (status === 'failed') {
                progressBar = <LinearProgress variant="determinate" value={100} color="error" sx={{ mt: 1 }} />;
              }
              return (
                <Box key={id}>
                  <Typography variant="subtitle2" sx={{ color: 'text.primary', fontWeight: 600 }}>
                    {title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>{secondary}</Typography>
                  {progressBar}
                </Box>
              );
            })}
          </Box>
        </Paper>
      )}
      {runError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {runError}
        </Alert>
      )}
      {!running && (lastReportId || lastRunLogDir) && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {lastReportId && (
            <Button variant="outlined" onClick={() => onViewReport?.(lastReportId)} sx={{ color: 'primary.main', borderColor: 'primary.main' }}>
              View latest report
            </Button>
          )}
          {lastRunLogDir && (
            <Button variant="outlined" onClick={handleOpenRunLogDir} sx={{ color: 'primary.main', borderColor: 'primary.main' }}>
              Open log folder
            </Button>
          )}
        </Box>
      )}
      <Dialog open={buildOpen} onClose={() => setBuildOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: 'background.paper' } }}>
        <DialogTitle sx={{ color: 'text.primary' }}>Create run set</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 1, mt: 1, mb: 1, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Page</InputLabel>
              <Select value={builderPageId} label="Page" onChange={(e) => setBuilderPageId(e.target.value)}>
                <MenuItem value="">All pages</MenuItem>
                {pages.map((p) => <MenuItem key={p.id} value={p.id}>{p.title || p.url || p.id}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Type</InputLabel>
              <Select value={builderType} label="Type" onChange={(e) => setBuilderType(e.target.value)}>
                <MenuItem value="">All types</MenuItem>
                <MenuItem value="ui">UI</MenuItem>
                <MenuItem value="api">API</MenuItem>
                <MenuItem value="hybrid">Hybrid</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="Search title"
              value={builderQuery}
              onChange={(e) => setBuilderQuery(e.target.value)}
              sx={{ minWidth: 180, flex: 1 }}
            />
          </Box>
          {builderLoading && <LinearProgress sx={{ mb: 1 }} />}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Loaded: {builderList.length} | Selected: {selectedIds.length}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" onClick={handleSelectAllMatching} sx={{ color: 'primary.main' }}>
                Select all
              </Button>
              <Button size="small" onClick={handleClearAllMatching} sx={{ color: 'text.secondary' }}>
                Clear all
              </Button>
            </Box>
          </Box>
          <List dense sx={{ maxHeight: 340, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            {builderList.map((t) => (
              <ListItem key={t.id} disablePadding>
                <ListItemButton onClick={() => toggleTest(t, builderList)} dense>
                  <Checkbox checked={selectedIds.includes(t.id)} sx={{ color: 'primary.main', p: 0.5, mr: 1 }} />
                  <ListItemText
                    primary={t.title || '—'}
                    secondary={t.type || 'ui'}
                    primaryTypographyProps={{ sx: { color: 'text.primary' } }}
                    secondaryTypographyProps={{ sx: { color: 'text.secondary' } }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
            {!builderLoading && builderList.length === 0 && (
              <ListItem><ListItemText primary="No tests match current filters" sx={{ color: 'text.secondary' }} /></ListItem>
            )}
          </List>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
            <Button
              size="small"
              onClick={() => loadBuilderTests(builderOffset + builderLimit, true)}
              disabled={builderLoading || builderList.length < builderLimit}
              sx={{ color: 'primary.main' }}
            >
              Load more
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBuildOpen(false)} sx={{ color: 'text.secondary' }}>Done</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
