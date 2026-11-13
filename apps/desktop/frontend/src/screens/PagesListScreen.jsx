import { useState } from 'react';
import { Box, Button, Typography, List, ListItem, ListItemButton, ListItemText } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import ScreenHeader from '../components/ScreenHeader';
import SectionLabel from '../components/SectionLabel';
import ParsePageElementsDialog from '../components/ParsePageElementsDialog';

export default function PagesListScreen({ pages, onAddPage, onOpenPage, onRefresh }) {
  const [parseOpen, setParseOpen] = useState(false);
  const [parseTargetId, setParseTargetId] = useState('');

  const openParseDialog = () => {
    if (!pages.length) return;
    setParseTargetId(pages[0].id);
    setParseOpen(true);
  };

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <ScreenHeader
        title="Pages"
        actions={
          <>
            <Button
              size="small"
              startIcon={<RefreshIcon />}
              onClick={openParseDialog}
              disabled={!pages.length}
              sx={{ color: 'primary.main' }}
            >
              Parse elements
            </Button>
            <Button size="small" startIcon={<AddIcon />} onClick={onAddPage} sx={{ color: 'primary.main' }}>
              Add
            </Button>
          </>
        }
      />
      <SectionLabel sx={{ mb: 0.5 }}>All pages</SectionLabel>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Pages are URLs you want to test. Use Parse elements to import controls with optional auth (Bearer, Basic, or headers such as Cookie). Select a page to edit elements in detail.
      </Typography>
      <List dense>
        {pages.length === 0 && (
          <ListItem>
            <ListItemText
              primary="No pages yet"
              secondary="Click Add to create a page (title + URL), then generate elements and tests"
              primaryTypographyProps={{ sx: { color: 'text.primary' } }}
              secondaryTypographyProps={{ sx: { color: 'text.secondary' } }}
            />
          </ListItem>
        )}
        {pages.map((p) => (
          <ListItem key={p.id} disablePadding>
            <ListItemButton onClick={() => onOpenPage?.(p.id)}>
              <ListItemText
                primary={p.title}
                secondary={p.url || '—'}
                primaryTypographyProps={{ sx: { color: 'text.primary' } }}
                secondaryTypographyProps={{ sx: { color: 'text.secondary', wordBreak: 'break-all' } }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <ParsePageElementsDialog
        open={parseOpen}
        onClose={() => setParseOpen(false)}
        onSuccess={() => {
          onRefresh?.();
        }}
        targetPageId={parseTargetId}
        onTargetPageIdChange={setParseTargetId}
        pages={pages}
      />
    </Box>
  );
}
