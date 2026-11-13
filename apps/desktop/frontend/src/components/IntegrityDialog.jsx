import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

/**
 * Что не так с файлами рабочей папки сразу после её открытия.
 *
 * Диалог справочный: папка уже открыта, диалог можно закрыть и работать.
 * «Открыть» показываем только для сценариев из tests/: остальные файлы
 * (ресурсы, служебные) на экране сценария делать нечего.
 */
export default function IntegrityDialog({ report, onClose, onOpen }) {
  const problems = report?.problems || [];
  const errors = problems.filter((item) => item.level === 'error').length;
  const warnings = problems.length - errors;

  return (
    <Dialog open={Boolean(report)} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Проверка файлов</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
          {errors > 0 ? `Ошибок: ${errors}` : 'Ошибок нет'}
          {warnings > 0 ? `. Предупреждений: ${warnings}` : ''}
        </Typography>

        <List dense sx={{ maxHeight: 360, overflow: 'auto' }}>
          {problems.map((item, index) => (
            <ListItem
              key={`${item.relativePath}-${index}`}
              alignItems="flex-start"
              secondaryAction={
                onOpen && item.relativePath.startsWith('tests/') ? (
                  <Button size="small" startIcon={<OpenInNewIcon />} onClick={() => onOpen(item.relativePath)}>
                    Открыть
                  </Button>
                ) : null
              }
            >
              <ListItemIcon sx={{ minWidth: 32, mt: 0.5 }}>
                {item.level === 'error' ? (
                  <ErrorOutlineIcon fontSize="small" color="error" />
                ) : (
                  <WarningAmberIcon fontSize="small" color="warning" />
                )}
              </ListItemIcon>
              <ListItemText
                primary={item.relativePath}
                secondary={item.message}
                primaryTypographyProps={{ fontFamily: 'monospace', fontSize: 12 }}
                secondaryTypographyProps={{ fontSize: 12 }}
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Понятно</Button>
      </DialogActions>
    </Dialog>
  );
}
