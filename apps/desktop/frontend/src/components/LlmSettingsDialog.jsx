import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

/**
 * Настройки LLM.
 *
 * Ключ вводится здесь, уходит в главный процесс и в интерфейс обратно
 * не возвращается — только признак «ключ есть».
 */
export default function LlmSettingsDialog({ open, onClose }) {
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const api = window.electronAPI;

  useEffect(() => {
    if (!open) return;
    setError(null);
    api.llmGetConfig()
      .then((config) => {
        setHasKey(Boolean(config?.effective?.apiKey));
        setModelName(config?.effective?.modelName || '');
        setBaseUrl(config?.effective?.apiBaseUrl || '');
      })
      .catch((err) => setError(err.message || String(err)));
  }, [open, api]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.llmSaveConfig({ apiKey: apiKey || '***', modelName });
      setApiKey('');
      setHasKey(true);
      onClose();
    } catch (err) {
      setError(err && err.message ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Настройки ИИ</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Любой OpenAI-совместимый сервис: OpenRouter, OpenAI, локальная Ollama.
          </Typography>
          <TextField
            size="small"
            label="Адрес API"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            helperText="По умолчанию — адрес сборки. Меняется только в конфигурации сборки."
          />
          <TextField
            size="small"
            label="Модель"
            placeholder="openai/gpt-4o-mini"
            value={modelName}
            onChange={(event) => setModelName(event.target.value)}
          />
          <TextField
            size="small"
            type="password"
            label="Ключ API"
            placeholder={hasKey ? 'Ключ уже сохранён' : 'sk-…'}
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            helperText="Ключ хранится в системе и не показывается обратно."
          />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Отмена</Button>
        <Button variant="contained" onClick={save} disabled={saving}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
