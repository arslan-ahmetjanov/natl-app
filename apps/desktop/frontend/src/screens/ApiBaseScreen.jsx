import { useState, useEffect } from 'react';
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
  DialogContentText,
  DialogActions,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import LinkIcon from '@mui/icons-material/Link';
import ApiRequestEditor from '../components/ApiRequestEditor';

function objectToKeyValue(obj) {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj).map(([key, value]) => ({ key, value: value != null ? String(value) : '' }));
}

function parametersToParamRows(parameters) {
  if (!Array.isArray(parameters) || parameters.length === 0) return [{ key: '', value: '' }];
  return parameters.map((p) => ({
    key: p.name ?? '',
    value: p.value != null ? String(p.value) : '',
  }));
}

function bodyToFormFields(body) {
  if (!body) return [{ key: '', value: '', fieldType: 'text' }];
  if (Array.isArray(body)) {
    const rows = body.map((row) => ({
      key: String(row.key ?? row.name ?? ''),
      value: row.value != null ? String(row.value) : '',
      fieldType: row.fieldType === 'file' || row.type === 'file' ? 'file' : 'text',
    }));
    return rows.filter((r) => r.key || r.value).length ? rows : [{ key: '', value: '', fieldType: 'text' }];
  }
  if (typeof body === 'object') {
    return Object.entries(body).map(([key, value]) => ({
      key,
      value: String(value),
      fieldType: 'text',
    }));
  }
  return [{ key: '', value: '', fieldType: 'text' }];
}

function endpointToEditorInitial(ep) {
  const bodyMode =
    ep.bodyMode || (ep.requestBody != null && ep.requestBody !== '' && !ep.body ? 'raw' : 'none') || 'none';
  let rawBody = '';
  if (bodyMode === 'raw') {
    if (typeof ep.body === 'string') rawBody = ep.body;
    else if (ep.body && typeof ep.body === 'object') rawBody = JSON.stringify(ep.body, null, 2);
    else if (ep.requestBody != null) {
      rawBody = typeof ep.requestBody === 'string' ? ep.requestBody : JSON.stringify(ep.requestBody, null, 2);
    }
  }
  return {
    title: ep.title || '',
    summary: ep.summary || '',
    method: (ep.method || 'GET').toUpperCase(),
    path: ep.path || '/',
    paramRows: parametersToParamRows(ep.parameters),
    headerRows: objectToKeyValue(ep.headers).length ? objectToKeyValue(ep.headers) : [{ key: '', value: '' }],
    auth:
      ep.auth && (ep.auth.type === 'bearer' || ep.auth.type === 'basic')
        ? {
            type: ep.auth.type,
            token: ep.auth.token ?? '',
            username: ep.auth.username ?? '',
            password: ep.auth.password ?? '',
          }
        : { type: 'none', token: '', username: '', password: '' },
    bodyMode,
    rawBody,
    rawSubtype: 'json',
    formFields: bodyToFormFields(
      bodyMode === 'x-www-form-urlencoded' || bodyMode === 'form-data' ? ep.body : null
    ),
  };
}

const emptyEditorInitial = () => ({
  title: 'New Endpoint',
  summary: '',
  method: 'GET',
  path: '/',
  paramRows: [{ key: '', value: '' }],
  headerRows: [{ key: '', value: '' }],
  auth: { type: 'none', token: '', username: '', password: '' },
  bodyMode: 'none',
  rawBody: '',
  rawSubtype: 'json',
  formFields: [{ key: '', value: '', fieldType: 'text' }],
});

