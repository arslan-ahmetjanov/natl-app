import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Typography,
  TextField,
  Chip,
  Autocomplete,
  Paper,
  LinearProgress,
} from '@mui/material';
import ScreenHeader from '../components/ScreenHeader';

function formatAiProgress(ev) {
  if (!ev || typeof ev !== 'object') return '';
  const { phase, message, stats, totalChars, model, counts, created } = ev;
  const parts = [];
  if (message) parts.push(message);
  if (phase === 'preparing' && stats) {
    const bits = [];
    if (stats.pages != null) bits.push(`${stats.pages} page(s)`);
    if (stats.elements != null) bits.push(`${stats.elements} element(s)`);
    if (stats.endpoints != null) bits.push(`${stats.endpoints} endpoint(s)`);
    if (stats.actions != null) bits.push(`${stats.actions} action(s)`);
    if (bits.length) parts.push(`Context: ${bits.join(', ')}.`);
  }
  if (phase === 'streaming' && typeof totalChars === 'number') {
    parts.push(`Streamed ${totalChars.toLocaleString()} characters so far.`);
  }
  if (phase === 'llm_request' && model) parts.push(`Model: ${model}.`);
  if (phase === 'saving' && counts) {
    parts.push(`Saving ${counts.uiTests ?? 0} UI + ${counts.apiTests ?? 0} API scenario(s).`);
  }
  if (phase === 'done' && typeof created === 'number') parts.push(`Wrote ${created} test(s).`);
  return parts.filter(Boolean).join(' ');
}

export default function AiGenerateScreen({ pages = [], onBack, onRefresh }) {
  const [generatePageIds, setGeneratePageIds] = useState([]);
  const [generateBaseIds, setGenerateBaseIds] = useState([]);
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [generateApiBases, setGenerateApiBases] = useState([]);
  const [generateBusy, setGenerateBusy] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  const [generateResult, setGenerateResult] = useState(null);
  const [aiProgress, setAiProgress] = useState(null);

  useEffect(() => {
    window.electronAPI?.listApiBases?.().then(setGenerateApiBases).catch(() => setGenerateApiBases([]));
  }, []);

  useEffect(() => {
    const unsub = window.electronAPI?.onAiGenerateProgress?.((e) => setAiProgress(e));
    return () => unsub?.();
  }, []);

  const progressCaption = useMemo(() => formatAiProgress(aiProgress), [aiProgress]);

  const handleGenerateSubmit = async () => {
    if (generatePageIds.length === 0 && generateBaseIds.length === 0) {
      setGenerateError('Select at least one page or API base.');
      return;
    }
    setGenerateBusy(true);
    setGenerateError(null);
    setGenerateResult(null);
    setAiProgress({ phase: 'queued', message: 'Queued…' });
    try {
      const endpointIdArrays = await Promise.all(
        generateBaseIds.map((baseId) => window.electronAPI.listEndpoints(baseId).catch(() => []))
      );
      const endpointIds = endpointIdArrays.flat().map((ep) => ep.id);
      const created = await window.electronAPI.generateFromSelection({
        pageIds: generatePageIds,
        endpointIds,
        customPrompt: generatePrompt.trim() || null,
      });
      setGenerateResult(created);
      onRefresh?.();
    } catch (e) {
      setGenerateError(e.message || 'Generation failed');
    } finally {
      setGenerateBusy(false);
      setAiProgress(null);
    }
  };

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <ScreenHeader title="AI Generate" onBack={onBack} />
      <Paper sx={{ p: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
          Select pages and/or API bases. The AI will generate UI and/or API test scenarios.
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
          Context sent to the model is only saved fixtures from this workspace: web elements (id, title, CSS selector),
          actions, and API endpoint metadata (method, path, summary). Raw HTML, DOM snapshots, and full OpenAPI specs are
          not sent. The provider response uses HTTP streaming (<code style={{ fontSize: '0.85em' }}>stream: true</code>
          ); the progress bar reflects preparation, stream size, parse, and save.
        </Typography>
        <Typography variant="overline" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>Pages</Typography>
        <Autocomplete
          multiple
          options={pages}
          getOptionLabel={(p) => p.title || p.url || p.id}
          value={pages.filter((p) => generatePageIds.includes(p.id))}
          onChange={(_, next) => setGeneratePageIds(next.map((p) => p.id))}
          renderTags={(value, getTagProps) =>
            value.map((p, i) => (
              <Chip key={p.id} label={p.title || p.url || '—'} size="small" {...getTagProps({ index: i })} />
            ))
          }
          renderInput={(params) => <TextField {...params} placeholder="Search pages…" size="small" />}
          sx={{ mb: 2 }}
        />
        <Typography variant="overline" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>API Bases</Typography>
        <Autocomplete
          multiple
          options={generateApiBases}
          getOptionLabel={(b) => b.title || b.baseUrl || b.id}
          value={generateApiBases.filter((b) => generateBaseIds.includes(b.id))}
          onChange={(_, next) => setGenerateBaseIds(next.map((b) => b.id))}
          renderTags={(value, getTagProps) =>
            value.map((b, i) => (
              <Chip key={b.id} label={b.title || b.baseUrl || '—'} size="small" {...getTagProps({ index: i })} />
            ))
          }
          renderInput={(params) => <TextField {...params} placeholder="Search API bases…" size="small" />}
          sx={{ mb: 2 }}
        />
        <TextField
          fullWidth
          label="Additional instructions (optional)"
          value={generatePrompt}
          onChange={(e) => setGeneratePrompt(e.target.value)}
          multiline
          rows={3}
          placeholder="e.g. Focus on login and profile API"
          sx={{ mb: 2 }}
        />
        <Button onClick={handleGenerateSubmit} disabled={generateBusy || (generatePageIds.length === 0 && generateBaseIds.length === 0)} variant="contained">
          {generateBusy ? 'Generating…' : 'Generate'}
        </Button>
        {generateBusy && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress />
            {progressCaption ? (
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                {progressCaption}
              </Typography>
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                Waiting for main process…
              </Typography>
            )}
          </Box>
        )}
        {generateError && <Typography sx={{ color: 'error.main', mt: 2 }}>{generateError}</Typography>}
        {generateResult && generateResult.length > 0 && (
          <Typography sx={{ color: 'success.main', mt: 2 }}>Created {generateResult.length} test(s).</Typography>
        )}
      </Paper>
    </Box>
  );
}
