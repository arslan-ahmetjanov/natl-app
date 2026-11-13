import { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import { Button, TextField, Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemButton, Divider, Paper } from '@mui/material';
import SectionLabel from '../components/SectionLabel';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import GitHubIcon from '@mui/icons-material/GitHub';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import FolderIcon from '@mui/icons-material/Folder';
import FileUploadIcon from '@mui/icons-material/FileUpload';

export default function WelcomeOverview({
  onOpenFolder,
  onCloneSuccess,
  openCloneDialog: openCloneDialogProp,
  onOpenCloneDialog,
  onCloseCloneDialog,
  openCreateProjectDialog: openCreateProjectDialogProp,
  onOpenCreateProjectDialog,
  onCloseCreateProjectDialog,
}) {
  const theme = useTheme();
  const [cloneUrl, setCloneUrl] = useState('');
  const [clonePath, setClonePath] = useState('');
  const [cloneProgress, setCloneProgress] = useState('');
  const [cloneLoading, setCloneLoading] = useState(false);
  const [cloneError, setCloneError] = useState('');
  const [createProjectOpenInternal, setCreateProjectOpenInternal] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectParentPath, setProjectParentPath] = useState('');
  const [createProjectLoading, setCreateProjectLoading] = useState(false);
  const [createProjectError, setCreateProjectError] = useState('');
  const [cloneDialogOpenInternal, setCloneDialogOpenInternal] = useState(false);
  const [recentWorkspaces, setRecentWorkspaces] = useState([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importZipPath, setImportZipPath] = useState('');
  const [importTargetPath, setImportTargetPath] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');

  useEffect(() => {
    if (window.electronAPI?.getLastOpenedWorkspaces) {
      window.electronAPI.getLastOpenedWorkspaces().then(setRecentWorkspaces).catch(() => setRecentWorkspaces([]));
    }
  }, []);

  const cloneDialogOpen = openCloneDialogProp ?? cloneDialogOpenInternal;
  const setCloneDialogOpen = (v) => { if (onCloseCloneDialog && !v) onCloseCloneDialog(); setCloneDialogOpenInternal(v); };
  const createProjectOpen = openCreateProjectDialogProp ?? createProjectOpenInternal;
  const setCreateProjectOpen = (v) => { if (onCloseCreateProjectDialog && !v) onCloseCreateProjectDialog(); setCreateProjectOpenInternal(v); };

  const handleOpen = async () => {
    const path = await window.electronAPI.openFolder();
    if (path) onOpenFolder(path);
  };

  const handleCreateProjectChooseFolder = async () => {
    const path = await window.electronAPI.openFolder();
    if (path) setProjectParentPath(path);
  };

  const handleCreateProjectSubmit = async () => {
    const name = projectName.trim() || 'My Project';
    if (!projectParentPath.trim()) {
      setCreateProjectError('Choose parent folder');
      return;
    }
    setCreateProjectError('');
    setCreateProjectLoading(true);
    try {
      const path = await window.electronAPI.createProject(projectParentPath.trim(), name);
      if (path) {
        setCreateProjectOpen(false);
        setProjectName('');
        setProjectParentPath('');
        onOpenFolder(path);
      }
    } catch (e) {
      setCreateProjectError(e.message || 'Failed to create project');
    } finally {
      setCreateProjectLoading(false);
    }
  };

  const handleClone = async () => {
    if (!cloneUrl.trim()) {
      setCloneError('Enter repository URL');
      return;
    }
    let targetPath = clonePath.trim();
    if (!targetPath) {
      const folder = await window.electronAPI.openFolder();
      if (!folder) return;
      targetPath = folder;
    }
    const repoName = await window.electronAPI.getRepoNameFromUrl(cloneUrl);
    const fullPath = `${targetPath.replace(/\\/g, '/').replace(/\/$/, '')}/${repoName}`;

    setCloneError('');
    setCloneLoading(true);
    setCloneProgress('Cloning...');
    const processUid = `clone-${Date.now()}`;
    const unsub = window.electronAPI.onGitProgress((e) => setCloneProgress(e.data || 'Cloning...'));

    try {
      await window.electronAPI.gitClone({
        url: cloneUrl.trim(),
        targetPath: fullPath,
        processUid,
      });
      onCloneSuccess(fullPath);
      setCloneDialogOpen(false);
      setCloneUrl('');
      setClonePath('');
    } catch (e) {
      setCloneError(e.message || 'Clone failed');
    } finally {
      unsub();
      setCloneLoading(false);
      setCloneProgress('');
    }
  };

  return (
    <Box
      sx={{
        flex: 1,
        overflow: 'auto',
        background: theme.palette.background.default,
        p: 2,
      }}
    >
      <SectionLabel sx={{ mb: 1 }}>Quick actions</SectionLabel>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          startIcon={<FolderOpenIcon />}
          onClick={handleOpen}
          sx={{
            bgcolor: theme.palette.primary.main,
            color: '#fff',
            '&:hover': { bgcolor: theme.palette.primary.dark },
          }}
        >
          Open folder
        </Button>
        <Button
          variant="outlined"
          startIcon={<GitHubIcon />}
          onClick={() => {
            if (onOpenCloneDialog) onOpenCloneDialog();
            else setCloneDialogOpen(true);
          }}
          sx={{
            borderColor: theme.palette.primary.main,
            color: theme.palette.primary.main,
            '&:hover': { borderColor: theme.palette.primary.main, bgcolor: 'action.hover' },
          }}
        >
          Clone repository
        </Button>
        <Button
          variant="outlined"
          startIcon={<CreateNewFolderIcon />}
          onClick={() => {
            if (onOpenCreateProjectDialog) onOpenCreateProjectDialog();
            else setCreateProjectOpen(true);
          }}
          sx={{
            borderColor: theme.palette.primary.main,
            color: theme.palette.primary.main,
            '&:hover': { borderColor: theme.palette.primary.main, bgcolor: 'action.hover' },
          }}
        >
          Create new project
        </Button>
        <Button
          variant="outlined"
          startIcon={<FileUploadIcon />}
          onClick={() => { setImportError(''); setImportZipPath(''); setImportTargetPath(''); setImportDialogOpen(true); }}
          sx={{
            borderColor: theme.palette.primary.main,
            color: theme.palette.primary.main,
            '&:hover': { borderColor: theme.palette.primary.main, bgcolor: 'action.hover' },
          }}
        >
          Import from ZIP
        </Button>
      </Box>

      <Divider sx={{ my: 3, borderColor: 'divider' }} />

      <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem', mb: 2 }}>
        Open an existing workspace folder, clone a Git repository, or create a new project to get started.
      </Typography>

      {recentWorkspaces.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            maxWidth: 520,
            borderColor: 'divider',
            bgcolor: 'action.hover',
          }}
        >
          <Typography variant="subtitle2" sx={{ color: 'text.primary', mb: 0.5 }}>
            No recent workspaces yet
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Use <strong>Open folder</strong> in the sidebar or <strong>Create new project</strong> above. Recent folders will appear here for quick access.
          </Typography>
        </Paper>
      ) : (
        <>
          <Divider sx={{ my: 3, borderColor: 'divider' }} />
          <SectionLabel sx={{ mb: 1 }}>Recent workspaces</SectionLabel>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
            Jump back into a folder you opened before:
          </Typography>
          <List dense sx={{ maxWidth: 480 }}>
            {recentWorkspaces.map((workspacePath) => {
              const label = workspacePath.split(/[/\\]/).filter(Boolean).pop() || workspacePath;
              return (
                <ListItem key={workspacePath} disablePadding>
                  <ListItemButton
                    onClick={() => onOpenFolder(workspacePath)}
                    sx={{ color: theme.palette.primary.main, borderRadius: 1 }}
                  >
                    <FolderIcon sx={{ mr: 1, fontSize: 20 }} />
                    <Typography variant="body2" noWrap sx={{ flex: 1 }} title={workspacePath}>
                      {label}
                    </Typography>
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </>
      )}

      <Dialog
        open={createProjectOpen}
        onClose={() => !createProjectLoading && setCreateProjectOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' } }}
      >
        <DialogTitle sx={{ color: 'text.primary' }}>Create new project</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Project name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="My Project"
            sx={{ mt: 1, mb: 2, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
          />
          <TextField
            fullWidth
            label="Parent folder"
            value={projectParentPath}
            readOnly
            placeholder="Choose folder"
            sx={{ mb: 1, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
          />
          <Button size="small" onClick={handleCreateProjectChooseFolder} sx={{ color: theme.palette.primary.main }}>
            Choose parent folder
          </Button>
          {createProjectError && (
            <Typography variant="body2" sx={{ color: 'error.main', mt: 2 }}>{createProjectError}</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateProjectOpen(false)} disabled={createProjectLoading} sx={{ color: theme.palette.text.secondary }}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateProjectSubmit}
            disabled={createProjectLoading || !projectParentPath.trim()}
            variant="contained"
            sx={{ bgcolor: theme.palette.primary.main, '&:hover': { bgcolor: theme.palette.primary.main } }}
          >
            {createProjectLoading ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={importDialogOpen} onClose={() => !importLoading && setImportDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' } }}>
        <DialogTitle sx={{ color: 'text.primary' }}>Import workspace from ZIP</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="ZIP file" value={importZipPath} readOnly placeholder="Select ZIP file" sx={{ mt: 1, mb: 1, '& .MuiOutlinedInput-root': { color: 'text.primary' } }} />
          <Button size="small" onClick={async () => { const p = await window.electronAPI?.openZip(); if (p) setImportZipPath(p); }} sx={{ color: theme.palette.primary.main, mb: 2 }}>Select ZIP file</Button>
          <TextField fullWidth label="Destination folder" value={importTargetPath} readOnly placeholder="Choose folder" sx={{ mb: 1, '& .MuiOutlinedInput-root': { color: 'text.primary' } }} />
          <Button size="small" onClick={async () => { const p = await window.electronAPI?.openFolder(); if (p) setImportTargetPath(p); }} sx={{ color: theme.palette.primary.main }}>Choose folder</Button>
          {importError && <Typography variant="body2" sx={{ color: 'error.main', mt: 2 }}>{importError}</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)} disabled={importLoading} sx={{ color: theme.palette.text.secondary }}>Cancel</Button>
          <Button
            onClick={async () => {
              if (!importZipPath || !importTargetPath) { setImportError('Select ZIP file and destination folder'); return; }
              setImportError('');
              setImportLoading(true);
              try {
                const result = await window.electronAPI.workspaceImportZip(importZipPath, importTargetPath);
                setImportDialogOpen(false);
                if (result?.path) onOpenFolder(result.path);
              } catch (e) {
                setImportError(e.message || 'Import failed');
              } finally {
                setImportLoading(false);
              }
            }}
            disabled={importLoading || !importZipPath || !importTargetPath}
            variant="contained"
            sx={{ bgcolor: theme.palette.primary.main, '&:hover': { bgcolor: theme.palette.primary.main } }}
          >
            {importLoading ? 'Importing…' : 'Import'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={cloneDialogOpen}
        onClose={() => !cloneLoading && setCloneDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' } }}
      >
        <DialogTitle sx={{ color: 'text.primary' }}>Clone repository</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder="https://github.com/owner/repo"
            label="Repository URL"
            value={cloneUrl}
            onChange={(e) => setCloneUrl(e.target.value)}
            sx={{ mt: 1, mb: 1.5, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
          />
          <TextField
            fullWidth
            size="small"
            placeholder="Clone to (optional – pick folder)"
            label="Target folder"
            value={clonePath}
            onChange={(e) => setClonePath(e.target.value)}
            sx={{ mb: 1, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
          />
          {cloneProgress && (
            <Typography variant="caption" sx={{ color: theme.palette.primary.main, display: 'block', mb: 1 }}>
              {cloneProgress}
            </Typography>
          )}
          {cloneError && (
            <Typography variant="caption" sx={{ color: 'error.main', display: 'block', mb: 1 }}>
              {cloneError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloneDialogOpen(false)} disabled={cloneLoading} sx={{ color: theme.palette.text.secondary }}>
            Cancel
          </Button>
          <Button
            onClick={handleClone}
            disabled={cloneLoading || !cloneUrl.trim()}
            variant="contained"
            sx={{ bgcolor: theme.palette.primary.main, '&:hover': { bgcolor: theme.palette.primary.main } }}
          >
            {cloneLoading ? 'Cloning...' : 'Clone'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
