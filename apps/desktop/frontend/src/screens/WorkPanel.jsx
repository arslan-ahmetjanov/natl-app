import { Alert, Box, Divider, Paper, Tab, Tabs, Typography } from '@mui/material';
import StepBuilder from '../components/StepBuilder';

/** Right column: build a step or read the last run. */
export default function WorkPanel({ tab, onTabChange, text, onAppend, run }) {
  return (
    <Paper
      sx={{
        width: 320,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Tabs value={tab} onChange={(_, next) => onTabChange(next)} variant="fullWidth" sx={{ minHeight: 38 }}>
        <Tab value="build" label="Шаг" sx={{ minHeight: 38, textTransform: 'none' }} />
        <Tab value="run" label="Прогон" sx={{ minHeight: 38, textTransform: 'none' }} />
      </Tabs>
      <Divider />

      {tab === 'build' && (
        <Box sx={{ overflow: 'auto', flex: 1 }}>
          <StepBuilder text={text} onAppend={onAppend} />
        </Box>
      )}

      {tab === 'run' && (
        <Box sx={{ overflow: 'auto', flex: 1, p: 1.5 }}>
          {!run && (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Прогонов ещё не было. Нажмите Run над редактором.
            </Typography>
          )}
          {run && run.running && <Typography variant="body2">Выполняется…</Typography>}
          {run && run.result && (
            <Alert severity={run.result.ok ? 'success' : 'error'} sx={{ mb: 1.5 }}>
              {run.result.ok ? 'Passed' : 'Failed'} in {Math.round(run.result.durationMs || 0)} ms
              {run.result.error ? ` — ${run.result.error}` : ''}
            </Alert>
          )}
          {run && run.result && (
            <Box component="ol" sx={{ pl: 2, my: 1 }}>
              {(run.result.steps || []).map((step, index) => (
                <li key={`${index}-${step.name}`}>
                  <Typography variant="body2" sx={{ color: step.ok ? 'success.main' : 'error.main' }}>
                    {step.ok ? '✓' : '✗'} {step.name}{step.error ? ` — ${step.error}` : ''}
                  </Typography>
                </li>
              ))}
            </Box>
          )}
          {run && run.images && run.images.length > 0 && (
            <Box sx={{ display: 'grid', gap: 1 }}>
              {run.images.map((image) => (
                <Box key={image.key}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {image.step} · {image.action} · {image.phase}
                  </Typography>
                  <Box
                    component="img"
                    src={image.src}
                    alt={`Шаг ${image.step}, ${image.phase}`}
                    sx={{ width: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
                  />
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}
    </Paper>
  );
}
