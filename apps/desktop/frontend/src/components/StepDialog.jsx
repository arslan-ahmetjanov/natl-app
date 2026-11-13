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

const ACTIONS = [
  { group: 'Интерфейс', value: 'click', label: 'Нажать', needs: ['selector'] },
  { group: 'Интерфейс', value: 'fill', label: 'Ввести текст', needs: ['selector', 'value'] },
  { group: 'Интерфейс', value: 'select', label: 'Выбрать в списке', needs: ['selector', 'value'] },
  { group: 'Интерфейс', value: 'check', label: 'Поставить отметку', needs: ['selector'] },
  { group: 'Интерфейс', value: 'uncheck', label: 'Снять отметку', needs: ['selector'] },
  { group: 'Интерфейс', value: 'assert', label: 'Проверить текст', needs: ['selector', 'value'] },
  { group: 'Интерфейс', value: 'assert_visible', label: 'Проверить, что видно', needs: ['selector'] },
  { group: 'Интерфейс', value: 'wait', label: 'Ожидание', needs: ['selector'] },
  { group: 'Интерфейс', value: 'goto', label: 'Открыть страницу', needs: ['url'] },
  { group: 'Запросы', value: 'get', label: 'GET', needs: ['url'] },
  { group: 'Запросы', value: 'post', label: 'POST', needs: ['url'] },
  { group: 'Запросы', value: 'put', label: 'PUT', needs: ['url'] },
  { group: 'Запросы', value: 'patch', label: 'PATCH', needs: ['url'] },
  { group: 'Запросы', value: 'delete', label: 'DELETE', needs: ['url'] },
  { group: 'Прочее', value: 'log', label: 'Записать в журнал', needs: ['value'] },
];

const GROUPS = [...new Set(ACTIONS.map((item) => item.group))];

/**
 * Конструктор шага: создание и правка.
 *
 * Если передан initial, поля заполняются из существующего шага, а кнопка
 * меняется на «Сохранить». Один компонент на оба случая — иначе правка
 * и создание расходятся в поведении.
 */
export default function StepDialog({ open, onClose, onSave, initial = null }) {
  const [action, setAction] = useState('click');
  const [selector, setSelector] = useState('');
  const [value, setValue] = useState('');
  const [url, setUrl] = useState('');
  const [saveAs, setSaveAs] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (!initial) {
      setAction('click');
      setSelector('');
      setValue('');
      setUrl('');
      setSaveAs('');
      return;
    }
    const verb = Object.keys(initial)[0] || 'click';
    setAction(verb === 'assert' && initial.visible ? 'assert_visible' : verb);
    if (verb === 'goto' || ['get', 'post', 'put', 'patch', 'delete'].includes(verb)) {
      setUrl(String(initial[verb] || ''));
      setSaveAs(String(initial.save || ''));
      setSelector('');
      setValue('');
      return;
    }
    setSelector(typeof initial[verb] === 'string' ? initial[verb] : '');
    setValue(String(initial.text ?? initial.with ?? initial.log ?? ''));
    setUrl('');
    setSaveAs('');
  }, [open, initial]);

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
      return { step: saveAs.trim() ? { [action]: address, save: saveAs.trim() } : { [action]: address } };
    }

    if (action === 'log') {
      if (!value) return { error: 'Нужно сообщение' };
      return { step: { log: value } };
    }

    const target = selector.trim();
    if (!target) return { error: 'Нужен селектор' };

    if (action === 'assert_visible') return { step: { assert: target, visible: true } };
    if (action === 'assert') {
      if (!value) return { error: 'Нужен ожидаемый текст' };
      return { step: { assert: target, text: value } };
    }
    if (action === 'wait') return { step: { wait: target, state: 'visible' } };
    if (action === 'fill' || action === 'select') {
      if (!value) return { error: 'Нужно значение' };
      return { step: { [action]: target, with: value } };
    }
    return { step: { [action]: target } };
  };

  const submit = () => {
    const built = build();
    if (built.error) {
      setError(built.error);
      return;
    }
    onSave(built.step);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{initial ? 'Изменить шаг' : 'Добавить шаг'}</DialogTitle>
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
              placeholder="#login-btn или $email"
              value={selector}
              onChange={(event) => setSelector(event.target.value)}
            />
          )}

          {current.needs.includes('value') && (
            <TextField
              size="small"
              label={action === 'assert' ? 'Ожидаемый текст' : action === 'log' ? 'Сообщение' : 'Значение'}
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
        <Button variant="contained" onClick={submit}>{initial ? 'Сохранить' : 'Добавить'}</Button>
      </DialogActions>
    </Dialog>
  );
}
