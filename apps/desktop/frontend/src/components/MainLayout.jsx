import { Box, Paper } from '@mui/material';

/**
 * Single shell layout: header bar + (sidebar | content).
 * Used for both welcome (no workspace) and workspace views.
 */
export default function MainLayout({ topBar = null, header, sidebar, content }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      {topBar}
      {header}
      <Box sx={{ flex: 1, display: 'flex', p: 2, gap: 2, overflow: 'hidden' }}>
        {sidebar}
        <Paper
          component="main"
          sx={{
            flex: 1,
            p: 0,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          {content}
        </Paper>
      </Box>
    </Box>
  );
}
