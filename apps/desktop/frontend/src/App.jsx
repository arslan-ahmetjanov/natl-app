import { useState, useEffect, lazy, Suspense } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Box, CircularProgress, CssBaseline } from '@mui/material';
import WelcomeScreen from './screens/WelcomeScreen';

// WorkspaceView тянет CodeMirror; грузим его отдельно, чтобы вход открывался сразу.
const WorkspaceView = lazy(() => import('./screens/WorkspaceView'));

const THEME_STORAGE_KEY = 'natl-theme';

const sharedThemeComponents = {
  MuiButton: {
    styleOverrides: {
      root: {
        textTransform: 'none',
        fontWeight: 600,
        borderRadius: 10,
        boxShadow: 'none',
      },
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: {
        backgroundImage: 'none',
        borderRadius: 14,
        border: '1px solid var(--natl-border, rgba(148,163,184,.25))',
        boxShadow: 'none',
      },
    },
  },
  MuiListItemButton: {
    styleOverrides: {
      root: { borderRadius: 10 },
    },
  },
  MuiTab: {
    styleOverrides: {
      root: { textTransform: 'none', fontWeight: 500, minHeight: 38 },
    },
  },
  MuiTableCell: {
    styleOverrides: {
      root: { fontSize: 13, borderColor: 'inherit' },
      head: {
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        fontWeight: 600,
      },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: { borderRadius: 8, fontWeight: 500 },
    },
  },
  MuiTooltip: {
    styleOverrides: {
      tooltip: { fontSize: 12, borderRadius: 6 },
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: { borderRadius: 10 },
      input: { fontSize: 14 },
    },
  },
  MuiInputLabel: {
    styleOverrides: { root: { fontSize: 14 } },
  },
};

const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#0D9488', dark: '#0F766E', light: '#14B8A6' },
    secondary: { main: '#0F172A', dark: '#020617' },
    success: { main: '#0D9488', dark: '#0F766E' },
    warning: { main: '#B45309' },
    error: { main: '#BE123C' },
    background: { default: '#F1F5F9', paper: '#FFFFFF' },
    text: { primary: '#0F172A', secondary: '#64748B' },
    divider: '#E2E8F0',
  },
  typography: {
    fontFamily: '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif',
    h6: { fontWeight: 600, letterSpacing: '-0.01em' },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
  components: sharedThemeComponents,
});

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#14B8A6', dark: '#0D9488', light: '#2DD4BF' },
    secondary: { main: '#94A3B8', dark: '#64748B' },
    success: { main: '#14B8A6', dark: '#0D9488' },
    warning: { main: '#F59E0B' },
    error: { main: '#F43F5E' },
    background: { default: '#0F172A', paper: '#1E293B' },
    text: { primary: '#F1F5F9', secondary: '#94A3B8' },
    divider: '#334155',
  },
  typography: {
    fontFamily: '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif',
    h6: { fontWeight: 600, letterSpacing: '-0.01em' },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
  components: sharedThemeComponents,
});

function getInitialThemeMode() {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return 'light';
}

export default function App() {
  const [themeMode, setThemeMode] = useState(getInitialThemeMode);
  const [workspacePath, setWorkspacePath] = useState(null);
  const [workspace, setWorkspace] = useState(null);

  const isElectron = typeof window !== 'undefined' && window.electronAPI;
  const currentTheme = themeMode === 'dark' ? darkTheme : lightTheme;

  const handleToggleTheme = () => {
    setThemeMode((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
        if (document.documentElement) document.documentElement.setAttribute('data-theme', next);
      } catch {
        /* тема не критична */
      }
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
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCloseWorkspace = async () => {
    await window.electronAPI.closeWorkspace();
    setWorkspacePath(null);
  };

  if (!isElectron) {
    return (
      <ThemeProvider theme={currentTheme}>
        <CssBaseline />
        <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
          Приложение работает только внутри Electron: запустите `npm start`.
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={currentTheme}>
      <CssBaseline />
      {!workspacePath ? (
        <WelcomeScreen
          onOpen={handleOpenFolder}
          themeMode={themeMode}
          onToggleTheme={handleToggleTheme}
        />
      ) : (
        <Suspense
          fallback={(
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
              <CircularProgress />
            </Box>
          )}
        >
          <WorkspaceView
            workspacePath={workspacePath}
            workspace={workspace}
            themeMode={themeMode}
            onToggleTheme={handleToggleTheme}
            onRefresh={() => window.electronAPI.getWorkspaceMeta().then(setWorkspace)}
            onOpenFolder={handleOpenFolder}
            onCloseWorkspace={handleCloseWorkspace}
          />
        </Suspense>
      )}
    </ThemeProvider>
  );
}
