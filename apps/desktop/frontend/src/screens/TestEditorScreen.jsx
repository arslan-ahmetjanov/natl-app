import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  TextField,
  List,
  ListItem,
  ListItemText,
  LinearProgress,
  Alert,
  Autocomplete,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import SectionLabel from '../components/SectionLabel';
import TestStepEditorCards from '../components/TestStepEditorCards';
import { isStepApi } from '../utils/testSteps';

export default function TestEditorScreen({
  testId,
  onBack,
  onRefresh,
  onOpenRun,
  onViewReport,
  onOpenSharedSteps,
}) {
  const [test, setTest] = useState(null);
  const [page, setPage] = useState(null);
  const [allPages, setAllPages] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  const [apiBases, setApiBases] = useState([]);
  const [sharedSteps, setSharedSteps] = useState([]);
  const [actions, setActions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [runInProgress, setRunInProgress] = useState(false);
  const [runProgressMessage, setRunProgressMessage] = useState('');
  const [runResultModalOpen, setRunResultModalOpen] = useState(false);
  const [runReport, setRunReport] = useState(null);
  const [runError, setRunError] = useState(null);
  const [savedStepsSignature, setSavedStepsSignature] = useState(null);
  const [sharedStepPickKey, setSharedStepPickKey] = useState(0);
  const sharedStepAcToolbarRef = useRef(null);
  const sharedStepAcEmptyRef = useRef(null);

  useEffect(() => {
    if (!testId || !window.electronAPI) return;
    let cancelled = false;
    window.electronAPI
      .getTest(testId)
      .then((t) => {
        if (cancelled) return;
        setTest(t);
        if (t) setSavedStepsSignature(JSON.stringify(t.steps || []));
        else setSavedStepsSignature(null);
      })
      .catch(() => {
        if (!cancelled) {
          setTest(null);
          setSavedStepsSignature(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [testId]);

  useEffect(() => {
    if (!test?.pageId || !window.electronAPI) return;
    window.electronAPI.getPage(test.pageId).then(setPage).catch(() => setPage(null));
  }, [test?.pageId]);

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.listPages().then(setAllPages).catch(() => setAllPages([]));
  }, []);

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.listEndpoints().then(setEndpoints).catch(() => setEndpoints([]));
  }, []);

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.listApiBases?.().then(setApiBases).catch(() => setApiBases([]));
  }, []);

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.listSharedSteps().then(setSharedSteps).catch(() => setSharedSteps([]));
  }, []);

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.getActions().then((list) => setActions(list || [])).catch(() => setActions([]));
  }, []);

  useEffect(() => {
    if (!runInProgress || !window.electronAPI?.onTestRunProgress) return;
    const unsub = window.electronAPI.onTestRunProgress((e) => setRunProgressMessage(e?.message || 'Running...'));
    return () => unsub?.();
  }, [runInProgress]);

  const steps = test?.steps || [];

  const stepsDirty = useMemo(() => {
    if (savedStepsSignature == null || !test) return false;
    return JSON.stringify(test.steps || []) !== savedStepsSignature;
  }, [test, savedStepsSignature]);
  const elements = page?.webElements || [];
  const elementsWithPage =
    (allPages || []).length > 0
      ? (allPages || []).flatMap((p) =>
          (p.webElements || []).map((el) => ({ ...el, pageId: p.id, pageTitle: p.title || p.url || p.id }))
        )
      : (page ? (page.webElements || []).map((el) => ({ ...el, pageId: page.id, pageTitle: page.title || page.url || page.id })) : []);
  const handleTitleChange = (title) => {
    setTest((t) => (t ? { ...t, title } : null));
  };

  const handleSaveTitle = async () => {
    if (!testId || !test) return;
    setSaving(true);
    try {
      await window.electronAPI.updateTest(testId, { title: test.title });
      onRefresh?.();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const isApiTest = test?.type === 'api';

  const handleAddUiStep = () => {
    const defaultPageId = test?.pageId || allPages[0]?.id;
    const firstEl = elements[0] || elementsWithPage[0];
    const newStep = {
      type: 'ui',
      pageId: defaultPageId,
      webElementId: firstEl?.id || '',
      actionId: actions[0]?.id || '',
      value: '',
    };
    setTest((t) => (t ? { ...t, steps: [...(t.steps || []), newStep] } : null));
  };

  const handleAddApiStep = () => {
    const newStep = { type: 'api', actionId: 'request', endpointId: endpoints[0]?.id || '', body: '{}' };
    setTest((t) => (t ? { ...t, steps: [...(t.steps || []), newStep] } : null));
  };

  const handleAddSharedStep = (sharedStepId) => {
    if (!sharedStepId) return;
    setTest((t) => (t ? { ...t, steps: [...(t.steps || []), { sharedStepId }] } : null));
  };

  const focusSharedStepSearch = () => {
    const root = sharedStepAcToolbarRef.current || sharedStepAcEmptyRef.current;
    root?.querySelector?.('input')?.focus();
  };

  const handleAddSharedStepToolbar = () => {
    if (sharedSteps.length === 0) {
      onOpenSharedSteps?.();
      return;
    }
    focusSharedStepSearch();
  };

  const sharedStepAutocomplete = (boxRef) => (
    <Box ref={boxRef} sx={{ minWidth: 220, maxWidth: 400, flex: '1 1 220px' }}>
      <Autocomplete
        key={sharedStepPickKey}
        fullWidth
        size="small"
        options={sharedSteps}
        value={null}
        onChange={(_, option) => {
          if (option?.id) {
            handleAddSharedStep(option.id);
            setSharedStepPickKey((k) => k + 1);
          }
        }}
        getOptionLabel={(o) => o?.title || o?.id || ''}
        filterOptions={(options, state) => {
          const q = state.inputValue.trim().toLowerCase();
          if (!q) return options;
          return options.filter((o) => {
            const title = (o.title || '').toLowerCase();
            const id = (o.id || '').toLowerCase();
            return title.includes(q) || id.includes(q);
          });
        }}
        noOptionsText="No matching shared steps"
        renderInput={(params) => (
          <TextField
            {...params}
            label="Insert shared step"
            placeholder="Search shared step…"
            sx={{ '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
          />
        )}
      />
    </Box>
  );

  const handleStepChange = (index, field, value) => {
    setTest((t) => {
      if (!t) return null;
      const s = [...(t.steps || [])];
      if (!s[index]) return t;
      if (field === 'element') {
        const v = value;
        if (!v || typeof v !== 'string') {
          s[index] = { ...s[index], pageId: t.pageId, webElementId: '' };
        } else {
          const idx = v.indexOf('|');
          if (idx > 0) s[index] = { ...s[index], pageId: v.slice(0, idx), webElementId: v.slice(idx + 1) };
          else s[index] = { ...s[index], pageId: t.pageId, webElementId: v };
        }
      } else if (field === 'pageId') {
        const newPageId = value;
        let next = { ...s[index], pageId: newPageId };
        const stillValid = elementsWithPage.some((e) => e.pageId === newPageId && e.id === next.webElementId);
        if (!stillValid) next = { ...next, webElementId: '' };
        s[index] = next;
      } else {
        s[index] = { ...s[index], [field]: value };
      }
      return { ...t, steps: s };
    });
  };

  const handleApiStepChange = (index, field, value) => {
    setTest((t) => {
      if (!t) return null;
      const s = [...(t.steps || [])];
      if (!s[index]) return t;
      s[index] = { ...s[index], [field]: value };
      return { ...t, steps: s };
    });
  };

  const handleRemoveStep = (index) => {
    setTest((t) => {
      if (!t) return null;
      const s = (t.steps || []).filter((_, i) => i !== index);
      return { ...t, steps: s };
    });
  };

  const handleMoveStep = (index, direction) => {
    setTest((t) => {
      if (!t) return null;
      const s = [...(t.steps || [])];
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= s.length) return t;
      const [item] = s.splice(index, 1);
      s.splice(newIndex, 0, item);
      return { ...t, steps: s };
    });
  };

  const handleSaveSteps = async () => {
    if (!testId || !test) return;
    setSaving(true);
    try {
      const stepsToSave = (test.steps || []).map((s) => {
        if (s.sharedStepId) return s;
        if (isStepApi(s)) return s;
        return { ...s, type: 'ui', pageId: s.pageId || test.pageId };
      });
      await window.electronAPI.updateTest(testId, { steps: stepsToSave });
      setSavedStepsSignature(JSON.stringify(stepsToSave));
      onRefresh?.();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async () => {
    setRunInProgress(true);
    setRunProgressMessage('Starting...');
    setRunReport(null);
    setRunError(null);
    try {
      const report = await window.electronAPI.runTest(testId);
      setRunReport(report || null);
      setRunResultModalOpen(true);
    } catch (e) {
      setRunError(e.message || 'Run failed');
      setRunResultModalOpen(true);
    } finally {
      setRunInProgress(false);
    }
  };

  const handleDeleteTest = async () => {
    setDeleteLoading(true);
    try {
      await window.electronAPI.deleteTest(testId);
      setDeleteConfirmOpen(false);
      onBack?.();
      onRefresh?.();
    } catch (e) {
      console.error(e);
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!test) {
    return (
      <Box sx={{ p: 2, color: 'text.secondary' }}>
        <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ color: 'primary.main', mb: 2 }}>Back</Button>
        <Typography>Test not found.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ color: 'primary.main' }}>Back</Button>
        <TextField
          size="small"
          value={test.title}
          onChange={(e) => handleTitleChange(e.target.value)}
          onBlur={handleSaveTitle}
          sx={{ flex: 1, minWidth: 200, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
        />
        <Button size="small" variant="contained" startIcon={<PlayArrowIcon />} onClick={handleRun} disabled={runInProgress} sx={{ bgcolor: 'success.main', color: 'background.default', '&:hover': { bgcolor: 'success.dark' } }}>
          {runInProgress ? 'Running…' : 'Run'}
        </Button>
        <Button size="small" startIcon={<DeleteOutlineIcon />} onClick={() => setDeleteConfirmOpen(true)} sx={{ color: 'error.main' }}>
          Delete test
        </Button>
      </Box>
      {runInProgress && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>{runProgressMessage}</Typography>
          <LinearProgress />
        </Box>
      )}

      <Dialog open={runResultModalOpen} onClose={() => setRunResultModalOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: 'background.paper' } }}>
        <DialogTitle sx={{ color: 'text.primary' }}>{runError ? 'Run failed' : (runReport?.testTitle || test.title)}</DialogTitle>
        <DialogContent>
          {runError && <Typography sx={{ color: 'error.main' }}>{runError}</Typography>}
          {runReport && !runError && (
            <>
              <Typography sx={{ color: runReport.status === 'passed' ? 'success.main' : 'error.main', mb: 2 }}>
                Status: {runReport.status || '—'} {runReport.executionTime != null && `(${runReport.executionTime}ms)`}
              </Typography>
              <Typography variant="overline" sx={{ color: 'primary.main' }}>Steps</Typography>
              <List dense>
                {(runReport.steps || []).map((step, i) => (
                  <ListItem key={i}>
                    <ListItemText primary={step.value != null ? step.value : `Step ${i + 1}`} secondary={step.error || step.status} primaryTypographyProps={{ sx: { color: 'text.primary' } }} secondaryTypographyProps={{ sx: { color: step.error ? 'error.main' : 'text.secondary' } }} />
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRunResultModalOpen(false)} sx={{ color: 'text.secondary' }}>Close</Button>
          {runReport?.id && onViewReport && <Button onClick={() => { onViewReport(runReport.id); setRunResultModalOpen(false); }} variant="contained" sx={{ bgcolor: 'success.main', color: 'background.default', '&:hover': { bgcolor: 'success.dark' } }}>View full report</Button>}
        </DialogActions>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onClose={() => !deleteLoading && setDeleteConfirmOpen(false)} PaperProps={{ sx: { bgcolor: 'background.paper' } }}>
        <DialogTitle sx={{ color: 'text.primary' }}>Delete test</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'text.primary' }}>Delete test &quot;{test.title}&quot;?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)} disabled={deleteLoading} sx={{ color: 'text.secondary' }}>Cancel</Button>
          <Button onClick={handleDeleteTest} disabled={deleteLoading} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      {!isApiTest && <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>Page: {page?.title || test.pageId}</Typography>}
      {stepsDirty && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          You have unsaved step changes. Click Save to persist them to the workspace.
        </Alert>
      )}
      <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <SectionLabel sx={{ mb: 0 }}>Steps</SectionLabel>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button size="small" startIcon={<AddIcon />} onClick={handleAddUiStep} sx={{ color: 'primary.main' }}>Add UI step</Button>
            <Button size="small" startIcon={<AddIcon />} onClick={handleAddApiStep} sx={{ color: 'primary.main' }}>Add API step</Button>
            <Button size="small" startIcon={<AddIcon />} onClick={handleAddSharedStepToolbar} sx={{ color: 'primary.main' }}>Add shared step</Button>
            {sharedSteps.length > 0 ? (
              sharedStepAutocomplete(sharedStepAcToolbarRef)
            ) : (
              <Typography variant="caption" sx={{ color: 'text.secondary', alignSelf: 'center' }}>
                No shared steps in workspace.
                {onOpenSharedSteps ? ' Use Add shared step to open Shared Steps.' : ''}
              </Typography>
            )}
            <Button size="small" variant={stepsDirty ? 'contained' : 'outlined'} color="primary" onClick={handleSaveSteps} disabled={saving}>Save steps</Button>
          </Box>
        </Box>
        {steps.length === 0 && (
          <Box sx={{ py: 3, px: 1, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              No steps yet. Add a UI step to interact with the page, or an API step for HTTP requests and assertions.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={handleAddUiStep} sx={{ bgcolor: 'success.main', color: 'background.default' }}>Add UI step</Button>
              <Button size="small" variant="outlined" onClick={handleAddApiStep} sx={{ color: 'primary.main' }}>Add API step</Button>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center', mt: 2 }}>
              <Button size="small" startIcon={<AddIcon />} onClick={handleAddSharedStepToolbar} sx={{ color: 'primary.main' }}>Add shared step</Button>
              {sharedSteps.length > 0 ? (
                sharedStepAutocomplete(sharedStepAcEmptyRef)
              ) : (
                <Typography variant="caption" sx={{ color: 'text.secondary', alignSelf: 'center' }}>
                  No shared steps yet. Use Add shared step in this row to open Shared Steps.
                </Typography>
              )}
            </Box>
          </Box>
        )}
        {steps.length > 0 && (
          <TestStepEditorCards
            variant="test"
            steps={steps}
            sharedCatalog={sharedSteps}
            pages={allPages}
            elementsWithPage={elementsWithPage}
            defaultPageId={test.pageId || allPages[0]?.id}
            testPageId={test.pageId}
            endpoints={endpoints}
            apiBases={apiBases}
            actions={actions}
            onStepChange={handleStepChange}
            onApiStepChange={handleApiStepChange}
            onRemoveStep={handleRemoveStep}
            onMoveStep={handleMoveStep}
          />
        )}
      </Paper>
    </Box>
  );
}
