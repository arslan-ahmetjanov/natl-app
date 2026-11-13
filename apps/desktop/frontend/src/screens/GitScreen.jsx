import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  Select,
  MenuItem,
} from '@mui/material';
import ScreenHeader from '../components/ScreenHeader';

export default function GitScreen({ workspacePath, onBack, onRefresh }) {
  const [gitRoot, setGitRoot] = useState(null);
  const [branch, setBranch] = useState(null);
  const [status, setStatus] = useState(null);
  const [branches, setBranches] = useState([]);
  const [remoteBranches, setRemoteBranches] = useState([]);
  const [remotes, setRemotes] = useState([]);
  const [gitBusy, setGitBusy] = useState(false);
  const [initGitBusy, setInitGitBusy] = useState(false);
  const [branchSelectOpen, setBranchSelectOpen] = useState(false);
  const [remotesOpen, setRemotesOpen] = useState(false);
  const [newRemoteName, setNewRemoteName] = useState('');
  const [newRemoteUrl, setNewRemoteUrl] = useState('');
  const [commitOpen, setCommitOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');

  const hasChanges = status && (status.files?.length > 0 || status.not_added?.length > 0);

  const loadGit = async () => {
    if (!window.electronAPI) return;
    const root = await window.electronAPI.gitRootPath(workspacePath);
    setGitRoot(root);
    if (!root) return;
    const [b, s, branchList, remotesList] = await Promise.all([
      window.electronAPI.gitCurrentBranch(root),
      window.electronAPI.gitStatus(root),
      window.electronAPI.gitGetBranches(root).catch(() => []),
      window.electronAPI.gitGetRemotes(root).catch(() => []),
    ]);
    setBranch(b);
    setStatus(s);
    setBranches(branchList);
    setRemotes(remotesList);
  };

  useEffect(() => {
    loadGit();
  }, [workspacePath]);

  useEffect(() => {
    if (branchSelectOpen && gitRoot && remoteBranches.length === 0) {
      window.electronAPI?.gitGetRemoteBranches(gitRoot, 'origin').then(setRemoteBranches).catch(() => {});
    }
  }, [branchSelectOpen, gitRoot]);

  const handleBranchSelect = async (targetBranch, isRemote = false) => {
    if (!gitRoot || targetBranch === branch) return;
    setBranchSelectOpen(false);
    setGitBusy(true);
    try {
      if (isRemote) await window.electronAPI.gitCheckoutRemoteBranch(gitRoot, 'origin', targetBranch, 'branch-checkout');
      else await window.electronAPI.gitCheckoutBranch(gitRoot, targetBranch);
      await loadGit();
      onRefresh?.();
    } finally {
      setGitBusy(false);
    }
  };

  const runGit = async (fn) => {
    if (!gitRoot) return;
    setGitBusy(true);
    try {
      await fn();
      await loadGit();
      onRefresh?.();
    } finally {
      setGitBusy(false);
    }
  };

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <ScreenHeader
        title="Git"
        onBack={onBack}
        actions={
          <>
            {!gitRoot && (
              <Button size="small" onClick={async () => {
                setInitGitBusy(true);
                try { await window.electronAPI.gitInit(workspacePath); await loadGit(); }
                finally { setInitGitBusy(false); }
              }} disabled={initGitBusy} sx={{ color: 'primary.main' }}>
                Initialize repository
              </Button>
            )}
            {gitRoot && (
              <>
                <Button size="small" onClick={() => runGit(() => window.electronAPI.gitFetch(gitRoot, 'origin'))} disabled={gitBusy} sx={{ color: 'text.primary' }}>Fetch</Button>
                <Button size="small" onClick={() => runGit(() => window.electronAPI.gitPull(gitRoot))} disabled={gitBusy} sx={{ color: 'text.primary' }}>Pull</Button>
                <Button size="small" onClick={() => runGit(() => window.electronAPI.gitPush(gitRoot))} disabled={gitBusy} sx={{ color: 'text.primary' }}>Push</Button>
              </>
            )}
          </>
        }
      />

      {!gitRoot && (
        <Paper sx={{ p: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
          <Typography sx={{ color: 'text.secondary' }}>Repository is not initialized in this workspace.</Typography>
        </Paper>
      )}

      {gitRoot && (
        <>
          <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>Current branch</Typography>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <Select
                open={branchSelectOpen}
                onOpen={() => setBranchSelectOpen(true)}
                onClose={() => setBranchSelectOpen(false)}
                value={branch || ''}
                displayEmpty
                renderValue={(v) => v || 'main'}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && val.startsWith('remote/')) handleBranchSelect(val.slice(7), true);
                  else if (val) handleBranchSelect(val, false);
                }}
              >
                {branches.map((b) => <MenuItem key={b} value={b}>{b}</MenuItem>)}
                {remoteBranches.length > 0 && [
                  <MenuItem key="remote-divider" disabled>origin</MenuItem>,
                  ...remoteBranches.filter((b) => !branches.includes(b)).map((b) => (
                    <MenuItem key={`remote-${b}`} value={`remote/${b}`}>{b} (origin)</MenuItem>
                  )),
                ]}
              </Select>
            </FormControl>
            {status && (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                Ahead: {status.ahead || 0} | Behind: {status.behind || 0}
              </Typography>
            )}
          </Paper>

          <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>Actions</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button size="small" onClick={() => setRemotesOpen(true)} sx={{ color: 'text.primary' }}>Remotes</Button>
              <Button size="small" onClick={() => setCommitOpen(true)} disabled={!hasChanges || gitBusy} sx={{ color: 'text.primary' }}>Commit</Button>
            </Box>
          </Paper>
        </>
      )}

      <Dialog open={remotesOpen} onClose={() => setRemotesOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: 'background.paper' } }}>
        <DialogTitle sx={{ color: 'text.primary' }}>Git remotes</DialogTitle>
        <DialogContent>
          {remotes.map((r) => (
            <Box key={r.name} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="body2" sx={{ color: 'text.primary', minWidth: 80 }}>{r.name}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.url}</Typography>
              <Button size="small" color="error" onClick={async () => {
                await runGit(() => window.electronAPI.gitRemoveRemote(gitRoot, r.name));
              }} disabled={gitBusy}>Remove</Button>
            </Box>
          ))}
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <TextField size="small" label="Name" value={newRemoteName} onChange={(e) => setNewRemoteName(e.target.value)} />
            <TextField size="small" label="URL" value={newRemoteUrl} onChange={(e) => setNewRemoteUrl(e.target.value)} sx={{ flex: 1 }} />
            <Button size="small" onClick={async () => {
              if (!newRemoteName.trim() || !newRemoteUrl.trim()) return;
              await runGit(() => window.electronAPI.gitAddRemote(gitRoot, newRemoteName.trim(), newRemoteUrl.trim()));
              setNewRemoteName('');
              setNewRemoteUrl('');
            }} disabled={gitBusy}>Add</Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemotesOpen(false)} sx={{ color: 'text.secondary' }}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={commitOpen} onClose={() => setCommitOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: 'background.paper' } }}>
        <DialogTitle sx={{ color: 'text.primary' }}>Commit changes</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            rows={3}
            placeholder="Commit message"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommitOpen(false)} sx={{ color: 'text.secondary' }}>Cancel</Button>
          <Button onClick={async () => {
            if (!commitMessage.trim()) return;
            await runGit(async () => {
              await window.electronAPI.gitStage(gitRoot, null);
              await window.electronAPI.gitCommit(gitRoot, commitMessage.trim());
            });
            setCommitMessage('');
            setCommitOpen(false);
          }} disabled={!commitMessage.trim() || gitBusy} variant="contained">Commit</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
