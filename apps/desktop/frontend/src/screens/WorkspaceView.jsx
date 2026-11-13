import { useState } from 'react';
import {
  Box,
  Button,
  Divider,
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
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import BugReportIcon from '@mui/icons-material/BugReport';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import DashboardIcon from '@mui/icons-material/SpaceDashboard';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import HomeIcon from '@mui/icons-material/Home';
import LightModeIcon from '@mui/icons-material/LightMode';
import SettingsIcon from '@mui/icons-material/Settings';
import LlmSettingsDialog from '../components/LlmSettingsDialog';
import RecordScenarioDialog from '../components/RecordScenarioDialog';
import AiChatScreen from './AiChatScreen';
import DashboardScreen from './DashboardScreen';
import LogsScreen from './LogsScreen';
import ScenarioScreen from './ScenarioScreen';
import ScenariosListScreen from './ScenariosListScreen';

/**
 * Оболочка рабочей папки в стиле рабочего места: верхняя панель,
 * боковое меню, экраны без вложенных панелей.
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
  const [view, setView] = useState('dashboard');
  const [selected, setSelected] = useState(null);
  const [recordOpen, setRecordOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const openScenario = (relativePath, title) => {
    setSelected({ relativePath, title });
    setView('scenario');
  };

  const navItem = (icon, label, active, onClick, hint) => (
    <ListItemButton
      selected={active}
      onClick={onClick}
      sx={{
        borderRadius: 2,
        mb: 0.5,
        px: 1.25,
        py: 1,
        '&.Mui-selected': {
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          '& .MuiListItemIcon-root': { color: 'primary.contrastText' },
          '&:hover': { bgcolor: 'primary.dark' },
        },
      }}
    >
      <ListItemIcon sx={{ minWidth: 32, color: 'text.secondary' }}>{icon}</ListItemIcon>
      <ListItemText
        primary={label}
        secondary={hint}
        slotProps={{
          primary: { fontSize: 14, fontWeight: 500 },
          secondary: { fontSize: 11 },
        }}
      />
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
          gap: 1.5,
          px: 2,
          height: 56,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          flexShrink: 0,
        }}
      >
        <Typography sx={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, letterSpacing: '0.12em', fontSize: 14 }}>
          NATL
        </Typography>
        <Divider orientation="vertical" flexItem sx={{ my: 1.5 }} />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {workspace?.title || 'Рабочая папка'}
        </Typography>

        <Box sx={{ flex: 1 }} />

        <Button
          size="small"
          variant="contained"
          startIcon={<FiberManualRecordIcon />}
          onClick={() => setRecordOpen(true)}
        >
          Записать
        </Button>
        <Tooltip title="Настройки ИИ">
          <IconButton size="small" onClick={() => setSettingsOpen(true)} aria-label="Настройки ИИ">
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {onToggleTheme && (
          <Tooltip title={themeMode === 'dark' ? 'Светлая тема' : 'Тёмная тема'}>
            <IconButton size="small" onClick={onToggleTheme} aria-label="Переключить тему">
              {themeMode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}
        {onCloseWorkspace && (
          <Tooltip title="Закрыть рабочую папку">
            <IconButton size="small" onClick={onCloseWorkspace} aria-label="Закрыть рабочую папку">
              <HomeIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Paper>

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Box
          sx={{
            width: 232,
            flexShrink: 0,
            borderRight: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            p: 1.5,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto',
          }}
        >
          <List dense disablePadding>
            {navItem(<DashboardIcon fontSize="small" />, 'Обзор', view === 'dashboard', () => setView('dashboard'))}
            {navItem(
              <AccountTreeIcon fontSize="small" />,
              'Сценарии',
              view === 'scenarios' || view === 'scenario',
              () => {
                setView('scenarios');
                setSelected(null);
              },
            )}
            {navItem(<AutoAwesomeIcon fontSize="small" />, 'ИИ-агент', view === 'ai', () => setView('ai'))}
            {navItem(<BugReportIcon fontSize="small" />, 'Журнал', view === 'logs', () => setView('logs'))}
          </List>

          <Box sx={{ flex: 1 }} />

          <Divider sx={{ my: 1 }} />
          <Button
            size="small"
            startIcon={<FolderOpenIcon />}
            onClick={async () => {
              if (!window.electronAPI || !onOpenFolder) return;
              const path = await window.electronAPI.openFolder();
              if (path) onOpenFolder(path);
            }}
            sx={{ justifyContent: 'flex-start', color: 'text.secondary', textTransform: 'none' }}
          >
            Открыть папку
          </Button>
          <Typography variant="caption" sx={{ color: 'text.secondary', px: 1, mt: 1, wordBreak: 'break-all' }}>
            {workspacePath}
          </Typography>
        </Box>

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {view === 'dashboard' && (
            <DashboardScreen
              workspacePath={workspacePath}
              onOpen={openScenario}
              onRecord={() => setRecordOpen(true)}
              onOpenAi={() => setView('ai')}
              onOpenList={() => setView('scenarios')}
            />
          )}
          {view === 'scenarios' && (
            <ScenariosListScreen
              onOpen={openScenario}
              onRecord={() => setRecordOpen(true)}
              refreshToken={refreshToken}
            />
          )}
          {view === 'scenario' && selected && (
            <ScenarioScreen
              relativePath={selected.relativePath}
              title={selected.title}
              workspacePath={workspacePath}
              onBack={() => {
                setView('scenarios');
                setSelected(null);
              }}
            />
          )}
          {view === 'ai' && <AiChatScreen onOpenSettings={() => setSettingsOpen(true)} />}
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
      <LlmSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </Box>
  );
}
