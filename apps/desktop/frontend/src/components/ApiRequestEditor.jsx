import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Typography,
  Alert,
  Snackbar,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
} from '@mui/material';
import KeyValueTable from './KeyValueTable';
import { parseCurl, generateCurl, splitUrl } from '../utils/curl';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const BODY_MODES = [
  { value: 'none', label: 'None' },
  { value: 'raw', label: 'Raw' },
  { value: 'x-www-form-urlencoded', label: 'URL encoded' },
  { value: 'form-data', label: 'Form data' },
];
const AUTH_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'basic', label: 'Basic Auth' },
];

function rowsToObject(rows) {
  if (!Array.isArray(rows)) return {};
  const out = {};
  for (const r of rows) {
    const k = r.key != null ? String(r.key).trim() : '';
    if (k) out[k] = r.value != null ? String(r.value) : '';
  }
  return out;
}

function objectToRows(obj) {
  if (!obj || typeof obj !== 'object') return [{ key: '', value: '' }];
  const arr = Object.entries(obj).map(([key, value]) => ({
    key,
    value: value != null ? String(value) : '',
  }));
  return arr.length ? arr : [{ key: '', value: '' }];
}

function normalizeAuth(a) {
  if (!a || a.type === 'none' || !a.type) {
    return { type: 'none', token: '', username: '', password: '' };
  }
  if (a.type === 'bearer') {
    return { type: 'bearer', token: a.token ?? '', username: '', password: '' };
  }
  if (a.type === 'basic') {
    return {
      type: 'basic',
      token: '',
      username: a.username ?? '',
      password: a.password ?? '',
    };
  }
  return { type: 'none', token: '', username: '', password: '' };
}

function emptyFormField() {
  return { key: '', value: '', fieldType: 'text' };
}

function normalizeFormFields(body) {
  if (!body) return [emptyFormField()];
  if (Array.isArray(body)) {
    const rows = body
      .map((row) => {
        const key = row.key ?? row.name ?? '';
        const ft = row.fieldType === 'file' || row.type === 'file' ? 'file' : 'text';
        return {
          key: key != null ? String(key) : '',
          value: row.value != null ? String(row.value) : '',
          fieldType: ft,
        };
      })
      .filter((r) => r.key !== '' || r.value !== '');
    return rows.length ? rows : [emptyFormField()];
  }
  if (typeof body === 'object') {
    return Object.entries(body).map(([key, value]) => ({
      key,
      value: String(value),
      fieldType: 'text',
    }));
  }
  return [emptyFormField()];
}

/**
 * @param {object} props
 * @param {'endpoint'|'step'} props.variant
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.dialogTitle
 *
 * Endpoint: title, summary, method, path, paramRows, headerRows, auth, bodyMode, rawBody, rawSubtype, formFields
 * Step: method, requestUrl, paramRows, headerRows, auth, bodyMode, rawBody, rawSubtype, formFields,
 *       baselineMethod, baselinePath (for detecting endpoint patch)
 */
