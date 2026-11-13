import { useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import BugReportIcon from '@mui/icons-material/BugReport';
import CloseIcon from '@mui/icons-material/Close';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import HomeIcon from '@mui/icons-material/Home';
import LightModeIcon from '@mui/icons-material/LightMode';
import RecordScenarioDialog from '../components/RecordScenarioDialog';
import LogsScreen from './LogsScreen';
import ScenariosScreen from './ScenariosScreen';

/**
 * The workspace shell.
 *
 * Three things only: scenarios, their run results and the log. Everything the
 * old app called "authoring" — pages, elements, API bases, shared steps — is
 * gone from the interface. A scenario is a file, so the app does not need a
 * model of the test on top of it.
 */
export default function WorkspaceView({
  workspacePath,
  workspace,
  themeMode,
  onToggleTheme,
  onRefresh,
  onOpenFolder,
  onCloseWorkspace,
}) {
  const [view, setView] = useState('scenarios'); // 'scenarios' | 'logs'
  const [recordOpen, setRecordOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const navItem = (icon, label, selected, onClick) => (
    <ListItemButton
      selected={selected}
      onClick={onClick}
      sx={{ borderRadius: 1, mb: 0.25 }}
    >
      <ListItemIcon sx={{ minWidth: 32 }}>{icon}</ListItemIcon>
      <ListItemText primary={label} primaryTypographyProps={{ fontSize: 14 }} />
    </ListItemButton>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.default' }}>
      <Paper
        square
        elevation={0}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 0.75,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700, letterSpacing: '0.06em' }}>
          NATL
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', ml: 1 }}>
          {workspace?.title || 'Workspace'}
        </Typography>
        <Box sx={{ flex: 1 }} />

        <Button
          size="small"
          startIcon={<FiberManualRecordIcon />}
          onClick={() => setRecordOpen(true)}
          sx={{ color: 'error.main' }}
        >
          Record
        </Button>

        {onToggleTheme && (
          <Tooltip title={themeMode === 'dark' ? 'Light theme' : 'Dark theme'}>
            <IconButton size="small" onClick={onToggleTheme} sx={{ color: 'text.secondary' }}>
              {themeMode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}
        {onCloseWorkspace && (
          <Tooltip title="Close workspace">
            <IconButton size="small" onClick={onCloseWorkspace} sx={{ color: 'text.secondary' }}>
              <HomeIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Paper>

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Paper
          square
          elevation={0}
          sx={{
            width: 220,
            flexShrink: 0,
            borderRight: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            display: 'flex',
            flexDirection: 'column',
            p: 1,
          }}
        >
          <Typography variant="caption" sx={{ color: 'text.secondary', px: 1, py: 0.5 }}>
            {workspacePath ? workspacePath.split(/[\\/]/).pop() : 'Workspace'}
          </Typography>
          <List dense disablePadding>
            {navItem(<AccountTreeIcon fontSize="small" />, 'Scenarios', view === 'scenarios', () => setView('scenarios'))}
            {navItem(<BugReportIcon fontSize="small" />, 'Logs', view === 'logs', () => setView('logs'))}
          </List>

          <Box sx={{ flex: 1 }} />

          <Tooltip title="Open another folder">
            <Button
              size="small"
              startIcon={<FolderOpenIcon />}
              onClick={async () => {
                if (!window.electronAPI || !onOpenFolder) return;
                const path = await window.electronAPI.openFolder();
                if (path) onOpenFolder(path);
              }}
              sx={{ justifyContent: 'flex-start', color: 'text.secondary' }}
            >
              Open folder
            </Button>
          </Tooltip>
        </Paper>

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {view === 'scenarios' && (
            <ScenariosScreen
              workspacePath={workspacePath}
              refreshToken={refreshToken}
              onRecord={() => setRecordOpen(true)}
            />
          )}
          {view === 'logs' && <LogsScreen />}
        </Box>
      </Box>

      <RecordScenarioDialog
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        onSaved={() => {
          setRefreshToken((value) => value + 1);
          if (onRefresh) onRefresh();
        }}
      />
    </Box>
  );
}
