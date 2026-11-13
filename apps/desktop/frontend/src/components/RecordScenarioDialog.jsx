import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';

/**
 * Record a path through the app and save it as a NATL scenario.
 *
 * The browser is opened by the main process (Playwright), so the recording uses
 * the same engine that will replay it. This dialog only collects the URL, shows
 * what was recorded and asks for a file name.
 */
export default function RecordScenarioDialog({ open, onClose, onSaved }) {
  const [url, setUrl] = useState('https://');
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState([]);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [name, setName] = useState('Recorded scenario');
  const [saving, setSaving] = useState(false);
  const [savedPath, setSavedPath] = useState(null);

  useEffect(() => {
    if (!open || !window.electronAPI || !window.electronAPI.onNatlRecordProgress) {
      return undefined;
    }
    return window.electronAPI.onNatlRecordProgress((step) => {
      setSteps((prev) => [...prev, step]);
    });
  }, [open]);

  const resetState = () => {
    setRunning(false);
    setSteps([]);
    setError(null);
    setResult(null);
    setSaving(false);
    setSavedPath(null);
  };

  const handleStart = async () => {
    setError(null);
    setResult(null);
    setSavedPath(null);
    setSteps([]);
    setRunning(true);
    try {
      await window.electronAPI.natlRecordStart({ url });
    } catch (err) {
      setRunning(false);
      setError(err && err.message ? err.message : String(err));
    }
  };

  const handleStop = async () => {
    try {
      const recorded = await window.electronAPI.natlRecordStop({ name });
      setResult(recorded);
      setRunning(false);
    } catch (err) {
      setRunning(false);
      setError(err && err.message ? err.message : String(err));
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await window.electronAPI.natlSaveRecorded({ yaml: result.yaml, name });
      setSavedPath(saved.relativePath);
      if (onSaved) onSaved(saved);
    } catch (err) {
      setError(err && err.message ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async () => {
    try {
      if (running) await window.electronAPI.natlRecordCancel();
    } catch {
      /* the window may already be closed by the user */
    }
    resetState();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Record a scenario</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Откроется браузер. Пройди путь как обычный пользователь, вернись сюда и нажми Stop.
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            label="URL"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            size="small"
            fullWidth
            disabled={running || Boolean(result)}
          />
          <Button
            variant="contained"
            onClick={handleStart}
            disabled={running || Boolean(result) || !url}
            sx={{ flexShrink: 0 }}
          >
            Start
          </Button>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {steps.length > 0 && (
          <Box sx={{ maxHeight: 220, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <List dense>
              {steps.map((step, index) => (
                <ListItem key={`${index}-${step.action}`} disableGutters sx={{ px: 1 }}>
                  <ListItemText
                    primary={`${index + 1}. ${step.action}`}
                    secondary={step.target}
                    slotProps={{ secondary: { noWrap: true } }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {result && (
          <Box sx={{ mt: 2 }}>
            <Alert severity={result.warnings && result.warnings.length ? 'warning' : 'success'} sx={{ mb: 2 }}>
              Записано шагов: {result.steps.length}
              {result.warnings && result.warnings.length > 0 && (
                <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
                  {result.warnings.map((warning) => (
                    <li key={warning}>
                      <Typography variant="body2">{warning}</Typography>
                    </li>
                  ))}
                </Box>
              )}
            </Alert>
            <TextField
              label="Имя файла"
              value={name}
              onChange={(event) => setName(event.target.value)}
              size="small"
              fullWidth
            />
            {savedPath && (
              <Alert severity="success" sx={{ mt: 2 }}>
                Сохранено: {savedPath}
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} sx={{ color: 'text.secondary' }}>Close</Button>
        {running && (
          <Button variant="contained" color="warning" onClick={handleStop}>Stop</Button>
        )}
        {result && !savedPath && (
          <Button variant="contained" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : 'Save scenario'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
