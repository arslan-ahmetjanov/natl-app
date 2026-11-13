import { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Box, CircularProgress, CssBaseline } from '@mui/material';
import WelcomeScreen from './screens/WelcomeScreen';
import { DEFAULT_BRAND, paletteFor } from './themes';

// WorkspaceView тянет CodeMirror; грузим его отдельно, чтобы вход открывался сразу.
const WorkspaceView = lazy(() => import('./screens/WorkspaceView'));

const THEME_STORAGE_KEY = 'natl-theme';
const BRAND_STORAGE_KEY = 'natl-brand';

function brandComponents(palette) {
  const radius = palette.radius;
  return {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: Math.max(radius, 2),
          boxShadow: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: typeof radius === 'number' ? radius * 1.6 + 4 : 10,
          boxShadow: 'none',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: { root: { borderRadius: Math.max(radius, 2) } },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: palette.uppercaseLabels ? 'uppercase' : 'none',
          letterSpacing: palette.uppercaseLabels ? '0.08em' : '0',
          fontSize: 12,
          fontWeight: 600,
          minHeight: 38,
        },
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
      styleOverrides: { root: { borderRadius: Math.max(radius, 2), fontWeight: 500 } },
    },
    MuiTooltip: {
      styleOverrides: { tooltip: { fontSize: 12, borderRadius: Math.max(radius, 2) } },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: Math.max(radius + 2, 4) },
        input: { fontSize: 14 },
      },
    },
    MuiInputLabel: {
      styleOverrides: { root: { fontSize: 14 } },
    },
  };
}

function createNatlTheme(brandId, mode) {
  const palette = paletteFor(brandId, mode);
  return createTheme({
    palette: {
      mode,
      primary: { main: palette.primary, dark: palette.primaryDark },
      secondary: { main: palette.secondary },
      success: { main: palette.success },
      warning: { main: palette.warning },
      error: { main: palette.error },
      background: { default: palette.bg, paper: palette.paper },
      text: { primary: palette.text, secondary: palette.muted },
      divider: palette.divider,
    },
    typography: {
      fontFamily: palette.body,
      h4: { fontFamily: palette.heading, fontWeight: 600 },
      h5: { fontFamily: palette.heading, fontWeight: 600 },
      h6: { fontFamily: palette.heading, fontWeight: 600 },
      subtitle1: { fontWeight: 600, fontFamily: palette.heading },
      subtitle2: { fontWeight: 600, fontFamily: palette.heading },
    },
    shape: { borderRadius: palette.radius },
    components: brandComponents(palette),
  });
}

function getInitialThemeMode() {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return 'dark';
}

function getInitialBrand() {
  if (typeof window === 'undefined') return DEFAULT_BRAND;
  const stored = localStorage.getItem(BRAND_STORAGE_KEY);
  return stored || DEFAULT_BRAND;
}

export default function App() {
  const [themeMode, setThemeMode] = useState(getInitialThemeMode);
  const [brand, setBrand] = useState(getInitialBrand);
  const [workspacePath, setWorkspacePath] = useState(null);
  const [workspace, setWorkspace] = useState(null);

  const isElectron = typeof window !== 'undefined' && window.electronAPI;
  const theme = useMemo(() => createNatlTheme(brand, themeMode), [brand, themeMode]);

  const handleToggleTheme = () => {
    setThemeMode((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        /* тема не критична */
      }
      return next;
    });
  };

  const handleBrandChange = (next) => {
    setBrand(next);
    try {
      localStorage.setItem(BRAND_STORAGE_KEY, next);
    } catch {
      /* бренд не критичен */
    }
  };

  useEffect(() => {
    if (document.documentElement) {
      document.documentElement.setAttribute('data-theme', themeMode);
      document.documentElement.setAttribute('data-brand', brand);
    }
  }, [themeMode, brand]);

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
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <div style={{ padding: 24 }}>
          Приложение работает только внутри Electron: запустите `npm start`.
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {!workspacePath ? (
        <WelcomeScreen
          onOpen={handleOpenFolder}
          themeMode={themeMode}
          onToggleTheme={handleToggleTheme}
          brand={brand}
          onBrandChange={handleBrandChange}
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
            brand={brand}
            onBrandChange={handleBrandChange}
            onRefresh={() => window.electronAPI.getWorkspaceMeta().then(setWorkspace)}
            onOpenFolder={handleOpenFolder}
            onCloseWorkspace={handleCloseWorkspace}
          />
        </Suspense>
      )}
    </ThemeProvider>
  );
}
