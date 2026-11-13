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
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import HomeIcon from '@mui/icons-material/Home';
import LightModeIcon from '@mui/icons-material/LightMode';
import SettingsIcon from '@mui/icons-material/Settings';
import LlmSettingsDialog from '../components/LlmSettingsDialog';
import RecordScenarioDialog from '../components/RecordScenarioDialog';
import LogsScreen from './LogsScreen';
import ScenarioScreen from './ScenarioScreen';
import ScenariosListScreen from './ScenariosListScreen';

/**
 * Оболочка рабочей папки.
 *
 * Экраны разделены: список сценариев, отдельный сценарий, журнал.
 * Боковую панель можно свернуть, чтобы отдать место редактору.
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
  const [view, setView] = useState('scenarios');
  const [selected, setSelected] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [recordOpen, setRecordOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const openScenario = (relativePath, title) => {
    setSelected({ relativePath, title });
    setView('scenario');
  };

  const navItem = (icon, label, active, onClick) => (
    <ListItemButton selected={active} onClick={onClick} sx={{ borderRadius: 1, mb: 0.25 }}>
      <ListItemIcon sx={{ minWidth: 32 }}>{icon}</ListItemIcon>
      {sidebarOpen && (
        <ListItemText primary={label} primaryTypographyProps={{ fontSize: 14 }} />
      )}
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
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {workspace?.title || workspacePath}
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
        <Paper
          square
          elevation={0}
          sx={{
            width: sidebarOpen ? 220 : 56,
            flexShrink: 0,
            borderRight: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            display: 'flex',
            flexDirection: 'column',
            p: 1,
            transition: 'width 120ms ease',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Tooltip title={sidebarOpen ? 'Свернуть' : 'Развернуть'}>
              <IconButton
                size="small"
                onClick={() => setSidebarOpen((prev) => !prev)}
                aria-label={sidebarOpen ? 'Свернуть панель' : 'Развернуть панель'}
              >
                {sidebarOpen ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>

          <List dense disablePadding>
            {navItem(<AccountTreeIcon fontSize="small" />, 'Сценарии', view === 'scenarios' || view === 'scenario', () => {
              setView('scenarios');
              setSelected(null);
            })}
            {navItem(<BugReportIcon fontSize="small" />, 'Журнал', view === 'logs', () => setView('logs'))}
          </List>

          <Box sx={{ flex: 1 }} />

          <Tooltip title="Открыть другую папку">
            <Button
              size="small"
              startIcon={sidebarOpen ? <FolderOpenIcon /> : undefined}
              onClick={async () => {
                if (!window.electronAPI || !onOpenFolder) return;
                const path = await window.electronAPI.openFolder();
                if (path) onOpenFolder(path);
              }}
              sx={{ justifyContent: 'flex-start', color: 'text.secondary', minWidth: 0 }}
            >
              {sidebarOpen ? 'Открыть папку' : <FolderOpenIcon fontSize="small" />}
            </Button>
          </Tooltip>
        </Paper>

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
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
              onOpenSettings={() => setSettingsOpen(true)}
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
      <LlmSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </Box>
  );
}
