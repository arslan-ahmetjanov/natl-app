import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import GitHubIcon from '@mui/icons-material/GitHub';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import FolderIcon from '@mui/icons-material/Folder';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import WindowControls from '../components/WindowControls';

/** Экран входа: одно окно, три действия, недавние папки. */
export default function WelcomeScreen({ onOpen, themeMode, onToggleTheme }) {
  const [recent, setRecent] = useState([]);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const [cloneUrl, setCloneUrl] = useState('');
  const [cloneProgress, setCloneProgress] = useState('');
  const [cloneBusy, setCloneBusy] = useState(false);
  const [cloneError, setCloneError] = useState('');

  const [projectName, setProjectName] = useState('');
  const [projectParent, setProjectParent] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState('');
  const api = window.electronAPI;

  useEffect(() => {
    api?.getLastOpenedWorkspaces?.().then(setRecent).catch(() => setRecent([]));
  }, [api]);

  const openFolder = async () => {
    const path = await api.openFolder();
    if (path) onOpen(path);
  };

  const clone = async () => {
    if (!cloneUrl.trim()) {
      setCloneError('Введите адрес репозитория');
      return;
    }
    const parent = await api.openFolder();
    if (!parent) return;

    setCloneBusy(true);
    setCloneError('');
    setCloneProgress('Клонирование…');
    const repoName = await api.getRepoNameFromUrl(cloneUrl);
    const target = `${String(parent).replace(/\\/g, '/').replace(/\/$/, '')}/${repoName}`;
    const unsubscribe = api.onGitProgress((event) => setCloneProgress(event.data || 'Клонирование…'));

    try {
      await api.gitClone({ url: cloneUrl.trim(), targetPath: target, processUid: `clone-${Date.now()}` });
      setCloneOpen(false);
      setCloneUrl('');
      onOpen(target);
    } catch (err) {
      setCloneError(err.message || 'Не удалось клонировать');
    } finally {
      unsubscribe();
      setCloneBusy(false);
      setCloneProgress('');
    }
  };

  const create = async () => {
    if (!projectParent.trim()) {
      setCreateError('Выберите папку');
      return;
    }
    setCreateBusy(true);
    setCreateError('');
    try {
      const path = await api.createProject(projectParent.trim(), projectName.trim() || 'Project');
      if (path) {
        setCreateOpen(false);
        setProjectName('');
        setProjectParent('');
        onOpen(path);
      }
    } catch (err) {
      setCreateError(err.message || 'Не удалось создать проект');
    } finally {
      setCreateBusy(false);
    }
  };

  const importZip = async () => {
    const zip = await api.openZip();
    if (!zip) return;
    const parent = await api.openFolder();
    if (!parent) return;
    try {
      const result = await api.workspaceImportZip(zip, parent);
      const path = typeof result === 'string' ? result : result?.path;
      if (path) onOpen(path);
    } catch {
      /* ошибка видна в журнале */
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.default' }}>
      <WindowControls
        title="NATL"
        right={(
          <Tooltip title={themeMode === 'dark' ? 'Светлая тема' : 'Тёмная тема'}>
            <Box component="span">
              <Button
                size="small"
                onClick={onToggleTheme}
                startIcon={themeMode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
                sx={{ color: 'text.secondary' }}
              >
                {themeMode === 'dark' ? 'Светлая' : 'Тёмная'}
              </Button>
            </Box>
          </Tooltip>
        )}
      />

      <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', px: 2, py: 6 }}>
        <Box sx={{ width: '100%', maxWidth: 760 }}>
          <Typography sx={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, letterSpacing: '0.14em', color: 'primary.main' }}>
            NATL
          </Typography>
          <Typography variant="h4" sx={{ mt: 1.5, mb: 1, maxWidth: 620 }}>
            Проверяйте поведение приложения, а не код
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4, maxWidth: 620 }}>
            Запишите путь руками — получите YAML-тест в своём репозитории.
            Откройте папку проекта или начните с новой.
          </Typography>

          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 5 }}>
            <Button variant="contained" size="large" startIcon={<FolderOpenIcon />} onClick={openFolder}>
              Открыть папку
            </Button>
            <Button variant="outlined" size="large" startIcon={<GitHubIcon />} onClick={() => setCloneOpen(true)}>
              Клонировать репозиторий
            </Button>
            <Button variant="outlined" size="large" startIcon={<CreateNewFolderIcon />} onClick={() => setCreateOpen(true)}>
              Создать проект
            </Button>
            <Button variant="text" size="large" startIcon={<FileUploadIcon />} onClick={importZip}>
              Из архива
            </Button>
          </Box>

          <Paper sx={{ p: 0, overflow: 'hidden' }}>
            <Box sx={{ px: 2.5, py: 1.5 }}>
              <Typography variant="subtitle1">Недавние папки</Typography>
            </Box>
            <Divider />
            {recent.length === 0 ? (
              <Box sx={{ px: 2.5, py: 2 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Здесь появятся папки, которые вы открывали.
                </Typography>
              </Box>
            ) : (
              <List dense>
                {recent.map((item) => {
                  const path = typeof item === 'string' ? item : item.path;
                  return (
                    <ListItemButton key={path} onClick={() => onOpen(path)}>
                      <ListItemIcon sx={{ minWidth: 32 }}><FolderIcon fontSize="small" /></ListItemIcon>
                      <ListItemText
                        primary={String(path).split(/[\\/]/).pop()}
                        secondary={path}
                        slotProps={{ secondary: { noWrap: true, sx: { fontSize: 11 } } }}
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            )}
          </Paper>
        </Box>
      </Box>

      <Dialog open={cloneOpen} onClose={() => setCloneOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Клонировать репозиторий</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Адрес репозитория"
            placeholder="https://github.com/user/project.git"
            value={cloneUrl}
            onChange={(event) => setCloneUrl(event.target.value)}
            sx={{ mt: 1 }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
            После подтверждения выберите папку, куда клонировать.
          </Typography>
          {cloneProgress && <Alert severity="info" sx={{ mt: 2 }}>{cloneProgress}</Alert>}
          {cloneError && <Alert severity="error" sx={{ mt: 2 }}>{cloneError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloneOpen(false)} sx={{ color: 'text.secondary' }}>Отмена</Button>
          <Button variant="contained" onClick={clone} disabled={cloneBusy}>
            {cloneBusy ? 'Клонирование…' : 'Клонировать'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Создать проект</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            size="small"
            label="Название"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            sx={{ mt: 1, mb: 2 }}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              size="small"
              label="Папка"
              value={projectParent}
              onChange={(event) => setProjectParent(event.target.value)}
            />
            <Button
              variant="outlined"
              onClick={async () => {
                const path = await api.openFolder();
                if (path) setProjectParent(path);
              }}
            >
              Выбрать
            </Button>
          </Box>
          {createError && <Alert severity="error" sx={{ mt: 2 }}>{createError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} sx={{ color: 'text.secondary' }}>Отмена</Button>
          <Button variant="contained" onClick={create} disabled={createBusy}>
            {createBusy ? 'Создание…' : 'Создать'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
