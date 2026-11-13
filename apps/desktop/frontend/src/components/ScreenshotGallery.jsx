import { useState, useEffect } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

/**
 * Fullscreen gallery: overlay, one image, prev/next arrows, dots.
 * images: array of image URLs (data URLs or blob)
 * initialIndex: index to show first
 * onClose: callback when gallery closes
 */
export default function ScreenshotGallery({ images = [], initialIndex = 0, onClose }) {
  const theme = useTheme();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const successMain = theme.palette.success.main;
  const successBg = alpha(successMain, 0.7);
  const successBgHover = alpha(successMain, 0.9);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  if (images.length === 0) return null;

  const handlePrev = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const currentSrc = images[currentIndex];

  return (
    <Box
      onClick={onClose}
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 1300,
        bgcolor: 'rgba(6, 3, 20, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box
        onClick={(e) => e.stopPropagation()}
        sx={{
          position: 'relative',
          bgcolor: '#fff',
          borderRadius: '20px',
          border: '1px solid',
          borderColor: 'success.main',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
          mx: 2.5,
          overflow: 'hidden',
          maxHeight: 'calc(100vh - 20px)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 320, minHeight: 240 }}>
          {currentSrc ? (
            <Box
              component="img"
              src={currentSrc}
              alt={`Screenshot ${currentIndex + 1}`}
              sx={{
                maxHeight: 'calc(100vh - 20px)',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          ) : (
            <Typography sx={{ color: '#888', p: 2 }}>Loading…</Typography>
          )}
        </Box>

        <IconButton
          onClick={handlePrev}
          sx={{
            position: 'absolute',
            left: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            bgcolor: successBg,
            color: 'background.paper',
            '&:hover': { bgcolor: successBgHover },
          }}
        >
          <ChevronLeftIcon />
        </IconButton>
        <IconButton
          onClick={handleNext}
          sx={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            bgcolor: successBg,
            color: 'background.paper',
            '&:hover': { bgcolor: successBgHover },
          }}
        >
          <ChevronRightIcon />
        </IconButton>

        <Box
          sx={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 0.5,
            bgcolor: successBg,
            borderRadius: '999px',
            px: 0.75,
            py: 0.75,
          }}
        >
          {images.map((_, index) => (
            <Box
              key={index}
              onClick={(e) => { e.stopPropagation(); setCurrentIndex(index); }}
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                bgcolor: index === currentIndex ? '#fff' : '#212121',
                cursor: 'pointer',
              }}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
}
