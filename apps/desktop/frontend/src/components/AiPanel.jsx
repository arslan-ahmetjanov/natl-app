import { useState } from 'react';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { parse, stringify } from 'yaml';

/**
 * "Опиши, что проверить" → предложенные шаги.
 *
 * The model answer is already validated in the main process; here it is only
 * shown and, if accepted, appended to the file. Nothing is written silently.
 */
export default function AiPanel({ text, onAppend, onOpenSettings }) {
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await window.electronAPI.aiGenerateSteps({ description, yaml: text }));
    } catch (err) {
      setError(err && err.message ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const appendSteps = () => {
    if (!result || !result.steps.length) return;
    try {
      const doc = parse(text || '') || {};
      if (!Array.isArray(doc.steps)) doc.steps = [];
      doc.steps.push(...result.steps);
      onAppend(stringify(doc, { lineWidth: 0 }));
      setResult(null);
      setDescription('');
    } catch (err) {
      setError(`Не удалось добавить шаги: ${err.message || err}`);
    }
  };

  return (
    <Stack spacing={1.5} sx={{ p: 1.5 }}>
      <TextField
        size="small"
        multiline
        minRows={3}
        label="Что проверить"
        placeholder="Например: войти с неверным паролем и увидеть сообщение об ошибке"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
      <Button
        variant="contained"
        startIcon={<AutoAwesomeIcon />}
        onClick={generate}
        disabled={busy || description.trim().length < 5}
      >
        {busy ? 'Думаю…' : 'Предложить шаги'}
      </Button>

      {error && (
        <Alert severity="warning">
          {error}
          {onOpenSettings && (
            <Box sx={{ mt: 1 }}>
              <Button size="small" onClick={onOpenSettings}>Настройки ИИ</Button>
            </Box>
          )}
        </Alert>
      )}

      {result && (
        <Box>
          {result.notes && (
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
              {result.notes}
            </Typography>
          )}
          {result.steps.length === 0 ? (
            <Alert severity="info">Модель не предложила шагов. Уточните описание.</Alert>
          ) : (
            <>
              <Box
                component="pre"
                sx={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                  fontSize: 12,
                  p: 1,
                  m: 0,
                  bgcolor: 'background.default',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  maxHeight: 220,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {stringify({ steps: result.steps }, { lineWidth: 0 })}
              </Box>
              {result.rejected && result.rejected.length > 0 && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  Отклонено шагов: {result.rejected.length}. Первая причина: {result.rejected[0].reason}
                </Alert>
              )}
              <Button sx={{ mt: 1 }} variant="outlined" onClick={appendSteps}>
                Добавить шаги в сценарий
              </Button>
            </>
          )}
        </Box>
      )}

      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Модель предлагает шаги, проверку допустимости делает приложение. Ключ хранится в системе.
      </Typography>
    </Stack>
  );
}
