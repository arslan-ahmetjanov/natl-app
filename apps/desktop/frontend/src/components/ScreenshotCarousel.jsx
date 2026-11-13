import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

/** Карусель кадров прогона: открывается отдельной кнопкой, не засоряет отчёт. */
export default function ScreenshotCarousel({ open, onClose, images }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'ArrowLeft') setIndex((value) => Math.max(0, value - 1));
      if (event.key === 'ArrowRight') setIndex((value) => Math.min(images.length - 1, value + 1));
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, images.length, onClose]);

  if (!images || images.length === 0) return null;
  const current = images[Math.min(index, images.length - 1)];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
        Скриншоты прогона
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {index + 1} из {images.length}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            onClick={() => setIndex((value) => Math.max(0, value - 1))}
            disabled={index === 0}
            aria-label="Предыдущий кадр"
          >
            <ChevronLeftIcon />
          </IconButton>
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <Box
              component="img"
              src={current.src}
              alt={`Шаг ${current.step}, ${current.phase}`}
              sx={{ maxWidth: '100%', maxHeight: '62vh', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
            />
            <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
              Шаг {current.step} · {current.action} · {current.phase === 'before' ? 'до' : 'после'}
            </Typography>
          </Box>
          <IconButton
            onClick={() => setIndex((value) => Math.min(images.length - 1, value + 1))}
            disabled={index === images.length - 1}
            aria-label="Следующий кадр"
          >
            <ChevronRightIcon />
          </IconButton>
        </Box>
      </DialogContent>
      <Box sx={{ px: 2, pb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button onClick={onClose}>Закрыть</Button>
      </Box>
    </Dialog>
  );
}