export default function ApiBaseScreen({ baseId, onBack, onRefresh }) {
  const [base, setBase] = useState(null);
  const [endpoints, setEndpoints] = useState([]);
  const [editingBase, setEditingBase] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBaseUrl, setEditBaseUrl] = useState('');
  const [baseSaveLoading, setBaseSaveLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [endpointEditorInitial, setEndpointEditorInitial] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteBaseOpen, setDeleteBaseOpen] = useState(false);
  const [deleteBaseLoading, setDeleteBaseLoading] = useState(false);

  const loadBase = () => {
    if (!baseId || !window.electronAPI?.getApiBase) return;
    window.electronAPI
      .getApiBase(baseId)
      .then((data) => {
        setBase(data);
        setEditTitle(data?.title ?? '');
        setEditBaseUrl(data?.baseUrl ?? '');
      })
      .catch(() => setBase(null));
  };

  const loadEndpoints = () => {
    if (!baseId || !window.electronAPI?.listEndpoints) return;
    window.electronAPI.listEndpoints(baseId).then(setEndpoints).catch(() => setEndpoints([]));
  };

  useEffect(() => {
    loadBase();
    loadEndpoints();
  }, [baseId]);

  const handleSaveBase = async () => {
    if (!baseId) return;
    setBaseSaveLoading(true);
    try {
      await window.electronAPI.updateApiBase(baseId, { title: editTitle.trim(), baseUrl: editBaseUrl.trim() });
      setEditingBase(false);
      loadBase();
      onRefresh?.();
    } catch (e) {
      console.error(e);
    } finally {
      setBaseSaveLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingId(null);
    setEndpointEditorInitial(emptyEditorInitial());
    setEditOpen(true);
  };

  const handleEdit = (ep) => {
    setEditingId(ep.id);
    setEndpointEditorInitial(endpointToEditorInitial(ep));
    setEditOpen(true);
  };

  const handleSaveFromEditor = async (payload) => {
    setSaving(true);
    try {
      const data = {
        title: payload.title,
        method: payload.method,
        path: payload.path,
        summary: payload.summary,
        baseId,
        parameters: payload.parameters,
        headers: payload.headers,
        auth: payload.auth,
        bodyMode: payload.bodyMode,
        body: payload.body,
      };
      if (editingId) {
        await window.electronAPI.updateEndpoint(editingId, data);
      } else {
        await window.electronAPI.createEndpoint(data);
      }
      setEditOpen(false);
      loadEndpoints();
      onRefresh?.();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await window.electronAPI.deleteEndpoint(id);
      loadEndpoints();
      onRefresh?.();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteBase = async () => {
    if (!baseId || !window.electronAPI?.deleteApiBase) return;
    setDeleteBaseLoading(true);
    try {
      await window.electronAPI.deleteApiBase(baseId);
      setDeleteBaseOpen(false);
      onRefresh?.();
      onBack?.();
    } catch (e) {
      console.error(e);
    } finally {
      setDeleteBaseLoading(false);
    }
  };

  if (!base && baseId) {
    return (
      <Box sx={{ p: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ color: 'primary.main' }}>
          Back
        </Button>
        <Typography sx={{ color: 'text.secondary', mt: 2 }}>Base not found.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ color: 'primary.main' }}>
          Back
        </Button>
        {editingBase ? (
          <>
            <TextField
              size="small"
              placeholder="Title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              sx={{ flex: 1, minWidth: 120, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
            />
            <TextField
              size="small"
              placeholder="Base URL"
              value={editBaseUrl}
              onChange={(e) => setEditBaseUrl(e.target.value)}
              sx={{ flex: 1, minWidth: 200, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
            />
            <Button size="small" onClick={handleSaveBase} disabled={baseSaveLoading} sx={{ color: 'primary.main' }}>
              Save
            </Button>
            <Button size="small" onClick={() => setEditingBase(false)} sx={{ color: 'text.secondary' }}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Typography variant="h6" sx={{ color: 'text.primary', flex: 1 }}>
              {base?.title}
            </Typography>
            <Button size="small" startIcon={<EditIcon />} onClick={() => setEditingBase(true)} sx={{ color: 'primary.main' }}>
              Edit
            </Button>
            <Button size="small" color="error" variant="outlined" startIcon={<DeleteIcon />} onClick={() => setDeleteBaseOpen(true)}>
              Delete base
            </Button>
          </>
        )}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <LinkIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
        <Typography variant="body2" sx={{ color: 'text.secondary', wordBreak: 'break-all' }}>
          {base?.baseUrl || '—'}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, mb: 1 }}>
        <Typography variant="overline" sx={{ color: 'primary.main' }}>
          Endpoints ({endpoints.length})
        </Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={handleAdd} sx={{ color: 'primary.main' }}>
          Add endpoint
        </Button>
      </Box>
      <Paper sx={{ flex: 1, overflow: 'auto', minHeight: 120, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
        <List dense>
          {endpoints.length === 0 && (
            <ListItem>
              <ListItemText primary="No endpoints" secondary="Add an endpoint for this base" sx={{ color: 'text.secondary' }} />
            </ListItem>
          )}
          {endpoints.map((ep) => (
            <ListItem key={ep.id}>
              <ListItemText
                primary={`${ep.method} ${ep.path}`}
                secondary={ep.summary || ep.title}
                primaryTypographyProps={{ sx: { color: 'text.primary', fontFamily: 'monospace' } }}
                secondaryTypographyProps={{ sx: { color: 'text.secondary' } }}
              />
              <ListItemSecondaryAction>
                <IconButton size="small" onClick={() => handleEdit(ep)} sx={{ color: 'text.secondary' }}>
                  <EditIcon />
                </IconButton>
                <IconButton size="small" onClick={() => handleDelete(ep.id)} sx={{ color: 'text.secondary' }}>
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </Paper>

      <ApiRequestEditor
        variant="endpoint"
        open={editOpen && !!endpointEditorInitial}
        onClose={() => setEditOpen(false)}
        dialogTitle={editingId ? 'Edit endpoint' : 'Add endpoint'}
        initial={endpointEditorInitial}
        onSaveEndpoint={handleSaveFromEditor}
        saving={saving}
      />

      <Dialog open={deleteBaseOpen} onClose={() => !deleteBaseLoading && setDeleteBaseOpen(false)}>
        <DialogTitle sx={{ color: 'text.primary' }}>Delete API base?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.secondary' }}>
            Remove “{base?.title || baseId}” from this workspace? Endpoints linked to this base will no longer appear under it. API steps that reference them may need to be updated.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteBaseOpen(false)} disabled={deleteBaseLoading} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button onClick={handleDeleteBase} color="error" variant="contained" disabled={deleteBaseLoading}>
            {deleteBaseLoading ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
