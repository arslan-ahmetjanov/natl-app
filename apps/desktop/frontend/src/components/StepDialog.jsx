import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  ListSubheader,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { parse, stringify } from 'yaml';

const ACTIONS = [
  { group: 'Интерфейс', value: 'click', label: 'Нажать', needs: ['selector'] },
  { group: 'Интерфейс', value: 'fill', label: 'Ввести текст', needs: ['selector', 'value'] },
  { group: 'Интерфейс', value: 'select', label: 'Выбрать в списке', needs: ['selector', 'value'] },
  { group: 'Интерфейс', value: 'check', label: 'Поставить отметку', needs: ['selector'] },
  { group: 'Интерфейс', value: 'uncheck', label: 'Снять отметку', needs: ['selector'] },
  { group: 'Интерфейс', value: 'assert', label: 'Проверить текст', needs: ['selector', 'value'] },
  { group: 'Интерфейс', value: 'assert_visible', label: 'Проверить, что видно', needs: ['selector'] },
  { group: 'Интерфейс', value: 'goto', label: 'Открыть страницу', needs: ['url'] },
  { group: 'Запросы', value: 'get', label: 'GET', needs: ['url'] },
  { group: 'Запросы', value: 'post', label: 'POST', needs: ['url'] },
  { group: 'Запросы', value: 'put', label: 'PUT', needs: ['url'] },
  { group: 'Запросы', value: 'patch', label: 'PATCH', needs: ['url'] },
  { group: 'Запросы', value: 'delete', label: 'DELETE', needs: ['url'] },
];

const GROUPS = [...new Set(ACTIONS.map((item) => item.group))];

/** Конструктор шага: одно действие, без деления на вкладки. */
export default function StepDialog({ open, onClose, text, onAppend }) {
  const [action, setAction] = useState('click');
  const [selector, setSelector] = useState('');
  const [value, setValue] = useState('');
  const [url, setUrl] = useState('');
  const [saveAs, setSaveAs] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
  }, [open]);

  const current = useMemo(
    () => ACTIONS.find((item) => item.value === action) || ACTIONS[0],
    [action],
  );
  const isRequest = ['get', 'post', 'put', 'patch', 'delete'].includes(action);

  const build = () => {
    if (current.needs.includes('url')) {
      const address = url.trim();
      if (!address) return { error: 'Нужен адрес' };
      if (action === 'goto') return { step: { goto: address } };
      const name = saveAs.trim();
      return { step: name ? { [action]: address, save: name } : { [action]: address } };
    }

    const target = selector.trim();
    if (!target) return { error: 'Нужен селектор' };

    if (action === 'assert_visible') return { step: { assert: target, visible: true } };
    if (action === 'assert') {
      if (!value) return { error: 'Нужен ожидаемый текст' };
      return { step: { assert: target, text: value } };
    }
    if (action === 'fill' || action === 'select') {
      if (!value) return { error: 'Нужно значение' };
      return { step: { [action]: target, with: value } };
    }
    return { step: { [action]: target } };
  };

  const add = () => {
    const built = build();
    if (built.error) {
      setError(built.error);
      return;
    }
    try {
      const doc = parse(text || '') || {};
      if (!Array.isArray(doc.steps)) doc.steps = [];
      doc.steps.push(built.step);
      onAppend(stringify(doc, { lineWidth: 0 }));
      setSelector('');
      setValue('');
      setUrl('');
      setSaveAs('');
      setError(null);
      onClose();
    } catch (err) {
      setError(`Не удалось изменить YAML: ${err.message || err}`);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Добавить шаг</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            select
            size="small"
            label="Действие"
            value={action}
            onChange={(event) => setAction(event.target.value)}
          >
            {GROUPS.map((group) => [
              <ListSubheader key={group}>{group}</ListSubheader>,
              ...ACTIONS.filter((item) => item.group === group).map((item) => (
                <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>
              )),
            ])}
          </TextField>

          {current.needs.includes('selector') && (
            <TextField
              size="small"
              label="Селектор"
              placeholder="#login-btn или [data-testid=save]"
              value={selector}
              onChange={(event) => setSelector(event.target.value)}
            />
          )}

          {current.needs.includes('value') && (
            <TextField
              size="small"
              label={action === 'assert' ? 'Ожидаемый текст' : 'Значение'}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          )}

          {current.needs.includes('url') && (
            <TextField
              size="small"
              label={action === 'goto' ? 'Адрес страницы' : 'Адрес запроса'}
              placeholder="$base_url/api/orders"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
          )}

          {isRequest && (
            <TextField
              size="small"
              label="Сохранить ответ как"
              placeholder="resp"
              value={saveAs}
              onChange={(event) => setSaveAs(event.target.value)}
            />
          )}

          {error && <Alert severity="warning">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Отмена</Button>
        <Button variant="contained" onClick={add}>Добавить</Button>
      </DialogActions>
    </Dialog>
  );
}
