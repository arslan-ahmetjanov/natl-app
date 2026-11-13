import { useState, useEffect, lazy, Suspense } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Box, CircularProgress, CssBaseline } from '@mui/material';
import MainLayout from './components/MainLayout';
import WindowTitleBar from './components/WindowTitleBar';
import WelcomeHeader from './screens/WelcomeHeader';
import WelcomeSidebar from './screens/WelcomeSidebar';
import WelcomeOverview from './screens/WelcomeOverview';

// WorkspaceView pulls curlconverter + web-tree-sitter (WASM). Loading it on the welcome
// route prevented React from mounting when that graph failed or stalled in Electron.
const WorkspaceView = lazy(() => import('./screens/WorkspaceView'));

const THEME_STORAGE_KEY = 'testblox-theme';

const sharedThemeComponents = {
  MuiButton: {
    styleOverrides: {
      root: { textTransform: 'none' },
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: {
        backgroundImage: 'none',
      },
    },
  },
  MuiListItemButton: {
    styleOverrides: {
      root: {
        borderRadius: 8,
      },
    },
  },
};

const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1565c0', dark: '#0d47a1' },
    secondary: { main: '#1565c0', dark: '#0d47a1' },
    success: { main: '#2e7d32', dark: '#1b5e20' },
    warning: { main: '#e65100' },
    error: { main: '#c62828' },
    background: { default: '#ffffff', paper: '#f5f5f5' },
    text: { primary: '#000000', secondary: '#616161' },
    divider: '#e0e0e0',
  },
  typography: {
    fontFamily: '"Golos Text", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  shape: {
    borderRadius: 8,
  },
  components: sharedThemeComponents,
});

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#42a5f5', dark: '#1e88e5' },
    secondary: { main: '#42a5f5', dark: '#1e88e5' },
    success: { main: '#4caf50', dark: '#388e3c' },
    warning: { main: '#ff9800' },
    error: { main: '#ef5350' },
    background: { default: '#0a0a0a', paper: '#141414' },
    text: { primary: '#ffffff', secondary: '#9e9e9e' },
    divider: '#333333',
  },
  typography: {
    fontFamily: '"Golos Text", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  shape: {
    borderRadius: 8,
  },
  components: sharedThemeComponents,
});

function getInitialThemeMode() {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
  return 'dark';
}

export default function App() {
  const [themeMode, setThemeMode] = useState(getInitialThemeMode);
  const [workspacePath, setWorkspacePath] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [pages, setPages] = useState([]);
  const [openCloneDialog, setOpenCloneDialog] = useState(false);
  const [openCreateProjectDialog, setOpenCreateProjectDialog] = useState(false);

  const isElectron = typeof window !== 'undefined' && window.electronAPI;

  const currentTheme = themeMode === 'dark' ? darkTheme : lightTheme;

  const handleToggleTheme = () => {
    setThemeMode((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
        if (document.documentElement) document.documentElement.setAttribute('data-theme', next);
      } catch (_) {}
      return next;
    });
  };

  useEffect(() => {
    if (document.documentElement) document.documentElement.setAttribute('data-theme', themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (!isElectron) return;
    window.electronAPI.getWorkspacePath().then((path) => {
      if (path) {
        setWorkspacePath(path);
        window.electronAPI.getWorkspaceMeta().then(setWorkspace).catch(() => setWorkspace(null));
        window.electronAPI.listPages().then(setPages).catch(() => setPages([]));
      }
    });
  }, [isElectron]);

  const handleOpenFolder = async (path) => {
    if (!isElectron || !path) return;
    try {
      const result = await window.electronAPI.openFolderAndLoad(path);
      if (result) {
        setWorkspacePath(result.path);
        setWorkspace(result.workspace);
        setPages(result.pages || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCloneSuccess = async (path) => {
    if (!isElectron || !path) return;
    try {
      const result = await window.electronAPI.openFolderAndLoad(path);
      if (result) {
        setWorkspacePath(result.path);
        setWorkspace(result.workspace);
        setPages(result.pages || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!isElectron) {
    return (
      <ThemeProvider theme={currentTheme}>
        <CssBaseline />
        <div style={{ padding: 24, textAlign: 'center' }}>
          <h1>TestBlox</h1>
          <p>Run this app inside Electron (npm start from TestBlox).</p>
        </div>
      </ThemeProvider>
    );
  }

  if (!workspacePath) {
    return (
      <ThemeProvider theme={currentTheme}>
        <CssBaseline />
        <MainLayout
          topBar={<WindowTitleBar />}
          header={<WelcomeHeader themeMode={themeMode} onToggleTheme={handleToggleTheme} />}
          sidebar={
            <WelcomeSidebar
              onOpenFolder={async () => {
                const path = await window.electronAPI?.openFolder();
                if (path) handleOpenFolder(path);
              }}
              onCloneClick={() => setOpenCloneDialog(true)}
              onCreateProjectClick={() => setOpenCreateProjectDialog(true)}
            />
          }
          content={
            <WelcomeOverview
              onOpenFolder={handleOpenFolder}
              onCloneSuccess={handleCloneSuccess}
              openCloneDialog={openCloneDialog}
              onOpenCloneDialog={() => setOpenCloneDialog(true)}
              onCloseCloneDialog={() => setOpenCloneDialog(false)}
              openCreateProjectDialog={openCreateProjectDialog}
              onOpenCreateProjectDialog={() => setOpenCreateProjectDialog(true)}
              onCloseCreateProjectDialog={() => setOpenCreateProjectDialog(false)}
            />
          }
        />
      </ThemeProvider>
    );
  }

  const handleCloseWorkspace = async () => {
    if (!isElectron) return;
    await window.electronAPI.closeWorkspace();
    setWorkspacePath(null);
  };

  return (
    <ThemeProvider theme={currentTheme}>
      <CssBaseline />
      <Suspense
        fallback={
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '100vh',
              bgcolor: 'background.default',
            }}
          >
            <CircularProgress />
          </Box>
        }
      >
        <WorkspaceView
          workspacePath={workspacePath}
          workspace={workspace}
          pages={pages}
          themeMode={themeMode}
          onToggleTheme={handleToggleTheme}
          onRefresh={() => {
            window.electronAPI.getWorkspaceMeta().then(setWorkspace);
            window.electronAPI.listPages().then(setPages);
          }}
          onOpenFolder={handleOpenFolder}
          onCloseWorkspace={handleCloseWorkspace}
        />
      </Suspense>
    </ThemeProvider>
  );
}
