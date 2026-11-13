import { useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Typography,
  Paper,
  TextField,
  IconButton,
  Collapse,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  getStepApiAction,
  getStepSummaryLine,
  isStepApi,
} from '../utils/testSteps';

export default function TestStepEditorCards({
  variant = 'test',
  steps,
  sharedCatalog = [],
  pages = [],
  elementsWithPage,
  defaultPageId,
  testPageId,
  endpoints,
  apiBases,
  actions,
  onStepChange,
  onApiStepChange,
  onRemoveStep,
  onMoveStep,
}) {
  const [apiExpanded, setApiExpanded] = useState(() => ({}));
  const [uiExpanded, setUiExpanded] = useState(() => ({}));

  const toggleApiDetails = (index) => {
    setApiExpanded((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const toggleUiDetails = (index) => {
    setUiExpanded((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const summaryCtx = {
    sharedCatalog,
    elementsWithPage,
    actions,
    endpoints,
    pages,
    defaultPageId: defaultPageId || testPageId,
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {steps.map((step, index) => {
        if (step.sharedStepId) {
          const shared = sharedCatalog.find((s) => s.id === step.sharedStepId);
          return (
            <Paper
              key={`step-${index}`}
              variant="outlined"
              sx={{
                p: 1.5,
                borderColor: 'divider',
                borderLeftWidth: 4,
                borderLeftColor: 'primary.main',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  Step {index + 1}
                </Typography>
                <Chip size="small" label="Shared" color="primary" />
                <Typography variant="body2" sx={{ color: 'text.primary', flex: 1, minWidth: 120 }}>
                  {shared?.title || step.sharedStepId}
                </Typography>
                <IconButton size="small" onClick={() => onMoveStep(index, -1)} sx={{ color: 'text.secondary' }}>
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => onMoveStep(index, 1)} sx={{ color: 'text.secondary' }}>
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => onRemoveStep(index)} sx={{ color: 'text.secondary' }}>
                  <DeleteIcon />
                </IconButton>
              </Box>
            </Paper>
          );
        }

        if (isStepApi(step)) {
          const apiAction = getStepApiAction(step);
          const endpointId = step.endpointId ?? step.targetId ?? '';
          const stepBaseId = step.baseId ?? '';
          const expanded = apiExpanded[index] ?? false;
          const summary = getStepSummaryLine(step, summaryCtx);
          const selectedApiBase = apiBases.find((b) => b.id === stepBaseId) || null;
          const selectedEndpoint = endpoints.find((ep) => ep.id === endpointId) || null;
          const apiActionOptions = [
            { id: 'request', name: 'Request' },
            { id: 'assertStatus', name: 'Assert status' },
            { id: 'assertBody', name: 'Assert body' },
          ];
          const selectedApiAction = apiActionOptions.find((opt) => opt.id === apiAction) || apiActionOptions[0];

          return (
            <Paper
              key={`step-${index}`}
              variant="outlined"
              sx={{
                p: 1.5,
                borderColor: 'divider',
                borderLeftWidth: 4,
                borderLeftColor: 'primary.main',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap' }}>
                <Box sx={{ flex: 1, minWidth: 200 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: expanded ? 1 : 0 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                      Step {index + 1}
                    </Typography>
                    <Chip size="small" label="API" color="primary" />
                    <Typography variant="body2" sx={{ color: 'text.primary', flex: 1, minWidth: 160 }}>
                      {summary}
                    </Typography>
                    <Button
                      size="small"
                      endIcon={<ExpandMoreIcon sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />}
                      onClick={() => toggleApiDetails(index)}
                      sx={{ color: 'primary.main', textTransform: 'none' }}
                    >
                      {expanded ? 'Hide details' : 'Edit step'}
                    </Button>
                    <IconButton size="small" onClick={() => onMoveStep(index, -1)} sx={{ color: 'text.secondary' }}>
                      <ArrowUpwardIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => onMoveStep(index, 1)} sx={{ color: 'text.secondary' }}>
                      <ArrowDownwardIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => onRemoveStep(index)} sx={{ color: 'text.secondary' }}>
                      <DeleteIcon />
                    </IconButton>
                  </Box>

                  <Collapse in={expanded} timeout="auto" unmountOnExit={false}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'flex-start' }}>
                        <Autocomplete
                          size="small"
                          options={apiBases}
                          value={selectedApiBase}
                          onChange={(_, option) => onApiStepChange(index, 'baseId', option?.id || null)}
                          getOptionLabel={(option) => option?.title || option?.baseUrl || option?.id || ''}
                          isOptionEqualToValue={(option, value) => option.id === value.id}
                          filterOptions={(options, state) => {
                            const query = state.inputValue.trim().toLowerCase();
                            if (!query) return options;
                            return options.filter((option) => {
                              const title = (option.title || '').toLowerCase();
                              const baseUrl = (option.baseUrl || '').toLowerCase();
                              return title.includes(query) || baseUrl.includes(query);
                            });
                          }}
                          noOptionsText="No API bases"
                          sx={{ minWidth: variant === 'shared' ? 180 : 200 }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="API Base"
                              placeholder="Search API base..."
                              sx={{ '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
                            />
                          )}
                        />
                        <Autocomplete
                          size="small"
                          options={endpoints}
                          value={selectedEndpoint}
                          onChange={(_, option) => onApiStepChange(index, 'endpointId', option?.id || '')}
                          getOptionLabel={(option) => (option ? `${option.method} ${option.path}` : '')}
                          isOptionEqualToValue={(option, value) => option.id === value.id}
                          filterOptions={(options, state) => {
                            const query = state.inputValue.trim().toLowerCase();
                            if (!query) return options;
                            return options.filter((option) => {
                              const methodPath = `${option.method || ''} ${option.path || ''}`.toLowerCase();
                              const summary = (option.summary || '').toLowerCase();
                              return methodPath.includes(query) || summary.includes(query);
                            });
                          }}
                          noOptionsText="No endpoints"
                          sx={{ minWidth: variant === 'shared' ? 200 : 220 }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label={variant === 'shared' ? 'Endpoint' : 'Target (Endpoint)'}
                              placeholder="Search endpoint..."
                              sx={{ '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
                            />
                          )}
                        />
                        <Autocomplete
                          size="small"
                          options={apiActionOptions}
                          value={selectedApiAction}
                          onChange={(_, option) => onApiStepChange(index, 'actionId', option?.id || 'request')}
                          getOptionLabel={(option) => option?.name || ''}
                          isOptionEqualToValue={(option, value) => option.id === value.id}
                          noOptionsText="No actions"
                          sx={{ minWidth: 180 }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Action"
                              placeholder="Search action..."
                              sx={{ '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
                            />
                          )}
                        />
                      </Box>
                      {apiAction !== 'request' && (
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          Target: previous response
                        </Typography>
                      )}
                      {apiAction === 'assertStatus' && (
                        <TextField
                          size="small"
                          label="Value (expected status)"
                          value={step.value ?? '200'}
                          onChange={(e) => onApiStepChange(index, 'value', e.target.value)}
                          sx={{ minWidth: 120, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
                        />
                      )}
                      {apiAction === 'assertBody' && (
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <TextField
                            size="small"
                            label="JSON path"
                            placeholder="data.id"
                            value={step.jsonPath ?? ''}
                            onChange={(e) => onApiStepChange(index, 'jsonPath', e.target.value)}
                            sx={{ minWidth: 120, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
                          />
                          <TextField
                            size="small"
                            label="Expected value"
                            value={step.value ?? ''}
                            onChange={(e) => onApiStepChange(index, 'value', e.target.value)}
                            sx={{ minWidth: 120, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
                          />
                        </Box>
                      )}
                    </Box>
                  </Collapse>
                </Box>
              </Box>
            </Paper>
          );
        }

        const action = actions.find((a) => a.id === step.actionId);
        const needsValue = action?.withValue;
        const uiSummary = getStepSummaryLine(step, summaryCtx);
        const resolvedPageId = step.pageId || defaultPageId || testPageId || pages[0]?.id || '';
        const elementsOnPage = elementsWithPage.filter((el) => el.pageId === resolvedPageId);
        const uiDetailsOpen = uiExpanded[index] ?? false;
        const selectedElement = elementsOnPage.find((el) => el.id === step.webElementId) || null;
        const selectedAction = actions.find((a) => a.id === step.actionId) || null;

        return (
          <Paper
            key={`step-${index}`}
            variant="outlined"
            sx={{
              p: 1.5,
              borderColor: 'divider',
              borderLeftWidth: 4,
              borderLeftColor: 'success.main',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap' }}>
              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: uiDetailsOpen ? 1 : 0 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    Step {index + 1}
                  </Typography>
                  <Chip size="small" label="UI" color="success" />
                  <Typography variant="body2" sx={{ color: 'text.primary', flex: 1, minWidth: 160 }}>
                    {uiSummary}
                  </Typography>
                  <Button
                    size="small"
                    endIcon={<ExpandMoreIcon sx={{ transform: uiDetailsOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />}
                    onClick={() => toggleUiDetails(index)}
                    sx={{ color: 'primary.main', textTransform: 'none' }}
                  >
                    {uiDetailsOpen ? 'Hide details' : 'Edit step'}
                  </Button>
                  <IconButton size="small" onClick={() => onMoveStep(index, -1)} sx={{ color: 'text.secondary' }}>
                    <ArrowUpwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => onMoveStep(index, 1)} sx={{ color: 'text.secondary' }}>
                    <ArrowDownwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => onRemoveStep(index)} sx={{ color: 'text.secondary' }}>
                    <DeleteIcon />
                  </IconButton>
                </Box>

                <Collapse in={uiDetailsOpen} timeout="auto" unmountOnExit={false}>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'flex-start', pt: 0.5 }}>
                    <Autocomplete
                      size="small"
                      options={pages}
                      value={pages.find((p) => p.id === resolvedPageId) || null}
                      onChange={(_, option) => onStepChange(index, 'pageId', option?.id || '')}
                      getOptionLabel={(option) => option?.title || option?.url || option?.id || ''}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      filterOptions={(options, state) => {
                        const query = state.inputValue.trim().toLowerCase();
                        if (!query) return options;
                        return options.filter((option) => {
                          const title = (option.title || '').toLowerCase();
                          const url = (option.url || '').toLowerCase();
                          return title.includes(query) || url.includes(query);
                        });
                      }}
                      noOptionsText="No pages"
                      sx={{ minWidth: 200 }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Page"
                          placeholder="Search page..."
                          sx={{ '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
                        />
                      )}
                    />
                    <Autocomplete
                      size="small"
                      options={elementsOnPage}
                      value={selectedElement}
                      onChange={(_, option) => onStepChange(index, 'webElementId', option?.id || '')}
                      getOptionLabel={(option) => option?.title || option?.selector || option?.id || ''}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      filterOptions={(options, state) => {
                        const query = state.inputValue.trim().toLowerCase();
                        if (!query) return options;
                        return options.filter((option) => {
                          const title = (option.title || '').toLowerCase();
                          const selector = (option.selector || '').toLowerCase();
                          return title.includes(query) || selector.includes(query);
                        });
                      }}
                      noOptionsText="No elements on this page"
                      disabled={!resolvedPageId}
                      sx={{ minWidth: variant === 'shared' ? 200 : 220 }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label={variant === 'shared' ? 'Element' : 'Target (Element)'}
                          placeholder="Search element by name..."
                          sx={{ '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
                        />
                      )}
                    />
                    <Autocomplete
                      size="small"
                      options={actions}
                      value={selectedAction}
                      onChange={(_, option) => onStepChange(index, 'actionId', option?.id || '')}
                      getOptionLabel={(option) => option?.name || option?.id || ''}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      filterOptions={(options, state) => {
                        const query = state.inputValue.trim().toLowerCase();
                        if (!query) return options;
                        return options.filter((option) => (option.name || '').toLowerCase().includes(query));
                      }}
                      noOptionsText="No actions"
                      sx={{ minWidth: 140 }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Action"
                          placeholder="Search action..."
                          sx={{ '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
                        />
                      )}
                    />
                    {needsValue && (
                      <TextField
                        size="small"
                        placeholder="Value (use {{var}})"
                        value={step.value ?? ''}
                        onChange={(e) => onStepChange(index, 'value', e.target.value)}
                        sx={{ minWidth: 120, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
                      />
                    )}
                  </Box>
                </Collapse>
              </Box>
            </Box>
          </Paper>
        );
      })}
    </Box>
  );
}
