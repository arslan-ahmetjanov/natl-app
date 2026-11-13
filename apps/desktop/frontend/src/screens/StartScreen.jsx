import { useState } from 'react';
import { Button, TextField, Box, Typography, Paper, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import GitHubIcon from '@mui/icons-material/GitHub';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';

export default function StartScreen({ onOpenFolder, onCloneSuccess }) {
  const [cloneUrl, setCloneUrl] = useState('');
  const [clonePath, setClonePath] = useState('');
  const [cloneProgress, setCloneProgress] = useState('');
  const [cloneLoading, setCloneLoading] = useState(false);
  const [cloneError, setCloneError] = useState('');
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectParentPath, setProjectParentPath] = useState('');
  const [createProjectLoading, setCreateProjectLoading] = useState(false);
  const [createProjectError, setCreateProjectError] = useState('');

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
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
        background: 'background.default',
      }}
    >
      <Typography variant="h4" sx={{ color: 'secondary.main', mb: 4, fontWeight: 600, fontFamily: 'inherit' }}>
        TestBlox
      </Typography>
      <Typography sx={{ color: 'text.secondary', mb: 4 }}>
        Open a folder, create a new project, or clone a Git repository
      </Typography>

      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 860 }}>
        <Paper
          sx={{
            p: 3,
            minWidth: 260,
            background: 'action.hover',
            border: '1px solid',
            borderColor: 'text.secondary',
          }}
        >
          <FolderOpenIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
          <Typography variant="h6" sx={{ color: 'text.primary', mb: 1 }}>
            Open folder
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Open an existing workspace folder on your computer
          </Typography>
          <Button variant="contained" onClick={handleOpen} fullWidth sx={{ bgcolor: 'success.main', color: 'background.default', '&:hover': { bgcolor: 'success.dark' } }}>
            Open folder
          </Button>
        </Paper>

        <Paper
          sx={{
            p: 3,
            minWidth: 260,
            background: 'action.hover',
            border: '1px solid',
            borderColor: 'text.secondary',
          }}
        >
          <GitHubIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
          <Typography variant="h6" sx={{ color: 'text.primary', mb: 1 }}>
            Clone repository
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Clone a Git repository to work with tests
          </Typography>
          <TextField
            size="small"
            fullWidth
            placeholder="https://github.com/owner/repo"
            value={cloneUrl}
            onChange={(e) => setCloneUrl(e.target.value)}
            sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { color: 'text.primary' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'text.secondary' } }}
          />
          <TextField
            size="small"
            fullWidth
            placeholder="Clone to (optional – pick folder)"
            value={clonePath}
            onChange={(e) => setClonePath(e.target.value)}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { color: 'text.primary' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'text.secondary' } }}
          />
          {cloneProgress && (
            <Typography variant="caption" sx={{ color: 'success.main', display: 'block', mb: 1 }}>
              {cloneProgress}
            </Typography>
          )}
          {cloneError && (
            <Typography variant="caption" sx={{ color: 'error.main', display: 'block', mb: 1 }}>
              {cloneError}
            </Typography>
          )}
          <Button
            variant="contained"
            onClick={handleClone}
            disabled={cloneLoading}
            fullWidth
            sx={{ bgcolor: 'success.main', color: 'background.default', '&:hover': { bgcolor: 'success.dark' } }}
          >
            {cloneLoading ? 'Cloning...' : 'Clone'}
          </Button>
        </Paper>

        <Paper
          sx={{
            p: 3,
            minWidth: 260,
            background: 'action.hover',
            border: '1px solid',
            borderColor: 'text.secondary',
          }}
        >
          <CreateNewFolderIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
          <Typography variant="h6" sx={{ color: 'text.primary', mb: 1 }}>
            Create new project
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Choose a folder and name; a new TestBlox workspace will be created there
          </Typography>
          <Button variant="contained" onClick={() => setCreateProjectOpen(true)} fullWidth sx={{ bgcolor: 'success.main', color: 'background.default', '&:hover': { bgcolor: 'success.dark' } }}>
            Create project
          </Button>
        </Paper>
      </Box>

      <Dialog open={createProjectOpen} onClose={() => !createProjectLoading && setCreateProjectOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'text.secondary' } }}>
        <DialogTitle sx={{ color: 'secondary.main' }}>Create new project</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Project name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="My Project"
            sx={{ mt: 1, mb: 2, '& .MuiOutlinedInput-root': { color: 'text.primary' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'text.secondary' } }}
          />
          <TextField
            fullWidth
            label="Parent folder"
            value={projectParentPath}
            readOnly
            placeholder="Choose folder"
            sx={{ mb: 1, '& .MuiOutlinedInput-root': { color: 'text.primary' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'text.secondary' } }}
          />
          <Button size="small" onClick={handleCreateProjectChooseFolder} sx={{ color: 'secondary.main' }}>
            Choose parent folder
          </Button>
          {createProjectError && (
            <Typography variant="body2" sx={{ color: 'error.main', mt: 2 }}>{createProjectError}</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateProjectOpen(false)} disabled={createProjectLoading} sx={{ color: 'text.secondary' }}>Cancel</Button>
          <Button onClick={handleCreateProjectSubmit} disabled={createProjectLoading || !projectParentPath.trim()} variant="contained" sx={{ bgcolor: 'success.main', color: 'background.default', '&:hover': { bgcolor: 'success.dark' } }}>
            {createProjectLoading ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
