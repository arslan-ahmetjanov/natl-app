import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import { buildParsePageRequestOptions } from '../utils/parsePageRequestOptions';

/**
 * Parse/import web elements for a page (HTTPS URL) with optional auth.
 */
export default function ParsePageElementsDialog({
  open,
  onClose,
  onSuccess,
  targetPageId,
  onTargetPageIdChange,
  pages = [],
}) {
  const [parseUrl, setParseUrl] = useState('');
  const [parseAuthType, setParseAuthType] = useState('none');
  const [parseAuthToken, setParseAuthToken] = useState('');
  const [parseAuthUsername, setParseAuthUsername] = useState('');
  const [parseAuthPassword, setParseAuthPassword] = useState('');
  const [parseHeaderName, setParseHeaderName] = useState('');
  const [parseHeaderValue, setParseHeaderValue] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState(null);

  const effectiveId = targetPageId || pages[0]?.id || '';
  const summaryPage = pages.find((p) => p.id === effectiveId) || pages[0];

  useEffect(() => {
    if (!open) return;
    setParseError(null);
    setParseUrl((summaryPage?.url || '').trim());
    setParseAuthType('none');
    setParseAuthToken('');
    setParseAuthUsername('');
    setParseAuthPassword('');
    setParseHeaderName('');
    setParseHeaderValue('');
  }, [open, effectiveId, summaryPage?.url]);

  const handleParse = async () => {
    const parseUrlValue = parseUrl.trim();
    if (!effectiveId) {
      setParseError('Select a page.');
      return;
    }
    if (!parseUrlValue) return;
    setParsing(true);
    setParseError(null);
    try {
      const fullPage = await window.electronAPI.getPage(effectiveId);
      if (!fullPage) {
        setParseError('Page not found.');
        return;
      }
      const viewport =
        fullPage.viewportId && fullPage.viewport
          ? { width: fullPage.viewport?.width, height: fullPage.viewport?.height }
          : null;
      const requestOptions = buildParsePageRequestOptions({
        authType: parseAuthType,
        authToken: parseAuthToken,
        authUsername: parseAuthUsername,
        authPassword: parseAuthPassword,
        headerName: parseHeaderName,
        headerValue: parseHeaderValue,
      });
      const elements = await window.electronAPI.parsePage(parseUrlValue, viewport, requestOptions);
      const ids = (fullPage.webElements || []).map((e) => e.id);
      const newElements = elements.map((el) => ({
        id: ids.includes(el.id)
          ? el.id
          : crypto.randomUUID?.() || `el-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        title: el.title,
        selector: el.selector,
        type: el.type || 'element',
      }));
      await window.electronAPI.updatePage(effectiveId, { webElements: newElements });
      onSuccess?.();
      onClose?.();
    } catch (e) {
      setParseError(e.message || 'Parse failed');
    } finally {
      setParsing(false);
    }
  };

  const showPagePicker = pages.length > 1;

  return (
    <Dialog open={open} onClose={() => !parsing && onClose?.()} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: 'background.paper' } }}>
      <DialogTitle sx={{ color: 'text.primary' }}>Parse/import page elements</DialogTitle>
      <DialogContent>
        {showPagePicker && (
          <FormControl fullWidth size="small" sx={{ mt: 1, mb: 2, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}>
            <InputLabel>Target page</InputLabel>
            <Select
              label="Target page"
              value={effectiveId}
              onChange={(e) => onTargetPageIdChange?.(e.target.value)}
            >
              {pages.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.title || p.url || p.id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
          Enter an HTTPS URL. Use Bearer, Basic, or a custom header (e.g. Cookie) for protected pages.
        </Typography>
        <TextField
          fullWidth
          label="URL"
          value={parseUrl}
          onChange={(e) => setParseUrl(e.target.value)}
          placeholder="https://example.com"
          sx={{ mt: 0.5, mb: 2, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
        />
        <FormControl fullWidth size="small" sx={{ mb: 1, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}>
          <InputLabel>Auth type</InputLabel>
          <Select value={parseAuthType} onChange={(e) => setParseAuthType(e.target.value)} label="Auth type">
            <MenuItem value="none">None</MenuItem>
            <MenuItem value="bearer">Bearer token</MenuItem>
            <MenuItem value="basic">Basic auth</MenuItem>
          </Select>
        </FormControl>
        {parseAuthType === 'bearer' && (
          <TextField
            fullWidth
            size="small"
            type="password"
            label="Bearer token"
            value={parseAuthToken}
            onChange={(e) => setParseAuthToken(e.target.value)}
            sx={{ mb: 1, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
          />
        )}
        {parseAuthType === 'basic' && (
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <TextField fullWidth size="small" label="Username" value={parseAuthUsername} onChange={(e) => setParseAuthUsername(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { color: 'text.primary' } }} />
            <TextField fullWidth size="small" type="password" label="Password" value={parseAuthPassword} onChange={(e) => setParseAuthPassword(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { color: 'text.primary' } }} />
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <TextField fullWidth size="small" label="Custom header (optional)" placeholder="X-API-Key" value={parseHeaderName} onChange={(e) => setParseHeaderName(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { color: 'text.primary' } }} />
          <TextField fullWidth size="small" label="Header value" value={parseHeaderValue} onChange={(e) => setParseHeaderValue(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { color: 'text.primary' } }} />
        </Box>
        {parseError && (
          <Typography color="error" variant="body2" sx={{ mt: 2 }}>
            {parseError}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose?.()} disabled={parsing} sx={{ color: 'text.secondary' }}>
          Cancel
        </Button>
        <Button
          onClick={handleParse}
          disabled={parsing || !effectiveId || !parseUrl.trim()}
          variant="contained"
          startIcon={parsing ? <CircularProgress size={16} /> : null}
          sx={{ bgcolor: 'primary.main' }}
        >
          {parsing ? 'Parsing…' : 'Parse'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
