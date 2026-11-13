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
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import { buildSwaggerImportRequestOptions } from '../utils/swaggerImportRequestOptions';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const AUTH_TYPES = [{ value: 'none', label: 'None' }, { value: 'bearer', label: 'Bearer Token' }, { value: 'basic', label: 'Basic Auth' }];

function keyValueToObject(arr) {
  if (!Array.isArray(arr)) return {};
  return arr.reduce((acc, { key, value }) => {
    if (key != null && String(key).trim() !== '') acc[String(key).trim()] = value != null ? String(value) : '';
    return acc;
  }, {});
}
function objectToKeyValue(obj) {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj).map(([key, value]) => ({ key, value: value != null ? String(value) : '' }));
}
function parametersToForm(parameters) {
  if (!Array.isArray(parameters) || parameters.length === 0) return [{ name: '', value: '' }];
  return parameters.map((p) => ({ name: p.name ?? '', value: p.value != null ? String(p.value) : '' }));
}
function formToParameters(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(({ name }) => name != null && String(name).trim() !== '').map(({ name, value }) => ({ name: String(name).trim(), value: value != null ? String(value) : '', in: 'query' }));
}

export default function EndpointsScreen({ onBack, onRefresh }) {
  const [endpoints, setEndpoints] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: '', method: 'GET', path: '/', summary: '', baseUrl: '',
    parameters: [{ name: '', value: '' }],
    headers: [{ key: '', value: '' }],
    auth: { type: 'none', token: '', username: '', password: '' },
  });
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importSourceType, setImportSourceType] = useState('url');
  const [importUrl, setImportUrl] = useState('');
  const [importFilePath, setImportFilePath] = useState('');
  const [importAuthType, setImportAuthType] = useState('none');
  const [importAuthToken, setImportAuthToken] = useState('');
  const [importAuthUsername, setImportAuthUsername] = useState('');
  const [importAuthPassword, setImportAuthPassword] = useState('');
  const [importHeaderName, setImportHeaderName] = useState('');
  const [importHeaderValue, setImportHeaderValue] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);

  const load = () => {
    if (!window.electronAPI) return;
    window.electronAPI.listEndpoints().then(setEndpoints).catch(() => setEndpoints([]));
  };

  useEffect(() => load(), []);

  const handleAdd = () => {
    setEditingId(null);
    setForm({
      title: 'New Endpoint', method: 'GET', path: '/', summary: '', baseUrl: '',
      parameters: [{ name: '', value: '' }],
      headers: [{ key: '', value: '' }],
      auth: { type: 'none', token: '', username: '', password: '' },
    });
    setEditOpen(true);
  };

  const handleEdit = (ep) => {
    setEditingId(ep.id);
    setForm({
      title: ep.title || '',
      method: ep.method || 'GET',
      path: ep.path || '/',
      summary: ep.summary || '',
      baseUrl: ep.baseUrl || '',
      parameters: parametersToForm(ep.parameters).length ? parametersToForm(ep.parameters) : [{ name: '', value: '' }],
      headers: objectToKeyValue(ep.headers).length ? objectToKeyValue(ep.headers) : [{ key: '', value: '' }],
      auth: ep.auth && (ep.auth.type === 'bearer' || ep.auth.type === 'basic')
        ? { type: ep.auth.type, token: ep.auth.token ?? '', username: ep.auth.username ?? '', password: ep.auth.password ?? '' }
        : { type: 'none', token: '', username: '', password: '' },
    });
    setEditOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        method: form.method,
        path: form.path,
        summary: form.summary,
        baseUrl: form.baseUrl,
        parameters: formToParameters(form.parameters),
        headers: keyValueToObject(form.headers),
        auth: form.auth.type === 'none' ? null : (form.auth.type === 'bearer'
          ? { type: 'bearer', token: form.auth.token }
          : { type: 'basic', username: form.auth.username, password: form.auth.password }),
      };
      if (editingId) {
        await window.electronAPI.updateEndpoint(editingId, payload);
      } else {
        await window.electronAPI.createEndpoint(payload);
      }
      setEditOpen(false);
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
      await window.electronAPI.deleteEndpoint(id);
      load();
      onRefresh?.();
    } catch (e) {
      console.error(e);
    }
  };

  const handleImport = async () => {
    const url = importUrl.trim();
    const filePath = importFilePath.trim();
    if (importSourceType === 'url' && !url) return;
    if (importSourceType === 'file' && !filePath) return;
    setImporting(true);
    setImportError(null);
    try {
      const requestOptions = buildSwaggerImportRequestOptions({
        authType: importAuthType,
        authToken: importAuthToken,
        authUsername: importAuthUsername,
        authPassword: importAuthPassword,
        headerName: importHeaderName,
        headerValue: importHeaderValue,
      });
      const source = importSourceType === 'file' ? { mode: 'file', filePath } : url;
      await window.electronAPI.importSwagger(source, requestOptions);
      setImportOpen(false);
      setImportUrl('');
      setImportFilePath('');
      setImportAuthType('none');
      setImportAuthToken('');
      setImportAuthUsername('');
      setImportAuthPassword('');
      setImportHeaderName('');
      setImportHeaderValue('');
      load();
      onRefresh?.();
    } catch (e) {
      setImportError(e.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ color: 'primary.main' }}>Back</Button>
        <Typography variant="h6" sx={{ color: 'text.primary', flex: 1 }}>API Endpoints</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={handleAdd} sx={{ color: 'primary.main' }}>Add</Button>
        <Button
          size="small"
          startIcon={<CloudDownloadIcon />}
          onClick={() => {
            setImportOpen(true);
            setImportError(null);
            setImportSourceType('url');
            setImportUrl('');
            setImportFilePath('');
            setImportAuthType('none');
            setImportAuthToken('');
            setImportAuthUsername('');
            setImportAuthPassword('');
            setImportHeaderName('');
            setImportHeaderValue('');
          }}
          sx={{ color: 'primary.main' }}
        >
          Import from Swagger
        </Button>
      </Box>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Endpoints can be used in API tests and in AI-generated scenarios. Import from a Swagger/OpenAPI URL to add many at once.
      </Typography>
      <Paper sx={{ flex: 1, overflow: 'auto', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
        <List dense>
          {endpoints.length === 0 && (
            <ListItem><ListItemText primary="No endpoints" secondary="Add manually or import from Swagger URL" sx={{ color: 'text.secondary' }} /></ListItem>
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
                <IconButton size="small" onClick={() => handleEdit(ep)} sx={{ color: 'text.secondary' }}><EditIcon /></IconButton>
                <IconButton size="small" onClick={() => handleDelete(ep.id)} sx={{ color: 'text.secondary' }}><DeleteIcon /></IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </Paper>

      <Dialog open={editOpen} onClose={() => !saving && setEditOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: 'background.paper' } }}>
        <DialogTitle sx={{ color: 'text.primary' }}>{editingId ? 'Edit endpoint' : 'Add endpoint'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            sx={{ mb: 2, mt: 1, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
          />
          <FormControl fullWidth sx={{ mb: 2, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}>
            <InputLabel>Method</InputLabel>
            <Select value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))} label="Method">
              {METHODS.map((m) => (
                <MenuItem key={m} value={m}>{m}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Path"
            value={form.path}
            onChange={(e) => setForm((f) => ({ ...f, path: e.target.value }))}
            placeholder="/api/users"
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
          />
          <TextField
            fullWidth
            label="Base URL"
            value={form.baseUrl}
            onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
            placeholder="https://api.example.com"
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
          />
          <TextField
            fullWidth
            label="Summary"
            value={form.summary}
            onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
            multiline
            rows={2}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
          />
          <Accordion disableGutters sx={{ bgcolor: 'transparent', boxShadow: 'none', '&:before': { display: 'none' }, border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'text.secondary' }} />} sx={{ '& .MuiAccordionSummary-content': { color: 'text.primary' } }}>
              <Typography variant="subtitle2" sx={{ color: 'text.primary' }}>Query parameters</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {(form.parameters || [{ name: '', value: '' }]).map((row, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                  <TextField size="small" placeholder="Name" value={row.name} onChange={(e) => setForm((f) => ({ ...f, parameters: f.parameters.map((r, j) => j === i ? { ...r, name: e.target.value } : r) }))} sx={{ flex: 1, minWidth: 0, '& .MuiOutlinedInput-root': { color: 'text.primary' } }} />
                  <TextField size="small" placeholder="Value" value={row.value} onChange={(e) => setForm((f) => ({ ...f, parameters: f.parameters.map((r, j) => j === i ? { ...r, value: e.target.value } : r) }))} sx={{ flex: 1, minWidth: 0, '& .MuiOutlinedInput-root': { color: 'text.primary' } }} />
                  <IconButton size="small" onClick={() => setForm((f) => ({ ...f, parameters: f.parameters.filter((_, j) => j !== i).length ? f.parameters.filter((_, j) => j !== i) : [{ name: '', value: '' }] }))} sx={{ color: 'text.secondary' }}><DeleteIcon fontSize="small" /></IconButton>
                </Box>
              ))}
              <Button size="small" startIcon={<AddIcon />} onClick={() => setForm((f) => ({ ...f, parameters: [...(f.parameters || []), { name: '', value: '' }] }))} sx={{ color: 'primary.main', mt: 0.5 }}>Add parameter</Button>
            </AccordionDetails>
          </Accordion>
          <Accordion disableGutters sx={{ bgcolor: 'transparent', boxShadow: 'none', '&:before': { display: 'none' }, border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'text.secondary' }} />} sx={{ '& .MuiAccordionSummary-content': { color: 'text.primary' } }}>
              <Typography variant="subtitle2" sx={{ color: 'text.primary' }}>Headers</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {(form.headers || [{ key: '', value: '' }]).map((row, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                  <TextField size="small" placeholder="Header name" value={row.key} onChange={(e) => setForm((f) => ({ ...f, headers: f.headers.map((r, j) => j === i ? { ...r, key: e.target.value } : r) }))} sx={{ flex: 1, minWidth: 0, '& .MuiOutlinedInput-root': { color: 'text.primary' } }} />
                  <TextField size="small" placeholder="Value" value={row.value} onChange={(e) => setForm((f) => ({ ...f, headers: f.headers.map((r, j) => j === i ? { ...r, value: e.target.value } : r) }))} sx={{ flex: 1, minWidth: 0, '& .MuiOutlinedInput-root': { color: 'text.primary' } }} />
                  <IconButton size="small" onClick={() => setForm((f) => ({ ...f, headers: f.headers.filter((_, j) => j !== i).length ? f.headers.filter((_, j) => j !== i) : [{ key: '', value: '' }] }))} sx={{ color: 'text.secondary' }}><DeleteIcon fontSize="small" /></IconButton>
                </Box>
              ))}
              <Button size="small" startIcon={<AddIcon />} onClick={() => setForm((f) => ({ ...f, headers: [...(f.headers || []), { key: '', value: '' }] }))} sx={{ color: 'primary.main', mt: 0.5 }}>Add header</Button>
            </AccordionDetails>
          </Accordion>
          <Accordion disableGutters sx={{ bgcolor: 'transparent', boxShadow: 'none', '&:before': { display: 'none' }, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'text.secondary' }} />} sx={{ '& .MuiAccordionSummary-content': { color: 'text.primary' } }}>
              <Typography variant="subtitle2" sx={{ color: 'text.primary' }}>Authorization</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <FormControl fullWidth size="small" sx={{ mb: 2, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}>
                <InputLabel>Type</InputLabel>
                <Select value={form.auth?.type || 'none'} onChange={(e) => setForm((f) => ({ ...f, auth: { ...f.auth, type: e.target.value } }))} label="Type">
                  {AUTH_TYPES.map((a) => (<MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>))}
                </Select>
              </FormControl>
              {form.auth?.type === 'bearer' && (
                <TextField fullWidth size="small" label="Token" type="password" placeholder="Use {{var}} for variables" value={form.auth.token || ''} onChange={(e) => setForm((f) => ({ ...f, auth: { ...f.auth, token: e.target.value } }))} sx={{ '& .MuiOutlinedInput-root': { color: 'text.primary' } }} />
              )}
              {form.auth?.type === 'basic' && (
                <>
                  <TextField fullWidth size="small" label="Username" value={form.auth.username || ''} onChange={(e) => setForm((f) => ({ ...f, auth: { ...f.auth, username: e.target.value } }))} sx={{ mb: 1, '& .MuiOutlinedInput-root': { color: 'text.primary' } }} />
                  <TextField fullWidth size="small" label="Password" type="password" value={form.auth.password || ''} onChange={(e) => setForm((f) => ({ ...f, auth: { ...f.auth, password: e.target.value } }))} sx={{ '& .MuiOutlinedInput-root': { color: 'text.primary' } }} />
                </>
              )}
            </AccordionDetails>
          </Accordion>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} disabled={saving} sx={{ color: 'text.secondary' }}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} variant="contained" color="primary">Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={importOpen} onClose={() => !importing && setImportOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: 'background.paper' } }}>
        <DialogTitle sx={{ color: 'text.primary' }}>Import from Swagger / OpenAPI</DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" sx={{ mt: 1, mb: 2, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}>
            <InputLabel>Source</InputLabel>
            <Select value={importSourceType} onChange={(e) => setImportSourceType(e.target.value)} label="Source">
              <MenuItem value="url">URL</MenuItem>
              <MenuItem value="file">JSON file</MenuItem>
            </Select>
          </FormControl>
          {importSourceType === 'url' ? (
            <TextField
              fullWidth
              label="Spec URL"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="https://api.example.com/swagger.json"
              sx={{ '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
            />
          ) : (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                fullWidth
                label="JSON file"
                value={importFilePath}
                placeholder="Select swagger/openapi JSON file"
                InputProps={{ readOnly: true }}
                sx={{ '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
              />
              <Button size="small" variant="outlined" onClick={async () => {
                const p = await window.electronAPI.openSwaggerJson?.();
                if (p) setImportFilePath(p);
              }}>
                Browse
              </Button>
            </Box>
          )}
          <FormControl fullWidth size="small" sx={{ mt: 2, mb: 1, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}>
            <InputLabel>Auth type</InputLabel>
            <Select value={importAuthType} onChange={(e) => setImportAuthType(e.target.value)} label="Auth type">
              {AUTH_TYPES.map((a) => (<MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>))}
            </Select>
          </FormControl>
          {importAuthType === 'bearer' && (
            <TextField
              fullWidth
              size="small"
              type="password"
              label="Bearer token"
              value={importAuthToken}
              onChange={(e) => setImportAuthToken(e.target.value)}
              sx={{ mb: 1, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
            />
          )}
          {importAuthType === 'basic' && (
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TextField fullWidth size="small" label="Username" value={importAuthUsername} onChange={(e) => setImportAuthUsername(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { color: 'text.primary' } }} />
              <TextField fullWidth size="small" type="password" label="Password" value={importAuthPassword} onChange={(e) => setImportAuthPassword(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { color: 'text.primary' } }} />
            </Box>
          )}
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <TextField fullWidth size="small" label="Custom header (optional)" placeholder="X-API-Key" value={importHeaderName} onChange={(e) => setImportHeaderName(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { color: 'text.primary' } }} />
            <TextField fullWidth size="small" label="Header value" value={importHeaderValue} onChange={(e) => setImportHeaderValue(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { color: 'text.primary' } }} />
          </Box>
          {importError && <Typography sx={{ color: 'error.main', mt: 2 }}>{importError}</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportOpen(false)} disabled={importing} sx={{ color: 'text.secondary' }}>Cancel</Button>
          <Button
            onClick={handleImport}
            disabled={(importSourceType === 'url' ? !importUrl.trim() : !importFilePath.trim()) || importing}
            variant="contained"
            color="primary"
          >
            Import
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
