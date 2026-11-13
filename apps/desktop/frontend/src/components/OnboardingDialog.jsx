import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Typography,
} from '@mui/material';

const HIDE_KEY = 'natl-onboarding-hidden';

export function onboardingHidden() {
  return localStorage.getItem(HIDE_KEY) === '1';
}

export function resetOnboarding() {
  localStorage.removeItem(HIDE_KEY);
}

/** Подсказки при первом входе. Отключаются чек-боксом и включаются в настройках. */
export default function OnboardingDialog() {
  const [open, setOpen] = useState(false);
  const [hide, setHide] = useState(false);

  useEffect(() => {
    if (!onboardingHidden()) setOpen(true);
  }, []);

  const close = () => {
    if (hide) localStorage.setItem(HIDE_KEY, '1');
    setOpen(false);
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle>Как это работает</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <Typography variant="body2">
            <strong>1. Запись.</strong> Нажмите «Записать», введите адрес и пройдите путь руками.
            NATL сохранит YAML в папку tests/ вашего проекта.
          </Typography>
          <Typography variant="body2">
            <strong>2. Понятный вид.</strong> Переключатель «Понятно» показывает шаги фразами,
            «YAML» — файлом. Это один и тот же сценарий.
          </Typography>
          <Typography variant="body2">
            <strong>3. Окружение.</strong> Локаторы и повторяющиеся действия живут в pages/
            и подключаются к сценарию через imports и do:.
          </Typography>
          <Typography variant="body2">
            <strong>4. Проверка.</strong> Перед запуском сценарий проверяется: ошибки блокируют Run,
            замечания просто показываются.
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Горячие клавиши: Ctrl+R — запуск, Ctrl+S — сохранить, Ctrl+N — новый шаг,
            Ctrl+Shift+E — переключить вид.
          </Typography>
          <Box>
            <FormControlLabel
              control={<Checkbox checked={hide} onChange={(event) => setHide(event.target.checked)} />}
              label="Больше не показывать"
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={close}>Ясно</Button>
      </DialogActions>
    </Dialog>
  );
}
