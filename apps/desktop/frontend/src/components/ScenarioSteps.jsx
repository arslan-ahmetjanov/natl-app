import { Alert, Box, Paper, Typography } from '@mui/material';
import { describeScenario } from '../utils/describe';

/** Человеческий вид сценария: фразы вместо YAML. */
export default function ScenarioSteps({ text }) {
  const { name, items, error } = describeScenario(text);

  // Битый YAML не должен скрывать код: показываем и предупреждение, и сам текст,
  // как редактор, который не прячет файл из-за ошибки разбора.
  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          YAML не разбирается: {error}
        </Alert>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
          Ниже — файл как есть. Исправьте ошибку в режиме YAML, фразы появятся снова.
        </Typography>
        <Paper
          component="pre"
          sx={{
            p: 2,
            m: 0,
            fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
            fontSize: 12,
            lineHeight: 1.55,
            whiteSpace: 'pre-wrap',
            overflow: 'auto',
            maxHeight: '60vh',
          }}
        >
          {text}
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, maxWidth: 760 }}>
      <Typography variant="h6" sx={{ mb: 0.5 }}>{name}</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        {items.length} шагов. Так сценарий выглядит для человека, который не пишет код.
      </Typography>

      {items.length === 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Шагов пока нет. Добавьте первый через «Шаг» или запишите действия.
        </Typography>
      )}

      <Box component="ol" sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {items.map((item) => (
          <Box
            component="li"
            key={item.index}
            sx={{
              display: 'flex',
              gap: 1.5,
              alignItems: 'baseline',
              py: 0.75,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography
              variant="caption"
              sx={{ fontFamily: 'monospace', color: 'primary.main', minWidth: 24 }}
            >
              {item.index}
            </Typography>
            <Typography variant="body2">{item.text}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
