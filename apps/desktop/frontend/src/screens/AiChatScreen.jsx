import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';

const SUGGESTIONS = [
  'Проверь сценарии в tests/ и скажи, какие шаги могут быть нестабильными',
  'Добавь в tests/login.yaml проверку, что после входа видно приветствие',
  'Запусти tests/ и объясни, почему упало',
];

/** Чат с агентом: он читает и пишет сценарии и умеет их запускать. */
export default function AiChatScreen({ onOpenSettings }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const api = window.electronAPI;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, busy]);

  const send = async (text) => {
    const question = String(text || '').trim();
    if (!question || busy) return;

    const next = [...messages, { role: 'user', content: question }];
    setMessages(next);
    setInput('');
    setBusy(true);
    setError(null);

    try {
      const result = await api.aiChat({
        messages: next.map((message) => ({ role: message.role, content: message.content })),
      });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: result.reply, calls: result.calls || [] },
      ]);
    } catch (err) {
      setError(err && err.message ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Box sx={{ flex: 1, overflow: 'auto', px: 1.5, py: 1.5 }}>
        {messages.length === 0 && (
          <Stack spacing={1.5}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Опишите задачу обычными словами. Агент посмотрит файлы, предложит правку
              и сможет запустить прогон.
            </Typography>
            {SUGGESTIONS.map((item) => (
              <Button
                key={item}
                variant="outlined"
                size="small"
                onClick={() => send(item)}
                sx={{ justifyContent: 'flex-start', textAlign: 'left', textTransform: 'none' }}
              >
                {item}
              </Button>
            ))}
          </Stack>
        )}

        {messages.map((message, index) => (
          <Box key={`${index}-${message.role}`} sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {message.role === 'user' ? 'Вы' : 'Агент'}
            </Typography>
            <Paper
              sx={{
                p: 1.5,
                mt: 0.5,
                bgcolor: message.role === 'user' ? 'action.hover' : 'background.paper',
                whiteSpace: 'pre-wrap',
                maxWidth: 760,
              }}
            >
              <Typography variant="body2">{message.content}</Typography>
            </Paper>
            {message.calls && message.calls.length > 0 && (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                {message.calls.map((call, callIndex) => (
                  <Chip
                    key={`${callIndex}-${call.name}`}
                    size="small"
                    label={`${call.name}${call.ok ? '' : ' · ошибка'}`}
                    color={call.ok ? 'default' : 'warning'}
                    variant="outlined"
                  />
                ))}
              </Box>
            )}
          </Box>
        ))}

        {busy && <Typography variant="body2" sx={{ color: 'text.secondary' }}>Агент думает…</Typography>}
        {error && (
          <Alert severity="warning" sx={{ maxWidth: 620 }}>
            {error}
            <Box sx={{ mt: 1 }}>
              <Button size="small" onClick={onOpenSettings}>Настройки ИИ</Button>
            </Box>
          </Alert>
        )}
        <div ref={bottomRef} />
      </Box>

      <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Что сделать с тестами?"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                send(input);
              }
            }}
            disabled={busy}
          />
          <Button
            variant="contained"
            endIcon={<SendIcon />}
            onClick={() => send(input)}
            disabled={busy || !input.trim()}
          >
            Отправить
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
