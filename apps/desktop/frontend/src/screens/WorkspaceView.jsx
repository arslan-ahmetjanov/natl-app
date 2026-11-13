import { useEffect, useState } from 'react';import {
  Box,
  Button,
  Divider,
  Fade,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
} from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import BugReportIcon from '@mui/icons-material/BugReport';
import DataObjectIcon from '@mui/icons-material/DataObject';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import DashboardIcon from '@mui/icons-material/SpaceDashboard';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import HomeIcon from '@mui/icons-material/Home';
import LightModeIcon from '@mui/icons-material/LightMode';
import SettingsIcon from '@mui/icons-material/Settings';
import LlmSettingsDialog from '../components/LlmSettingsDialog';
import OnboardingDialog from '../components/OnboardingDialog';
import RecordScenarioDialog from '../components/RecordScenarioDialog';
import WindowControls from '../components/WindowControls';
import AiChatScreen from './AiChatScreen';
import DashboardScreen from './DashboardScreen';
import LogsScreen from './LogsScreen';
import ScenarioScreen from './ScenarioScreen';
import ScenariosListScreen from './ScenariosListScreen';
import ResourcesScreen from './ResourcesScreen';

const NAV = [
  { id: 'dashboard', label: 'Обзор', icon: <DashboardIcon fontSize="small" /> },
  { id: 'scenarios', label: 'Сценарии', icon: <AccountTreeIcon fontSize="small" /> },
  { id: 'resources', label: 'Окружение', icon: <DataObjectIcon fontSize="small" /> },
  { id: 'logs', label: 'Журнал', icon: <BugReportIcon fontSize="small" /> },
];

/**
 * Рабочее место: одна шапка, схлопываемое меню слева и чат справа.
 * Оба края убираются, чтобы отдать место файлу.
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
  const [navOpen, setNavOpen] = useState(true);
  const [aiOpen, setAiOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [appInfo, setAppInfo] = useState(null);

  useEffect(() => {
    window.electronAPI?.getAppInfo?.().then(setAppInfo).catch(() => setAppInfo(null));
  }, []);

  const openScenario = (relativePath, title) => {
    setSelected({ relativePath, title });
    setView('scenario');
  };

  const navItem = (item) => (
    <ListItemButton
      key={item.id}
      selected={view === item.id || (item.id === 'scenarios' && view === 'scenario')}
      onClick={() => {
        setView(item.id);
        if (item.id !== 'scenario') setSelected(null);
      }}
      sx={{
        borderRadius: 2,
        mb: 0.5,
        px: navOpen ? 1.25 : 1,
        py: 1,
        justifyContent: navOpen ? 'flex-start' : 'center',
        '&.Mui-selected': {
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          '& .MuiListItemIcon-root': { color: 'primary.contrastText' },
          '&:hover': { bgcolor: 'primary.dark' },
        },
      }}
    >
      <ListItemIcon sx={{ minWidth: navOpen ? 32 : 0, color: 'text.secondary', justifyContent: 'center' }}>
        {item.icon}
      </ListItemIcon>
      {navOpen && (
        <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }} />
      )}
    </ListItemButton>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.default' }}>
      <WindowControls
        title="NATL IDE"
        subtitle={workspace?.title || workspacePath}
        right={(
          <>
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
          </>
        )}
      />

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Box
          sx={{
            width: navOpen ? 220 : 64,
            flexShrink: 0,
            borderRight: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            display: 'flex',
            flexDirection: 'column',
            p: 1,
            transition: 'width 140ms ease',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: navOpen ? 'flex-end' : 'center', mb: 0.5 }}>
            <Tooltip title={navOpen ? 'Свернуть меню' : 'Развернуть меню'}>
              <IconButton
                size="small"
                onClick={() => setNavOpen((prev) => !prev)}
                aria-label={navOpen ? 'Свернуть меню' : 'Развернуть меню'}
              >
                {navOpen ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>

          <List dense disablePadding>
            {NAV.map(navItem)}
          </List>

          <Box sx={{ flex: 1 }} />

          <Divider sx={{ my: 1 }} />
          <Tooltip title="Открыть другую папку" placement="right">
            <IconButton
              size="small"
              onClick={async () => {
                if (!window.electronAPI || !onOpenFolder) return;
                const path = await window.electronAPI.openFolder();
                if (path) onOpenFolder(path);
              }}
              aria-label="Открыть папку"
              sx={{ alignSelf: navOpen ? 'flex-start' : 'center', ml: navOpen ? 0.5 : 0 }}
            >
              <FolderOpenIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {navOpen && (
            <Box sx={{ px: 0.5, pt: 0.5 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 10, display: 'block' }}>
                {appInfo ? `${appInfo.version} · ${appInfo.channel}` : ''}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 10, wordBreak: 'break-all' }}>
                {workspacePath}
              </Typography>
            </Box>
          )}
        </Box>

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Fade in key={view} timeout={180}>
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {view === 'dashboard' && (
                <DashboardScreen
                  workspacePath={workspacePath}
                  onOpen={openScenario}
                  onRecord={() => setRecordOpen(true)}
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
                  onRenamed={(nextPath, nextTitle) => {
                    setSelected({ relativePath: nextPath, title: nextTitle });
                    setRefreshToken((value) => value + 1);
                  }}
                />
              )}
              {view === 'logs' && <LogsScreen />}
              {view === 'resources' && (
                <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
                  <ResourcesScreen />
                </Box>
              )}
            </Box>
          </Fade>
        </Box>

        <Box
          sx={{
            width: aiOpen ? 380 : 56,
            flexShrink: 0,
            borderLeft: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            display: 'flex',
            flexDirection: 'column',
            transition: 'width 140ms ease',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: aiOpen ? 'flex-end' : 'center', p: 0.5 }}>
            <Tooltip title={aiOpen ? 'Свернуть чат' : 'Открыть ИИ-агента'} placement="left">
              <IconButton
                size="small"
                onClick={() => setAiOpen((prev) => !prev)}
                aria-label={aiOpen ? 'Свернуть чат' : 'Открыть ИИ-агента'}
              >
                {aiOpen ? <ChevronRightIcon fontSize="small" /> : <AutoAwesomeIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>
          {aiOpen && (
            <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
              <AiChatScreen onOpenSettings={() => setSettingsOpen(true)} />
            </Box>
          )}
          {!aiOpen && (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography
                variant="caption"
                sx={{
                  writingMode: 'vertical-rl',
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  letterSpacing: '0.16em',
                }}
              >
                ИИ-агент
              </Typography>
            </Box>
          )}
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
      <OnboardingDialog />
    </Box>
  );
}
