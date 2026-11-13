import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { LANGS, getLang, setLang } from '../utils/i18n';

const STATUS_TEXT = {
  idle: 'Проверка ещё не запускалась',
  checking: 'Проверяем обновления…',
  available: 'Доступна новая версия',
  downloading: 'Скачиваем обновление…',
  ready: 'Обновление готово к установке',
  none: 'Обновлений нет',
  error: 'Ошибка обновления',
};

/**
 * Настройки: ключ LLM и автообновление.
 *
 * Автообновление по умолчанию выключено. Включается здесь, канал
 * переключается между stable и beta, проверка доступна и вручную.
 */
export default function LlmSettingsDialog({ open, onClose, onOpenBrowserSetup }) {
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [browser, setBrowser] = useState(null);

  const [update, setUpdate] = useState(null);
  const [updateError, setUpdateError] = useState(null);
  const [checking, setChecking] = useState(false);
  const [language, setLanguage] = useState(getLang());
  const api = window.electronAPI;

  useEffect(() => {
    if (!open) return undefined;

    setError(null);
    setUpdateError(null);

    api.llmGetConfig()
      .then((config) => {
        setHasKey(Boolean(config?.effective?.apiKey));
        setModelName(config?.effective?.modelName || '');
        setBaseUrl(config?.effective?.apiBaseUrl || '');
      })
      .catch((err) => setError(err.message || String(err)));

    api.updateGet?.().then(setUpdate).catch(() => setUpdate(null));
    api.browserRuntimeStatus?.().then(setBrowser).catch(() => setBrowser(null));

    const off = api.onUpdateStatus?.((status) => {
      setUpdate((prev) => (prev ? { ...prev, status } : prev));
    });
    // Диалог браузера может закрыться, пока настройки открыты: обновляем статус.
    const offBrowser = api.onBrowserProgress?.((event) => {
      if (event?.phase === 'done') {
        api.browserRuntimeStatus?.().then(setBrowser).catch(() => {});
      }
    });
    return () => {
      if (typeof off === 'function') off();
      if (typeof offBrowser === 'function') offBrowser();
    };
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

  const patchUpdate = async (next) => {
    try {
      const result = await api.updateSet({ ...update.settings, ...next });
      setUpdate(result);
      setUpdateError(null);
    } catch (err) {
      setUpdateError(err.message || String(err));
    }
  };

  const runCheck = async () => {
    setChecking(true);
    setUpdateError(null);
    try {
      const result = await api.updateCheck();
      setUpdate((prev) => (prev ? { ...prev, status: result.status } : prev));
      if (!result.ok) {
        setUpdateError(
          result.reason === 'dev'
            ? 'Проверка работает только в собранном приложении.'
            : result.reason,
        );
      }
    } catch (err) {
      setUpdateError(err.message || String(err));
    } finally {
      setChecking(false);
    }
  };

  const status = update?.status?.state || 'idle';
  const info = update?.info;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Настройки</DialogTitle>
      <DialogContent>
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>Интерфейс</Typography>
        <TextField
          select
          size="small"
          label="Язык"
          value={language}
          onChange={(event) => {
            setLang(event.target.value);
            setLanguage(event.target.value);
          }}
          sx={{ mt: 1, mb: 2, minWidth: 200 }}
        >
          {LANGS.map((item) => (
            <MenuItem key={item.id} value={item.id}>{item.label}</MenuItem>
          ))}
        </TextField>

        <Typography variant="overline" sx={{ color: 'text.secondary' }}>ИИ</Typography>
        <Stack spacing={2} sx={{ mt: 1, mb: 2 }}>
          <TextField
            size="small"
            label="Адрес API"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            helperText="По умолчанию — адрес сборки."
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

        <Divider sx={{ my: 1 }} />

        <Typography variant="overline" sx={{ color: 'text.secondary' }}>Обновления</Typography>
        {!update && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
            Настройки обновлений недоступны.
          </Typography>
        )}
        {update && (
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(update.settings.enabled)}
                  onChange={(event) => patchUpdate({ enabled: event.target.checked })}
                />
              }
              label="Автоматически проверять и скачивать"
            />
            <TextField
              select
              size="small"
              label="Канал"
              value={update.settings.channel}
              onChange={(event) => patchUpdate({ channel: event.target.value })}
              helperText="beta получает предварительные сборки раньше stable"
            >
              <MenuItem value="stable">stable</MenuItem>
              <MenuItem value="beta">beta</MenuItem>
            </TextField>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(update.settings.autoDownload)}
                  onChange={(event) => patchUpdate({ autoDownload: event.target.checked })}
                />
              }
              label="Скачивать сразу после проверки"
            />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Button size="small" variant="outlined" onClick={runCheck} disabled={checking}>
                {checking ? 'Проверяем…' : 'Проверить сейчас'}
              </Button>
              {status === 'ready' && (
                <Button size="small" variant="contained" onClick={() => api.updateInstall()}>
                  Установить и перезапустить
                </Button>
              )}
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {STATUS_TEXT[status] || status}
                {update.status?.version ? ` · ${update.status.version}` : ''}
                {status === 'downloading' && update.status?.percent !== undefined
                  ? ` · ${update.status.percent}%`
                  : ''}
              </Typography>
            </Box>

            {info && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Версия {info.version} · {info.platform} · {info.supported ? 'обновления доступны' : 'сборка для разработки'}
              </Typography>
            )}
            {updateError && <Alert severity="warning">{updateError}</Alert>}
          </Stack>
        )}

        <Divider sx={{ my: 2 }} />

        <Typography variant="overline" sx={{ color: 'text.secondary' }}>Браузер</Typography>
        <Stack spacing={1} sx={{ mt: 1 }}>
          {browser ? (
            <>
              <Typography variant="body2">
                {browser.installed ? 'Скачан' : 'Не скачан'}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', wordBreak: 'break-all' }}
              >
                {browser.installed ? browser.executablePath : `Папка: ${browser.browsersDir || '—'}`}
              </Typography>
            </>
          ) : (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Статус браузера недоступен.
            </Typography>
          )}
          <Box>
            <Button
              size="small"
              variant="outlined"
              onClick={() => onOpenBrowserSetup?.()}
              disabled={!onOpenBrowserSetup}
            >
              {browser?.installed ? 'Проверить' : 'Скачать браузер'}
            </Button>
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Chromium для записи и прогона. Около 280 МБ, скачивается один раз.
          </Typography>
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
