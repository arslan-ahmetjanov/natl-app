import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { parse, stringify } from 'yaml';

/** UI actions NATL understands and that make sense without a record. */
const UI_ACTIONS = [
  { value: 'click', label: 'Клик', needsSelector: true, needsValue: false },
  { value: 'fill', label: 'Ввод текста', needsSelector: true, needsValue: true },
  { value: 'select', label: 'Выбор в списке', needsSelector: true, needsValue: true },
  { value: 'check', label: 'Отметить', needsSelector: true, needsValue: false },
  { value: 'uncheck', label: 'Снять отметку', needsSelector: true, needsValue: false },
  { value: 'wait', label: 'Ожидание', needsSelector: true, needsValue: false },
  { value: 'assert', label: 'Проверка текста', needsSelector: true, needsValue: true },
  { value: 'assert_visible', label: 'Проверка видимости', needsSelector: true, needsValue: false },
];

const API_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

/**
 * Build a step without editing YAML by hand.
 *
 * Two models exist in one product: what the browser does and what the API does.
 * The builder writes the same steps the language already has, so a built step
 * and a recorded step are indistinguishable in the file.
 */
export default function StepBuilder({ text, onAppend }) {
  const [tab, setTab] = useState('ui');
  const [error, setError] = useState(null);

  const [action, setAction] = useState('click');
  const [selector, setSelector] = useState('');
  const [value, setValue] = useState('');

  const [method, setMethod] = useState('get');
  const [url, setUrl] = useState('');
  const [saveAs, setSaveAs] = useState('');
  const [expectStatus, setExpectStatus] = useState('200');

  const current = useMemo(
    () => UI_ACTIONS.find((item) => item.value === action) || UI_ACTIONS[0],
    [action],
  );

  const addStep = (step) => {
    try {
      const doc = parse(text || '') || {};
      if (!Array.isArray(doc.steps)) doc.steps = [];
      doc.steps.push(step);
      onAppend(stringify(doc, { lineWidth: 0 }));
      setError(null);
    } catch (err) {
      setError(`Не удалось разобрать YAML: ${err.message || err}`);
    }
  };

  const addUiStep = () => {
    const target = selector.trim();
    if (!target) {
      setError('Нужен селектор');
      return;
    }
    if (action === 'assert_visible') {
      addStep({ assert: target, visible: true });
      return;
    }
    if (action === 'wait') {
      addStep({ wait: target, state: 'visible' });
      return;
    }
    if (current.needsValue) {
      if (!value) {
        setError('Нужно значение');
        return;
      }
      addStep(action === 'fill' || action === 'select'
        ? { [action]: target, with: value }
        : { [action]: target, text: value });
      return;
    }
    addStep({ [action]: target });
  };

  const addApiStep = () => {
    const target = url.trim();
    if (!target) {
      setError('Нужен адрес');
      return;
    }
    const name = saveAs.trim() || `resp_${method}`;
    addStep({ [method]: target, save: name });
    if (expectStatus.trim()) {
      addStep({ assert: `$${name}.status == ${expectStatus.trim()}` });
    }
  };

  return (
    <Box sx={{ p: 1.5 }}>
      <Tabs value={tab} onChange={(_, next) => setTab(next)} variant="fullWidth" sx={{ mb: 1.5 }}>
        <Tab value="ui" label="UI" sx={{ minHeight: 36, textTransform: 'none' }} />
        <Tab value="api" label="API" sx={{ minHeight: 36, textTransform: 'none' }} />
      </Tabs>

      {tab === 'ui' && (
        <Stack spacing={1.5}>
          <TextField
            select
            size="small"
            label="Действие"
            value={action}
            onChange={(event) => setAction(event.target.value)}
          >
            {UI_ACTIONS.map((item) => (
              <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Селектор"
            placeholder="#login-btn или [data-testid=save]"
            value={selector}
            onChange={(event) => setSelector(event.target.value)}
          />
          {current.needsValue && (
            <TextField
              size="small"
              label={action === 'assert' ? 'Ожидаемый текст' : 'Значение'}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          )}
          <Button variant="contained" startIcon={<AddIcon />} onClick={addUiStep}>
            Добавить шаг
          </Button>
        </Stack>
      )}

      {tab === 'api' && (
        <Stack spacing={1.5}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              select
              size="small"
              label="Метод"
              value={method}
              onChange={(event) => setMethod(event.target.value)}
              sx={{ width: 110 }}
            >
              {API_METHODS.map((item) => (
                <MenuItem key={item} value={item}>{item.toUpperCase()}</MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              label="Адрес"
              placeholder="$base_url/api/orders"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              sx={{ flex: 1 }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              size="small"
              label="Сохранить как"
              placeholder="order"
              value={saveAs}
              onChange={(event) => setSaveAs(event.target.value)}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              label="Статус"
              value={expectStatus}
              onChange={(event) => setExpectStatus(event.target.value)}
              sx={{ width: 100 }}
            />
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={addApiStep}>
            Добавить запрос
          </Button>
        </Stack>
      )}

      {error && <Alert severity="warning" sx={{ mt: 1.5 }}>{error}</Alert>}

      <Divider sx={{ my: 1.5 }} />
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Шаг добавляется в конец файла. Запись кликов и ручной текст дают тот же YAML.
      </Typography>
    </Box>
  );
}
