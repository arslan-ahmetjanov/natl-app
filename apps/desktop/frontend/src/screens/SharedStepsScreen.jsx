import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ApiRequestEditor from '../components/ApiRequestEditor';
import ScreenHeader from '../components/ScreenHeader';
import SectionLabel from '../components/SectionLabel';
import TestStepEditorCards from '../components/TestStepEditorCards';
import { buildApiStepEditorInitial, isStepApi } from '../utils/testSteps';

export default function SharedStepsScreen({ onBack, onRefresh }) {
  const [list, setList] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState('');
  const [steps, setSteps] = useState([]);
  const [allPages, setAllPages] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  const [apiBases, setApiBases] = useState([]);
  const [actions, setActions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [apiEditorOpen, setApiEditorOpen] = useState(false);
  const [apiEditorStepIndex, setApiEditorStepIndex] = useState(null);
  const [apiEditorInitial, setApiEditorInitial] = useState(null);
  const [savedStepsSignature, setSavedStepsSignature] = useState(null);

  const load = () => {
    if (!window.electronAPI) return;
    window.electronAPI.listSharedSteps().then(setList).catch(() => setList([]));
  };

  useEffect(() => load(), []);
  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.listPages().then(setAllPages).catch(() => setAllPages([]));
    window.electronAPI.getActions().then((a) => setActions(a || [])).catch(() => setActions([]));
  }, []);
  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.listEndpoints?.().then(setEndpoints).catch(() => setEndpoints([]));
    window.electronAPI.listApiBases?.().then(setApiBases).catch(() => setApiBases([]));
  }, []);

  const elementsWithPage = (allPages || []).flatMap((p) =>
    (p.webElements || []).map((el) => ({ ...el, pageId: p.id, pageTitle: p.title || p.url || p.id }))
  );

  const stepsDirty = useMemo(() => {
    if (!editOpen || savedStepsSignature == null) return false;
    return JSON.stringify(steps) !== savedStepsSignature;
  }, [editOpen, steps, savedStepsSignature]);

  const handleAdd = () => {
    setEditingId(null);
    setTitle('New shared step');
    setSteps([]);
    setSavedStepsSignature(JSON.stringify([]));
    setEditOpen(true);
  };

  const handleEdit = async (item) => {
    setEditingId(item.id);
    setTitle(item.title || '');
    const full = await window.electronAPI.getSharedStep(item.id).catch(() => null);
    const loaded = (full && full.steps) ? full.steps : [];
    setSteps(loaded);
    setSavedStepsSignature(JSON.stringify(loaded));
    setEditOpen(true);
  };

  const handleAddUiStep = () => {
    const first = elementsWithPage[0];
    const pageId = first?.pageId || allPages[0]?.id;
    setSteps((s) => [...s, { pageId, webElementId: first?.id || '', actionId: actions[0]?.id || '', value: '' }]);
  };

  const handleAddApiStep = (apiType) => {
    const base = apiType === 'request' ? { type: apiType, endpointId: endpoints[0]?.id || '', baseId: null, body: '{}' } : { type: apiType, value: apiType === 'assertStatus' ? '200' : '' };
    if (apiType === 'assertBody') base.jsonPath = '';
    setSteps((s) => [...s, base]);
  };

  const handleStepChange = (index, field, value) => {
    setSteps((s) => {
      const n = [...s];
      if (!n[index]) return s;
      if (field === 'element') {
        const v = value;
        const defaultPid = allPages[0]?.id;
        if (!v || typeof v !== 'string') n[index] = { ...n[index], pageId: defaultPid, webElementId: '' };
        else {
          const idx = v.indexOf('|');
          if (idx > 0) n[index] = { ...n[index], pageId: v.slice(0, idx), webElementId: v.slice(idx + 1) };
          else n[index] = { ...n[index], pageId: defaultPid, webElementId: v };
        }
      } else if (field === 'pageId') {
        const newPageId = value;
        let next = { ...n[index], pageId: newPageId };
        const stillValid = elementsWithPage.some((e) => e.pageId === newPageId && e.id === next.webElementId);
        if (!stillValid) next = { ...next, webElementId: '' };
        n[index] = next;
      } else {
        n[index] = { ...n[index], [field]: value };
      }
      return n;
    });
  };

  const handleApiStepChange = (index, field, value) => {
    setSteps((s) => {
      const n = [...s];
      if (!n[index]) return s;
      if (field === 'actionId') {
        n[index] = { ...n[index], type: 'api', actionId: value };
        return n;
      }
      n[index] = { ...n[index], [field]: value };
      return n;
    });
  };

  const handleOpenApiEditor = (index, initial) => {
    setApiEditorStepIndex(index);
    setApiEditorInitial(initial);
    setApiEditorOpen(true);
  };

  const handleSaveApiEditor = async ({ stepPatch, endpointPatch }) => {
    if (apiEditorStepIndex == null || !steps[apiEditorStepIndex]) return;
    const step = steps[apiEditorStepIndex];
    if (endpointPatch && step.endpointId) {
      try {
        await window.electronAPI.updateEndpoint(step.endpointId, endpointPatch);
        window.electronAPI.listEndpoints?.().then(setEndpoints).catch(() => {});
      } catch (e) {
        console.error(e);
      }
    }
    setSteps((s) => {
      const n = [...s];
      const idx = apiEditorStepIndex;
      if (idx == null || !n[idx]) return s;
      n[idx] = { ...n[idx], ...(stepPatch || {}) };
      return n;
    });
    setApiEditorOpen(false);
  };

  const handleRemoveStep = (index) => {
    setSteps((s) => s.filter((_, i) => i !== index));
  };

  const handleMoveStep = (index, direction) => {
    setSteps((s) => {
      const n = [...s];
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= n.length) return s;
      const [item] = n.splice(index, 1);
      n.splice(newIndex, 0, item);
      return n;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const stepsToSave = steps.map((s) =>
        isStepApi(s) ? s : { ...s, pageId: s.pageId || allPages[0]?.id }
      );
      if (editingId) {
        await window.electronAPI.updateSharedStep(editingId, { title: title.trim() || 'Untitled', steps: stepsToSave });
      } else {
        await window.electronAPI.createSharedStep({ title: title.trim() || 'Untitled', steps: stepsToSave });
      }
      setEditOpen(false);
      setSavedStepsSignature(JSON.stringify(stepsToSave));
      load();
      onRefresh?.();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await window.electronAPI.deleteSharedStep(id);
      load();
      onRefresh?.();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <ScreenHeader
        title="Shared steps"
        onBack={onBack}
        actions={<Button size="small" startIcon={<AddIcon />} onClick={handleAdd} sx={{ color: 'primary.main' }}>Add</Button>}
      />
      <SectionLabel sx={{ mb: 0.5 }}>Library</SectionLabel>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Reusable step sequences. In a UI test, add a step and choose &quot;Shared step&quot; to insert one. Edit a shared step to define its inner steps (element + action + value per row).
      </Typography>
      <Paper sx={{ flex: 1, overflow: 'auto', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
        <List dense>
          {list.length === 0 && (
            <ListItem><ListItemText primary="No shared steps" secondary="Add one to reuse in multiple tests" primaryTypographyProps={{ sx: { color: 'text.primary' } }} secondaryTypographyProps={{ sx: { color: 'text.secondary' } }} /></ListItem>
          )}
          {list.map((item) => (
            <ListItem key={item.id}>
              <ListItemText
                primary={item.title}
                secondary={`${(item.steps || []).length} step(s)`}
                primaryTypographyProps={{ sx: { color: 'text.primary' } }}
                secondaryTypographyProps={{ sx: { color: 'text.secondary' } }}
              />
              <ListItemSecondaryAction>
                <IconButton size="small" onClick={() => handleEdit(item)} sx={{ color: 'text.secondary' }}><EditIcon /></IconButton>
                <IconButton size="small" onClick={() => handleDelete(item.id)} sx={{ color: 'text.secondary' }}><DeleteIcon /></IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </Paper>

      <Dialog open={editOpen} onClose={() => !saving && setEditOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { bgcolor: 'background.paper' } }}>
        <DialogTitle sx={{ color: 'text.primary' }}>{editingId ? 'Edit shared step' : 'Add shared step'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            sx={{ mt: 1, mb: 2, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
          />
          {stepsDirty && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Unsaved step changes — Save in the dialog footer to keep them.
            </Alert>
          )}
          <SectionLabel sx={{ mb: 1 }}>Steps</SectionLabel>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
            <Button size="small" startIcon={<AddIcon />} onClick={handleAddUiStep} sx={{ color: 'primary.main' }}>Add UI step</Button>
            <Button size="small" startIcon={<AddIcon />} onClick={() => handleAddApiStep('request')} sx={{ color: 'primary.main' }}>Add API step</Button>
          </Box>
          {steps.length === 0 && (
            <Box sx={{ py: 2, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>No inner steps. Add UI or API steps for this shared block.</Typography>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={handleAddUiStep} sx={{ bgcolor: 'success.main', color: 'background.default' }}>Add UI step</Button>
                <Button size="small" variant="outlined" onClick={() => handleAddApiStep('request')} sx={{ color: 'primary.main' }}>Add API step</Button>
              </Box>
            </Box>
          )}
          {steps.length > 0 && (
            <TestStepEditorCards
              variant="shared"
              steps={steps}
              sharedCatalog={[]}
              pages={allPages}
              elementsWithPage={elementsWithPage}
              defaultPageId={allPages[0]?.id}
              endpoints={endpoints}
              apiBases={apiBases}
              actions={actions}
              onStepChange={handleStepChange}
              onApiStepChange={handleApiStepChange}
              onRemoveStep={handleRemoveStep}
              onMoveStep={handleMoveStep}
              onOpenApiEditor={handleOpenApiEditor}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} disabled={saving} sx={{ color: 'text.secondary' }}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} variant={stepsDirty ? 'contained' : 'outlined'} color="primary">Save</Button>
        </DialogActions>
      </Dialog>

      <ApiRequestEditor
        variant="step"
        open={apiEditorOpen && !!apiEditorInitial}
        onClose={() => setApiEditorOpen(false)}
        dialogTitle="Edit API request"
        initial={apiEditorInitial}
        onSaveStep={handleSaveApiEditor}
      />
    </Box>
  );
}
