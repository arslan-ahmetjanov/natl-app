import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';

const DOWNLOAD_SIZE_TEXT = 'около 280 МБ, один раз';

function progressText(progress) {
  if (!progress) return 'Готовим загрузку…';
  if (progress.phase === 'unpack') return `Распаковка: ${progress.label || 'Chromium'}`;
  const total = progress.totalMiB;
  if (total == null) return `${progress.percent || 0}%`;
  return `${progress.percent || 0}% · ${progress.downloadedMiB ?? 0} из ${total} МБ`;
}

const DEFAULT_ERROR = {
  message: 'Не удалось скачать браузер.',
  hint: 'Нажмите «Повторить». Если не помогает — проверьте интернет и прокси.',
};

/**
 * Первый запуск и настройки: Chromium для записи и прогона.
 *
 * Браузер лежит в папке данных приложения, поэтому установщик не нужен.
 * При открытии без браузера загрузка стартует сразу; обрыв можно повторить,
 * а отмена закрывает диалог, не мешая остальному интерфейсу.
 */
export default function BrowserSetupDialog({ open, onClose, onReady }) {
  const [state, setState] = useState('checking');
  const [progress, setProgress] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const api = window.electronAPI;

  // Колбэки из App пересоздаются на каждом рендере: держим их в ref,
  // чтобы эффект не перезапускал загрузку.
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const runInstall = useCallback(async () => {
    if (!api?.browserRuntimeInstall) {
      setState('error');
      setError({
        message: 'Загрузка браузера недоступна.',
        hint: 'Обновите приложение: в этой сборке нет установщика браузера.',
      });
      return;
    }
    setState('downloading');
    setError(null);
    setProgress(null);
    try {
      const result = await api.browserRuntimeInstall();
      if (result) setStatus(result);
      if (result?.installed) {
        setState('done');
        if (onReadyRef.current) onReadyRef.current(result.executablePath);
        return;
      }
      if (result?.cancelled) return;
      setState('error');
      setError(result?.error || DEFAULT_ERROR);
    } catch (err) {
      setState('error');
      setError({
        message: (err && err.message) || DEFAULT_ERROR.message,
        hint: DEFAULT_ERROR.hint,
      });
    }
  }, [api]);

  useEffect(() => {
    if (!open) return undefined;

    let disposed = false;
    setState('checking');
    setProgress(null);
    setError(null);

    const off = api?.onBrowserProgress?.((event) => {
      if (!disposed && event) setProgress(event);
    });

    (async () => {
      try {
        const current = await api.browserRuntimeStatus();
        if (disposed) return;
        setStatus(current);
        if (current?.installed) {
          setState('done');
          if (onReadyRef.current) onReadyRef.current(current.executablePath);
          return;
        }
        await runInstall();
      } catch (err) {
        if (disposed) return;
        setState('error');
        setError({
          message: (err && err.message) || DEFAULT_ERROR.message,
          hint: DEFAULT_ERROR.hint,
        });
      }
    })();

    return () => {
      disposed = true;
      if (typeof off === 'function') off();
    };
  }, [open, api, runInstall]);

  const cancel = async () => {
    try {
      await api?.browserRuntimeCancel?.();
    } catch {
      /* отмена не критична: диалог всё равно закрывается */
    }
    if (onCloseRef.current) onCloseRef.current();
  };

  const close = () => {
    if (state === 'downloading') {
      cancel();
      return;
    }
    if (onCloseRef.current) onCloseRef.current();
  };

  const openFolder = () => {
    api?.browserRuntimeOpenFolder?.().catch(() => {});
  };

  const percent = progress?.percent ?? 0;

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle>Браузер для записи</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {state === 'checking' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <CircularProgress size={20} />
              <Typography variant="body2">Проверяем браузер…</Typography>
            </Box>
          )}

          {state === 'downloading' && (
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Скачивание: {progress?.label || 'Chromium'}
              </Typography>
              <LinearProgress variant="determinate" value={percent} />
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                {progressText(progress)}
                {progress?.attempt > 1 ? ` · попытка ${progress.attempt}` : ''}
              </Typography>
            </Box>
          )}

          {state === 'error' && error && (
            <Alert severity="error">
              <Typography variant="body2">{error.message}</Typography>
              {error.hint && (
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                  {error.hint}
                </Typography>
              )}
            </Alert>
          )}

          {state === 'done' && (
            <Alert severity="success">
              Браузер готов.
              {status?.executablePath && (
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                  {status.executablePath}
                </Typography>
              )}
            </Alert>
          )}

          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              Папка: {status?.browsersDir || 'папка данных приложения'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              {DOWNLOAD_SIZE_TEXT}
            </Typography>
            <Button size="small" onClick={openFolder} sx={{ mt: 1, px: 0 }}>
              Открыть папку
            </Button>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        {state === 'error' && (
          <Button variant="contained" onClick={runInstall}>Повторить</Button>
        )}
        {state === 'done' ? (
          <Button variant="contained" onClick={close}>Продолжить</Button>
        ) : (
          <Button onClick={close} sx={{ color: 'text.secondary' }}>Отмена</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
