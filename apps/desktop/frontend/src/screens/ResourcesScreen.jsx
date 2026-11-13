import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { parse, stringify } from 'yaml';
import YamlEditor from '../components/YamlEditor';
import StepDialog from '../components/StepDialog';
import { humanizeError } from '../utils/errors';

const AUTOSAVE_MS = 700;

/**
 * Окружение: локаторы и переиспользуемые действия.
 *
 * Файл — обычный page object NATL из pages/. Сценарий подключает его через
 * imports и вызывает `do: <файл>.<действие>`, поэтому ресурсы не дублируются
 * по тестам и правятся в одном месте.
 */
export default function ResourcesScreen() {
  const theme = useTheme();
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(null);
  const [text, setText] = useState('');
  const [saved, setSaved] = useState('');
  const [tab, setTab] = useState('locators');
  const [newAction, setNewAction] = useState('');
  const [copied, setCopied] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [stepEdit, setStepEdit] = useState(null); // { action, index, initial }
  const [renameOpen, setRenameOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const timer = useRef(null);
  const api = window.electronAPI;

  const load = useCallback(async () => {
    try {
      const list = await api.resourcesList();
      setItems(list || []);
      setError(null);
      if (!active && list && list.length) open(list[0]);
    } catch (err) {
      setError(err && err.message ? err.message : String(err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const open = async (item) => {
    try {
      const read = await api.resourcesRead(item.relativePath);
      setActive(item);
      setText(read.text || '');
      setSaved(read.text || '');
      setError(null);
    } catch (err) {
      setError(err && err.message ? err.message : String(err));
    }
  };

  useEffect(() => {
    if (!active || text === saved) return undefined;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await api.resourcesWrite({ relativePath: active.relativePath, text });
        setSaved(text);
        load();
      } catch (err) {
        setError(err && err.message ? err.message : String(err));
      }
    }, AUTOSAVE_MS);
    return undefined;
  }, [text, saved, active, api, load]);

  const doc = useMemo(() => {
    try {
      return parse(text || '') || {};
    } catch {
      return null;
    }
  }, [text]);

  const update = (mutator) => {
    try {
      const next = parse(text || '') || {};
      mutator(next);
      setText(stringify(next, { lineWidth: 0 }));
      setError(null);
    } catch (err) {
      setError(humanizeError(err));
    }
  };

  const elements = useMemo(() => {
    if (!doc || !doc.elements || typeof doc.elements !== 'object') return [];
    return Object.entries(doc.elements).map(([name, value]) => {
      if (typeof value === 'string') return { name, strategy: '', selector: value };
      return {
        name,
        strategy: value?.strategy || '',
        selector: value?.value || '',
      };
    });
  }, [doc]);

  const actions = useMemo(() => {
    if (!doc || !doc.actions || typeof doc.actions !== 'object') return [];
    return Object.entries(doc.actions).map(([name, steps]) => ({
      name,
      steps: Array.isArray(steps) ? steps.length : 0,
    }));
  }, [doc]);

  const renameElement = (oldName, nextName, selector, strategy) => {
    update((next) => {
      next.elements = next.elements || {};
      delete next.elements[oldName];
      next.elements[nextName] = strategy ? { strategy, value: selector } : selector;
    });
  };

  const addElement = () => {
    const name = `element${elements.length + 1}`;
    update((next) => {
      next.elements = next.elements || {};
      next.elements[name] = '#selector';
    });
  };

  const removeElement = (name) => {
    update((next) => {
      if (next.elements) delete next.elements[name];
    });
  };

  const addAction = () => {
    const name = newAction.trim() || `action${actions.length + 1}`;
    update((next) => {
      next.actions = next.actions || {};
      next.actions[name] = [{ click: '#selector' }];
    });
    setNewAction('');
  };

  const removeAction = (name) => {
    update((next) => {
      if (next.actions) delete next.actions[name];
    });
  };

  const baseName = active ? active.fileName.replace(/\.ya?ml$/i, '') : '';

  const actionSteps = (name) => {
    const list = doc && doc.actions ? doc.actions[name] : null;
    return Array.isArray(list) ? list : [];
  };

  const addStepToAction = (actionName, step) => {
    update((next) => {
      next.actions = next.actions || {};
      if (!Array.isArray(next.actions[actionName])) next.actions[actionName] = [];
      next.actions[actionName].push(step);
    });
  };

  const replaceStep = (actionName, index, step) => {
    update((next) => {
      if (next.actions && Array.isArray(next.actions[actionName])) {
        next.actions[actionName][index] = step;
      }
    });
  };

  const removeStep = (actionName, index) => {
    update((next) => {
      if (next.actions && Array.isArray(next.actions[actionName])) {
        next.actions[actionName].splice(index, 1);
      }
    });
  };

  const moveStep = (actionName, index, direction) => {
    update((next) => {
      const list = next.actions && next.actions[actionName];
      if (!Array.isArray(list)) return;
      const target = index + direction;
      if (target < 0 || target >= list.length) return;
      const [step] = list.splice(index, 1);
      list.splice(target, 0, step);
    });
  };

  const renameResource = async () => {
    try {
      const result = await api.resourcesRename({ relativePath: active.relativePath, name: newFileName });
      setRenameOpen(false);
      await load();
      open({ relativePath: result.relativePath, fileName: result.fileName });
    } catch (err) {
      setError(humanizeError(err));
    }
  };

  const deleteResource = async () => {
    try {
      await api.resourcesDelete(active.relativePath);
      setDeleteOpen(false);
      setActive(null);
      setText('');
      setSaved('');
      await load();
    } catch (err) {
      setError(humanizeError(err));
    }
  };

  const copySnippet = async (actionName) => {
    const snippet = `imports:\n  - ${active.relativePath}\nsteps:\n  - do: ${baseName}.${actionName}`;
    await navigator.clipboard.writeText(snippet);
    setCopied(actionName);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <Box sx={{ display: 'flex', flex: 1, minHeight: 0, gap: 1.5, p: 1.5 }}>
      <Paper sx={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="subtitle2" sx={{ flex: 1 }}>Окружение</Typography>
          <Tooltip title="Обновить">
            <IconButton size="small" onClick={load} aria-label="Обновить">
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Создать файл ресурсов">
            <IconButton
              size="small"
              aria-label="Создать файл ресурсов"
              onClick={async () => {
                try {
                  const created = await api.resourcesCreate('resources');
                  await load();
                  open({ relativePath: created.relativePath, fileName: created.fileName });
                } catch (err) {
                  setError(humanizeError(err));
                }
              }}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Divider />
        <Box sx={{ overflow: 'auto', flex: 1, p: 1 }}>
          {items.map((item) => (
            <Button
              key={item.relativePath}
              fullWidth
              onClick={() => open(item)}
              variant={active && active.relativePath === item.relativePath ? 'contained' : 'text'}
              sx={{ justifyContent: 'flex-start', textTransform: 'none', mb: 0.5 }}
            >
              {item.fileName}
            </Button>
          ))}
          {items.length === 0 && (
            <Typography variant="body2" sx={{ color: 'text.secondary', p: 1 }}>
              Пока пусто. Создайте файл — локаторы и действия будут доступны всем сценариям.
            </Typography>
          )}
        </Box>
      </Paper>

      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Tabs value={tab} onChange={(_, next) => setTab(next)} sx={{ flex: 1, minHeight: 40 }}>
            <Tab value="locators" label="Локаторы" sx={{ minHeight: 40 }} />
            <Tab value="actions" label="Действия" sx={{ minHeight: 40 }} />
            <Tab value="yaml" label="YAML" sx={{ minHeight: 40 }} />
          </Tabs>
          {active && <Chip size="small" variant="outlined" label={active.relativePath} />}
          {active && (
            <>
              <Tooltip title="Переименовать файл">
                <IconButton
                  size="small"
                  onClick={() => {
                    setNewFileName(active.fileName.replace(/\.ya?ml$/i, ''));
                    setRenameOpen(true);
                  }}
                  aria-label="Переименовать файл"
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Удалить файл ресурсов">
                <IconButton size="small" onClick={() => setDeleteOpen(true)} aria-label="Удалить файл ресурсов">
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>

        {error && <Alert severity="error" sx={{ m: 1.5 }}>{error}</Alert>}

        {!active && (
          <Box sx={{ p: 3 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Выберите файл ресурсов слева или создайте новый.
            </Typography>
          </Box>
        )}

        {active && tab === 'locators' && (
          <Box sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width={220}>Имя</TableCell>
                  <TableCell width={120}>Стратегия</TableCell>
                  <TableCell>Селектор</TableCell>
                  <TableCell width={56} />
                </TableRow>
              </TableHead>
              <TableBody>
                {elements.map((element, index) => (
                  <TableRow key={`${element.name}-${index}`}>
                    <TableCell>
                      <TextField
                        size="small"
                        value={element.name}
                        onChange={(event) =>
                          renameElement(element.name, event.target.value, element.selector, element.strategy)
                        }
                        fullWidth
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        select
                        value={element.strategy}
                        onChange={(event) =>
                          renameElement(element.name, element.name, element.selector, event.target.value)
                        }
                        fullWidth
                        SelectProps={{ native: true }}
                      >
                        <option value="">css</option>
                        <option value="xpath">xpath</option>
                      </TextField>
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={element.selector}
                        onChange={(event) =>
                          renameElement(element.name, element.name, event.target.value, element.strategy)
                        }
                        fullWidth
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => removeElement(element.name)} aria-label="Удалить локатор">
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button startIcon={<AddIcon />} onClick={addElement} sx={{ mt: 1 }}>
              Добавить локатор
            </Button>
            <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'text.secondary' }}>
              В шагах используйте имя как переменную: <code>fill: $email</code>.
            </Typography>
          </Box>
        )}

        {active && tab === 'actions' && (
          <Box sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>
            <Stack spacing={1}>
              {actions.map((action) => (
                <Paper key={action.name} sx={{ p: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <IconButton
                      size="small"
                      onClick={() => setExpanded((prev) => (prev === action.name ? null : action.name))}
                      aria-label={expanded === action.name ? 'Свернуть шаги' : 'Показать шаги'}
                    >
                      {expanded === action.name ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                    </IconButton>
                    <Typography variant="subtitle2" sx={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                      {action.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', flex: 1 }}>
                      {action.steps} шагов
                    </Typography>
                    <Button size="small" startIcon={<ContentCopyIcon />} onClick={() => copySnippet(action.name)}>
                      {copied === action.name ? 'Скопировано' : 'В сценарий'}
                    </Button>
                    <IconButton size="small" onClick={() => removeAction(action.name)} aria-label="Удалить действие">
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  {expanded === action.name && (
                    <Box sx={{ mt: 1, pl: 4 }}>
                      {actionSteps(action.name).map((step, index) => {
                        const verb = Object.keys(step)[0] || 'шаг';
                        const target = typeof step[verb] === 'string' ? step[verb] : '';
                        return (
                          <Box
                            key={`${action.name}-${index}`}
                            sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}
                          >
                            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'primary.main', minWidth: 20 }}>
                              {index + 1}
                            </Typography>
                            <Typography variant="body2" sx={{ flex: 1, fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>
                              {verb}: {target}
                              {step.with !== undefined ? ` → ${step.with}` : ''}
                            </Typography>
                            <IconButton size="small" onClick={() => moveStep(action.name, index, -1)} disabled={index === 0} aria-label="Выше">
                              <ArrowUpwardIcon fontSize="inherit" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => moveStep(action.name, index, 1)}
                              disabled={index === actionSteps(action.name).length - 1}
                              aria-label="Ниже"
                            >
                              <ArrowDownwardIcon fontSize="inherit" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => setStepEdit({ action: action.name, index, initial: step })}
                              aria-label="Изменить шаг"
                            >
                              <EditIcon fontSize="inherit" />
                            </IconButton>
                            <IconButton size="small" onClick={() => removeStep(action.name, index)} aria-label="Удалить шаг">
                              <DeleteOutlineIcon fontSize="inherit" />
                            </IconButton>
                          </Box>
                        );
                      })}
                      <Button
                        size="small"
                        startIcon={<AddIcon />}
                        sx={{ mt: 1 }}
                        onClick={() => setStepEdit({ action: action.name, index: null, initial: null })}
                      >
                        Добавить шаг
                      </Button>
                    </Box>
                  )}
                </Paper>
              ))}
              {actions.length === 0 && (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Действий пока нет. Добавьте — например, «login» из нескольких шагов.
                </Typography>
              )}
            </Stack>

            <Box sx={{ display: 'flex', gap: 1, mt: 2, alignItems: 'center' }}>
              <TextField
                size="small"
                label="Новое действие"
                placeholder="login"
                value={newAction}
                onChange={(event) => setNewAction(event.target.value)}
              />
              <Button variant="outlined" startIcon={<AddIcon />} onClick={addAction}>
                Добавить
              </Button>
            </Box>
            <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'text.secondary' }}>
              Действие вызывается в сценарии как <code>do: {baseName}.имя</code>.
            </Typography>
          </Box>
        )}

        {active && tab === 'yaml' && (
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <YamlEditor value={text} dark={theme.palette.mode === 'dark'} onChange={setText} />
          </Box>
        )}
      </Paper>

      <StepDialog
        open={Boolean(stepEdit)}
        initial={stepEdit ? stepEdit.initial : null}
        onClose={() => setStepEdit(null)}
        onSave={(step) => {
          if (!stepEdit) return;
          if (stepEdit.index === null) addStepToAction(stepEdit.action, step);
          else replaceStep(stepEdit.action, stepEdit.index, step);
          setStepEdit(null);
        }}
      />

      <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Переименовать файл ресурсов</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Имя файла"
            value={newFileName}
            onChange={(event) => setNewFileName(event.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameOpen(false)} sx={{ color: 'text.secondary' }}>Отмена</Button>
          <Button variant="contained" onClick={renameResource}>Переименовать</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Удалить файл ресурсов?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">{active && active.relativePath} будет удалён с диска.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} sx={{ color: 'text.secondary' }}>Отмена</Button>
          <Button color="error" variant="contained" onClick={deleteResource}>Удалить</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