export default function ApiRequestEditor({
  variant = 'endpoint',
  open,
  onClose,
  dialogTitle = 'API request',
  /** Full initial snapshot — parent recomputes when opening */
  initial,
  /** (payload) => void — endpoint mode */
  onSaveEndpoint,
  /** ({ stepPatch, endpointPatch }) => void — step mode */
  onSaveStep,
  saving = false,
}) {
  const [tab, setTab] = useState(0);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [method, setMethod] = useState('GET');
  const [path, setPath] = useState('/');
  const [requestUrl, setRequestUrl] = useState('');
  const [paramRows, setParamRows] = useState([{ key: '', value: '' }]);
  const [headerRows, setHeaderRows] = useState([{ key: '', value: '' }]);
  const [auth, setAuth] = useState(() => normalizeAuth(null));
  const [bodyMode, setBodyMode] = useState('none');
  const [rawBody, setRawBody] = useState('');
  const [rawSubtype, setRawSubtype] = useState('json');
  const [formFields, setFormFields] = useState([emptyFormField()]);
  const [baseline, setBaseline] = useState({ method: 'GET', path: '/' });

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [parseError, setParseError] = useState(null);
  const [snack, setSnack] = useState(null);

  useEffect(() => {
    if (!open || !initial) return;
    setTab(0);
    setParseError(null);
    if (variant === 'endpoint') {
      setTitle(initial.title ?? '');
      setSummary(initial.summary ?? '');
      setMethod((initial.method || 'GET').toUpperCase());
      setPath(initial.path || '/');
      setParamRows(initial.paramRows?.length ? initial.paramRows : [{ key: '', value: '' }]);
      setHeaderRows(initial.headerRows?.length ? initial.headerRows : [{ key: '', value: '' }]);
      setAuth(normalizeAuth(initial.auth));
      setBodyMode(initial.bodyMode || 'none');
      setRawBody(initial.rawBody ?? '');
      setRawSubtype(initial.rawSubtype || 'json');
      setFormFields(initial.formFields?.length ? initial.formFields : [emptyFormField()]);
    } else {
      setMethod((initial.method || 'GET').toUpperCase());
      setRequestUrl(initial.requestUrl || '');
      setParamRows(initial.paramRows?.length ? initial.paramRows : [{ key: '', value: '' }]);
      setHeaderRows(initial.headerRows?.length ? initial.headerRows : [{ key: '', value: '' }]);
      setAuth(normalizeAuth(initial.auth));
      setBodyMode(initial.bodyMode || 'none');
      setRawBody(initial.rawBody ?? '');
      setRawSubtype(initial.rawSubtype || 'json');
      setFormFields(initial.formFields?.length ? initial.formFields : [emptyFormField()]);
      setBaseline({
        method: (initial.baselineMethod || 'GET').toUpperCase(),
        path: initial.baselinePath || '/',
      });
    }
  }, [open, initial, variant]);

  const applyParsedCurl = (parsed) => {
    setMethod(parsed.method);
    setParseError(null);
    if (variant === 'endpoint') {
      const { path: pth, query } = splitUrl(parsed.url);
      setPath(pth || '/');
      const qRows = objectToRows(query);
      setParamRows(qRows.length ? qRows : [{ key: '', value: '' }]);
    } else {
      setRequestUrl(parsed.url);
    }
    setHeaderRows(objectToRows(parsed.headers));
    setAuth(normalizeAuth(parsed.auth));
    setBodyMode(parsed.bodyMode);
    setRawBody(parsed.rawBody || '');
    setRawSubtype(parsed.rawSubtype || 'json');
    setFormFields(parsed.formFields?.length ? parsed.formFields : [emptyFormField()]);
  };

  const handleImportApply = async () => {
    try {
      const parsed = await parseCurl(importText);
      applyParsedCurl(parsed);
      setImportOpen(false);
      setImportText('');
    } catch (e) {
      setParseError(e.message || String(e));
    }
  };

  const handleCopyCurl = async () => {
    try {
      const headersObj = rowsToObject(headerRows);
      const queryObj = rowsToObject(paramRows);
      let urlArg;
      if (variant === 'endpoint') {
        const pth = path && path.startsWith('/') ? path : `/${path || ''}`;
        const qs = new URLSearchParams(queryObj).toString();
        urlArg = `https://example.com${pth}${qs ? `?${qs}` : ''}`;
      } else {
        urlArg = requestUrl || '';
      }
      const curl = await generateCurl({
        method,
        url: urlArg,
        headers: headersObj,
        query: variant === 'step' ? queryObj : {},
        bodyMode,
        rawBody,
        formFields,
        auth,
        rawSubtype,
      });
      await navigator.clipboard.writeText(curl);
      setSnack('cURL copied to clipboard');
    } catch (e) {
      setSnack(`Copy failed: ${e.message || e}`);
    }
  };

  const handleSave = () => {
    if (variant === 'endpoint') {
      let body = null;
      if (bodyMode === 'raw') body = rawBody;
      else if (bodyMode === 'x-www-form-urlencoded' || bodyMode === 'form-data') {
        body = formFields.filter((r) => r.key && String(r.key).trim());
      }
      onSaveEndpoint?.({
        title: title.trim(),
        summary: summary.trim(),
        method,
        path: path.trim() || '/',
        parameters: Object.entries(rowsToObject(paramRows)).map(([name, value]) => ({
          name,
          value,
          in: 'query',
        })),
        headers: rowsToObject(headerRows),
        auth: auth.type === 'none' ? null : auth,
        bodyMode,
        body,
      });
      return;
    }

    let endpointPatch = null;
    try {
      const u = new URL(requestUrl);
      const newPath = u.pathname || '/';
      const newMethod = method.toUpperCase();
      if (newMethod !== baseline.method || newPath !== baseline.path) {
        endpointPatch = { method: newMethod, path: newPath };
      }
    } catch {
      /* ignore URL parse for endpoint patch */
    }

    const stepPatch = {
      query: rowsToObject(paramRows),
      headers: rowsToObject(headerRows),
      auth: auth.type === 'none' ? null : auth,
      bodyMode,
    };

    if (bodyMode === 'raw') {
      stepPatch.body = rawBody;
    } else if (bodyMode === 'x-www-form-urlencoded' || bodyMode === 'form-data') {
      stepPatch.body = formFields.filter((r) => r.key && String(r.key).trim());
    } else if (bodyMode === 'none') {
      stepPatch.body = undefined;
    }

    onSaveStep?.({ stepPatch, endpointPatch });
  };

  const urlBar =
    variant === 'endpoint' ? (
      <TextField
        fullWidth
        size="small"
        label="Path"
        value={path}
        onChange={(e) => setPath(e.target.value)}
        placeholder="/api/users"
        sx={{ flex: 1, minWidth: 160, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
      />
    ) : (
      <TextField
        fullWidth
        size="small"
        label="URL"
        value={requestUrl}
        onChange={(e) => setRequestUrl(e.target.value)}
        placeholder="https://api.example.com/v1/users"
        sx={{ flex: 1, minWidth: 200, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
      />
    );

  return (
    <>
      <Dialog open={open} onClose={() => !saving && onClose()} maxWidth="md" fullWidth PaperProps={{ sx: { bgcolor: 'background.paper' } }}>
        <DialogTitle sx={{ color: 'text.primary' }}>{dialogTitle}</DialogTitle>
        <DialogContent>
          {variant === 'endpoint' && (
            <>
              <TextField
                fullWidth
                label="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                sx={{ mb: 2, mt: 1, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
              />
              <TextField
                fullWidth
                label="Summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                multiline
                rows={2}
                sx={{ mb: 2, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
              />
            </>
          )}

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Method</InputLabel>
              <Select value={method} label="Method" onChange={(e) => setMethod(e.target.value)} sx={{ color: 'text.primary' }}>
                {METHODS.map((m) => (
                  <MenuItem key={m} value={m}>
                    {m}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {urlBar}
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            <Button size="small" variant="outlined" onClick={() => setImportOpen(true)} sx={{ color: 'primary.main' }}>
              Import cURL
            </Button>
            <Button size="small" variant="outlined" onClick={handleCopyCurl} sx={{ color: 'primary.main' }}>
              Copy as cURL
            </Button>
          </Box>

          {parseError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setParseError(null)}>
              {parseError}
            </Alert>
          )}

          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tab label="Params" sx={{ color: 'text.primary', textTransform: 'none' }} />
            <Tab label="Headers" sx={{ textTransform: 'none' }} />
            <Tab label="Body" sx={{ textTransform: 'none' }} />
            <Tab label="Auth" sx={{ textTransform: 'none' }} />
          </Tabs>

          {tab === 0 && (
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                Query parameters
              </Typography>
              <KeyValueTable rows={paramRows} onChange={setParamRows} keyPlaceholder="Name" valuePlaceholder="Value" addLabel="Add parameter" />
            </Box>
          )}

          {tab === 1 && (
            <Box>
              <KeyValueTable rows={headerRows} onChange={setHeaderRows} keyPlaceholder="Header" valuePlaceholder="Value" addLabel="Add header" />
            </Box>
          )}

          {tab === 2 && (
            <Box>
              <FormLabel sx={{ color: 'text.secondary' }}>Body type</FormLabel>
              <RadioGroup
                row
                value={bodyMode}
                onChange={(e) => setBodyMode(e.target.value)}
                sx={{ mb: 2 }}
              >
                {BODY_MODES.map((b) => (
                  <FormControlLabel key={b.value} value={b.value} control={<Radio size="small" />} label={b.label} sx={{ color: 'text.primary' }} />
                ))}
              </RadioGroup>

              {bodyMode === 'raw' && (
                <>
                  <FormControl size="small" sx={{ mb: 1, minWidth: 140 }}>
                    <InputLabel>Raw format</InputLabel>
                    <Select value={rawSubtype} label="Raw format" onChange={(e) => setRawSubtype(e.target.value)}>
                      <MenuItem value="json">JSON</MenuItem>
                      <MenuItem value="text">Text</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    fullWidth
                    multiline
                    minRows={12}
                    maxRows={24}
                    value={rawBody}
                    onChange={(e) => setRawBody(e.target.value)}
                    placeholder={rawSubtype === 'json' ? '{"key": "value"}' : 'Raw body'}
                    sx={{ fontFamily: 'monospace', fontSize: '0.875rem', '& .MuiOutlinedInput-root': { color: 'text.primary', alignItems: 'flex-start' } }}
                  />
                </>
              )}

              {(bodyMode === 'x-www-form-urlencoded' || bodyMode === 'form-data') && (
                <Box>
                  {formFields.map((row, i) => (
                    <Box key={i} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                      <TextField
                        size="small"
                        placeholder="Field name"
                        value={row.key}
                        onChange={(e) => {
                          const next = [...formFields];
                          next[i] = { ...next[i], key: e.target.value };
                          setFormFields(next);
                        }}
                        sx={{ flex: 1, minWidth: 100 }}
                      />
                      <TextField
                        size="small"
                        placeholder={row.fieldType === 'file' ? 'File path' : 'Value'}
                        value={row.value}
                        onChange={(e) => {
                          const next = [...formFields];
                          next[i] = { ...next[i], value: e.target.value };
                          setFormFields(next);
                        }}
                        sx={{ flex: 1, minWidth: 100 }}
                      />
                      {bodyMode === 'form-data' && (
                        <FormControl size="small" sx={{ minWidth: 100 }}>
                          <InputLabel>Type</InputLabel>
                          <Select
                            label="Type"
                            value={row.fieldType || 'text'}
                            onChange={(e) => {
                              const next = [...formFields];
                              next[i] = { ...next[i], fieldType: e.target.value };
                              setFormFields(next);
                            }}
                          >
                            <MenuItem value="text">Text</MenuItem>
                            <MenuItem value="file">File</MenuItem>
                          </Select>
                        </FormControl>
                      )}
                      <Button
                        size="small"
                        onClick={() => {
                          const next = formFields.filter((_, j) => j !== i);
                          setFormFields(next.length ? next : [emptyFormField()]);
                        }}
                      >
                        Remove
                      </Button>
                    </Box>
                  ))}
                  <Button size="small" onClick={() => setFormFields([...formFields, emptyFormField()])}>
                    Add field
                  </Button>
                </Box>
              )}
            </Box>
          )}

          {tab === 3 && (
            <Box>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Type</InputLabel>
                <Select
                  value={auth.type || 'none'}
                  label="Type"
                  onChange={(e) => setAuth((a) => ({ ...a, type: e.target.value }))}
                  sx={{ color: 'text.primary' }}
                >
                  {AUTH_TYPES.map((a) => (
                    <MenuItem key={a.value} value={a.value}>
                      {a.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {auth.type === 'bearer' && (
                <TextField
                  fullWidth
                  size="small"
                  label="Token"
                  type="password"
                  placeholder="Use {{var}} for variables"
                  value={auth.token || ''}
                  onChange={(e) => setAuth((a) => ({ ...a, token: e.target.value }))}
                  sx={{ '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
                />
              )}
              {auth.type === 'basic' && (
                <>
                  <TextField
                    fullWidth
                    size="small"
                    label="Username"
                    value={auth.username || ''}
                    onChange={(e) => setAuth((a) => ({ ...a, username: e.target.value }))}
                    sx={{ mb: 1, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label="Password"
                    type="password"
                    value={auth.password || ''}
                    onChange={(e) => setAuth((a) => ({ ...a, password: e.target.value }))}
                    sx={{ '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
                  />
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} variant="contained" color="primary">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={importOpen} onClose={() => setImportOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Paste cURL</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            minRows={8}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='curl -X POST "https://..." ...'
            sx={{ mt: 1, fontFamily: 'monospace', fontSize: '0.8rem' }}
          />
          {parseError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {parseError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleImportApply}>
            Apply
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)} message={snack} />
    </>
  );
}
