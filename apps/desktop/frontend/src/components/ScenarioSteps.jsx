import { Alert, Box, Typography } from '@mui/material';
import { describeScenario } from '../utils/describe';

/** Человеческий вид сценария: фразы вместо YAML. */
export default function ScenarioSteps({ text }) {
  const { name, items, error } = describeScenario(text);

  if (error) {
    return <Alert severity="warning" sx={{ m: 2 }}>Не удалось прочитать сценарий: {error}</Alert>;
  }

  return (
    <Box sx={{ p: 2, maxWidth: 760 }}>
      <Typography variant="h6" sx={{ mb: 0.5 }}>{name}</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        {items.length} шагов. Так сценарий выглядит для человека, который не пишет код.
      </Typography>

      {items.length === 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Шагов пока нет. Добавьте первый через «Добавить шаг» или запишите действия.
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
