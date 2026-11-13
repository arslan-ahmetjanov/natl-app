import { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Menu,
  MenuItem,
  Snackbar,
  Alert,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SettingsIcon from '@mui/icons-material/Settings';
import EditIcon from '@mui/icons-material/Edit';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AssessmentIcon from '@mui/icons-material/Assessment';
import DataObjectIcon from '@mui/icons-material/DataObject';
import ApiIcon from '@mui/icons-material/Api';
import DescriptionIcon from '@mui/icons-material/Description';
import AllInclusiveIcon from '@mui/icons-material/AllInclusive';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import HomeIcon from '@mui/icons-material/Home';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import SearchIcon from '@mui/icons-material/Search';
import PageScreen from './PageScreen';
import PagesListScreen from './PagesListScreen';
import TestEditorScreen from './TestEditorScreen';
import RunScreen from './RunScreen';
import ReportView from './ReportView';
import TestsScreen from './TestsScreen';
import VariablesScreen from './VariablesScreen';
import ApiBasesListScreen from './ApiBasesListScreen';
import ApiBaseScreen from './ApiBaseScreen';
import SharedStepsScreen from './SharedStepsScreen';
import GitScreen from './GitScreen';
import AiGenerateScreen from './AiGenerateScreen';
import MainLayout from '../components/MainLayout';
import SectionLabel from '../components/SectionLabel';
import WindowTitleBar from '../components/WindowTitleBar';

/** Shown when a key exists but is not sent to the renderer (IPC uses `***`). Password field shows bullets. */
const LLM_API_KEY_MASK_DISPLAY = '********';

function isLlmApiKeySaveUnchanged(value) {
  const v = value != null ? String(value).trim() : '';
  return v === '' || v === '***' || v === LLM_API_KEY_MASK_DISPLAY;
}

export default function WorkspaceView({ workspacePath, workspace, pages, themeMode, onToggleTheme, onRefresh, onOpenFolder, onCloseWorkspace }) {
  const [view, setView] = useState('list'); // 'list' | 'page' | 'test' | 'run' | 'report' | 'variables' | 'apiBases' | 'apiBase' | 'sharedSteps' | 'git' | 'ai'
  const [selectedPageId, setSelectedPageId] = useState(null);
  const [selectedTestId, setSelectedTestId] = useState(null);
  const [selectedBaseId, setSelectedBaseId] = useState(null);
  const [reportId, setReportId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [llmConfig, setLlmConfig] = useState({ global: {}, effective: {}, isValid: false });
  const [llmForm, setLlmForm] = useState({ apiKey: '', modelName: '', apiBaseUrl: '' });
  const [llmSaving, setLlmSaving] = useState(false);
  const [browserForm, setBrowserForm] = useState({ executablePath: '' });
  const [addPageOpen, setAddPageOpen] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newPageUrl, setNewPageUrl] = useState('');
  const [addPageSaving, setAddPageSaving] = useState(false);
  const [newTestDialogOpen, setNewTestDialogOpen] = useState(false);
  const [newTestTitle, setNewTestTitle] = useState('');
  const [newTestType, setNewTestType] = useState('hybrid');
  const [newTestSaving, setNewTestSaving] = useState(false);
  const [workspaceTitleOpen, setWorkspaceTitleOpen] = useState(false);
  const [workspaceTitleValue, setWorkspaceTitleValue] = useState('');
  const [workspaceTitleSaving, setWorkspaceTitleSaving] = useState(false);
  const [workspaceMenuAnchor, setWorkspaceMenuAnchor] = useState(null);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneFolderName, setCloneFolderName] = useState('');
  const [cloneParentPath, setCloneParentPath] = useState('');
  const [cloneLoading, setCloneLoading] = useState(false);
  const [cloneError, setCloneError] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [importZipPath, setImportZipPath] = useState('');
  const [importTargetPath, setImportTargetPath] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const llmSourceLabel = (source) => {
    if (source === 'env') return 'Environment (.env / process env)';
    if (source === 'workspace') return 'Workspace .env';
    if (source === 'buildConfig') return 'Build config';
    return 'Default';
  };

  const handleAddPageOpen = () => {
    setNewPageTitle('');
    setNewPageUrl('');
    setAddPageOpen(true);
  };

  const handleAddPageSubmit = async () => {
    const title = newPageTitle.trim() || 'New Page';
    setAddPageSaving(true);
    try {
      const created = await window.electronAPI.createPage({ title, url: newPageUrl.trim() || '' });
      setAddPageOpen(false);
      onRefresh?.();
      if (created) {
        setView('page');
        setSelectedPageId(created.id);
        setSelectedTestId(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAddPageSaving(false);
    }
  };

  const handleOpenNewTestDialog = () => {
    setNewTestTitle('');
    setNewTestType('hybrid');
    setNewTestDialogOpen(true);
  };

  const handleNewTestSubmit = async () => {
    const title = newTestTitle.trim() || 'New Test';
    setNewTestSaving(true);
    try {
      const created = await window.electronAPI.createTest({ title, type: newTestType, pageId: null });
      setNewTestDialogOpen(false);
      onRefresh?.();
      if (created) {
        setView('test');
        setSelectedTestId(created.id);
        setSelectedPageId(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setNewTestSaving(false);
    }
  };

  const openWorkspaceTitleEdit = () => {
    setWorkspaceTitleValue(workspace?.title || '');
    setWorkspaceTitleOpen(true);
  };

  const handleWorkspaceTitleSave = async () => {
    const title = workspaceTitleValue.trim() || workspace?.title || 'Untitled';
    setWorkspaceTitleSaving(true);
    try {
      await window.electronAPI.updateWorkspaceMeta({ title });
      setWorkspaceTitleOpen(false);
      onRefresh?.();
    } catch (e) {
      console.error(e);
    } finally {
      setWorkspaceTitleSaving(false);
    }
  };

  const openSettings = async () => {
    setSettingsOpen(true);
    const c = await window.electronAPI.llmGetConfig();
    setLlmConfig(c);
    setLlmForm({
      apiKey: c.effective?.apiKey === '***' ? LLM_API_KEY_MASK_DISPLAY : (c.effective?.apiKey || ''),
      modelName: c.effective?.modelName || '',
      apiBaseUrl: c.effective?.apiBaseUrl || 'https://openrouter.ai/api/v1',
    });
    const bc = await window.electronAPI.browserGetConfig();
    setBrowserForm({ executablePath: bc.executablePath || '' });
  };

  const handleLlmSave = async () => {
    setLlmSaving(true);
    try {
      await window.electronAPI.llmSaveConfig({
        apiKey: isLlmApiKeySaveUnchanged(llmForm.apiKey) ? '***' : llmForm.apiKey,
        modelName: llmForm.modelName || undefined,
      });
      await window.electronAPI.browserSaveConfig({
        executablePath: browserForm.executablePath || null,
      });
      const c = await window.electronAPI.llmGetConfig();
      setLlmConfig(c);
      setSettingsOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setLlmSaving(false);
    }
  };

  const handleBrowserBrowse = async () => {
    const p = await window.electronAPI?.selectBrowserExecutable();
    if (p) setBrowserForm((f) => ({ ...f, executablePath: p }));
  };

  const openCloneDialog = () => {
    setWorkspaceMenuAnchor(null);
    setCloneFolderName((workspace?.title || 'Workspace') + ' (copy)');
    setCloneParentPath('');
    setCloneError('');
    setCloneDialogOpen(true);
  };

  const handleCloneChooseFolder = async () => {
    const p = await window.electronAPI?.openFolder();
    if (p) setCloneParentPath(p);
  };

  const handleCloneSubmit = async () => {
    if (!cloneParentPath.trim()) {
      setCloneError('Choose destination folder');
      return;
    }
    setCloneError('');
    setCloneLoading(true);
    try {
      const result = await window.electronAPI.workspaceClone(workspacePath, cloneParentPath, cloneFolderName.trim() || undefined);
      setCloneDialogOpen(false);
      setSnackbar({ open: true, message: 'Workspace copied. Open it from Recent or Open folder.', severity: 'success' });
      if (onOpenFolder && result?.path) {
        onOpenFolder(result.path);
      }
    } catch (e) {
      setCloneError(e.message || 'Clone failed');
    } finally {
      setCloneLoading(false);
    }
  };

  const handleExportZip = async () => {
    setWorkspaceMenuAnchor(null);
    setExportLoading(true);
    try {
      const result = await window.electronAPI.workspaceExportZip(workspacePath);
      if (result?.canceled) return;
      if (result?.success) {
        setSnackbar({ open: true, message: 'Workspace exported successfully', severity: 'success' });
      } else {
        setSnackbar({ open: true, message: result?.error || 'Export failed', severity: 'error' });
      }
    } catch (e) {
      setSnackbar({ open: true, message: e.message || 'Export failed', severity: 'error' });
    } finally {
      setExportLoading(false);
    }
  };

  const openImportDialog = () => {
    setWorkspaceMenuAnchor(null);
    setImportZipPath('');
    setImportTargetPath('');
    setImportDialogOpen(true);
  };

  const handleImportSelectZip = async () => {
    const p = await window.electronAPI?.openZip();
    if (p) setImportZipPath(p);
  };

  const handleImportSelectFolder = async () => {
    const p = await window.electronAPI?.openFolder();
    if (p) setImportTargetPath(p);
  };

  const handleImportSubmit = async () => {
    if (!importZipPath || !importTargetPath) {
      setSnackbar({ open: true, message: 'Select ZIP file and destination folder', severity: 'warning' });
      return;
    }
    setImportLoading(true);
    try {
      const result = await window.electronAPI.workspaceImportZip(importZipPath, importTargetPath);
      setImportDialogOpen(false);
      setSnackbar({ open: true, message: 'Workspace imported successfully', severity: 'success' });
      if (onOpenFolder && result?.path) {
        onOpenFolder(result.path);
      }
    } catch (e) {
      setSnackbar({ open: true, message: e.message || 'Import failed', severity: 'error' });
    } finally {
      setImportLoading(false);
    }
  };

  const workspaceHeader = (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        borderRadius: 0,
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <IconButton size="small" onClick={onCloseWorkspace} sx={{ color: 'text.secondary' }} title="Close workspace (Home)">
        <HomeIcon />
      </IconButton>
      <FolderOpenIcon sx={{ color: 'secondary.main' }} />
      <Typography variant="body2" sx={{ color: 'text.secondary', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {workspacePath}
      </Typography>
      <IconButton
        size="small"
        onClick={(e) => setWorkspaceMenuAnchor(e.currentTarget)}
        sx={{ color: 'text.secondary' }}
        title="Workspace actions"
      >
        <MoreVertIcon />
      </IconButton>
      <Menu
        anchorEl={workspaceMenuAnchor}
        open={!!workspaceMenuAnchor}
        onClose={() => setWorkspaceMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={openCloneDialog}>
          <ContentCopyIcon sx={{ mr: 1, fontSize: 20 }} /> Copy workspace
        </MenuItem>
        <MenuItem onClick={handleExportZip} disabled={exportLoading}>
          <FileDownloadIcon sx={{ mr: 1, fontSize: 20 }} /> Export to ZIP
        </MenuItem>
        <MenuItem onClick={openImportDialog}>
          <FileUploadIcon sx={{ mr: 1, fontSize: 20 }} /> Import from ZIP
        </MenuItem>
      </Menu>
      <IconButton size="small" onClick={onRefresh} sx={{ color: 'text.secondary' }} title="Refresh">
        <RefreshIcon />
      </IconButton>
      {onToggleTheme && (
        <IconButton size="small" onClick={onToggleTheme} aria-label={themeMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} sx={{ color: 'text.secondary' }} title={themeMode === 'dark' ? 'Light theme' : 'Dark theme'}>
          {themeMode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
        </IconButton>
      )}
      <Button size="small" startIcon={<SettingsIcon />} onClick={openSettings} sx={{ color: 'text.primary' }}>
        Settings
      </Button>
      <Button size="small" startIcon={<AccountTreeIcon />} onClick={() => { setView('git'); clearSubSelection(); }} sx={{ color: 'text.primary' }}>
        Git
      </Button>
      <Button size="small" startIcon={<AutoAwesomeIcon />} onClick={() => { setView('ai'); clearSubSelection(); }} sx={{ color: 'text.primary' }}>
        AI
      </Button>
    </Paper>
  );

  const clearSubSelection = () => {
    setSelectedPageId(null);
    setSelectedTestId(null);
    setSelectedBaseId(null);
  };

  const navItem = (icon, label, selected, onClick) => (
    <ListItem key={label} disablePadding sx={{ mb: 0.25 }}>
      <ListItemButton
        selected={selected}
        onClick={onClick}
        sx={{
          borderRadius: 1,
          py: 0.65,
          '&.Mui-selected': {
            bgcolor: 'action.selected',
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: 36, color: 'primary.main' }}>{icon}</ListItemIcon>
        <ListItemText primary={label} primaryTypographyProps={{ variant: 'body2', sx: { color: 'text.primary' } }} />
      </ListItemButton>
    </ListItem>
  );

  const workspaceSidebar = (
    <Paper
      sx={{
        flex: '0 0 280px',
        p: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
        <Typography variant="subtitle2" sx={{ color: 'text.secondary', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          Workspace: {workspace?.title || 'Untitled'}
        </Typography>
        <IconButton size="small" onClick={openWorkspaceTitleEdit} sx={{ color: 'text.secondary', p: 0.25 }} title="Edit workspace name">
          <EditIcon fontSize="small" />
        </IconButton>
      </Box>
      <List dense disablePadding sx={{ mt: 1 }}>
        <SectionLabel sx={{ mt: 0, mb: 0.5, px: 0.5 }}>Authoring</SectionLabel>
        {navItem(<SearchIcon fontSize="small" />, 'Tests', view === 'tests' || view === 'test', () => {
          setView('tests');
          clearSubSelection();
        })}
        {navItem(<DescriptionIcon fontSize="small" />, 'Pages', view === 'page', () => {
          setView('page');
          clearSubSelection();
        })}
        {navItem(<AllInclusiveIcon fontSize="small" />, 'Shared Steps', view === 'sharedSteps', () => {
          setView('sharedSteps');
          clearSubSelection();
        })}
        {navItem(<ApiIcon fontSize="small" />, 'API Bases', view === 'apiBases' || view === 'apiBase', () => {
          setView('apiBases');
          clearSubSelection();
        })}
        <SectionLabel sx={{ mt: 1.5, mb: 0.5, px: 0.5 }}>Run</SectionLabel>
        {navItem(<PlayArrowIcon fontSize="small" />, 'Run tests', view === 'run', () => {
          setView('run');
          clearSubSelection();
        })}
        {navItem(<AssessmentIcon fontSize="small" />, 'Reports', view === 'report', () => {
          setView('report');
          clearSubSelection();
        })}
        <SectionLabel sx={{ mt: 1.5, mb: 0.5, px: 0.5 }}>Project</SectionLabel>
        {navItem(<DataObjectIcon fontSize="small" />, 'Variables', view === 'variables', () => {
          setView('variables');
          clearSubSelection();
        })}
        {navItem(<AccountTreeIcon fontSize="small" />, 'Git', view === 'git', () => {
          setView('git');
          clearSubSelection();
        })}
        {navItem(<AutoAwesomeIcon fontSize="small" />, 'AI Generate', view === 'ai', () => {
          setView('ai');
          clearSubSelection();
        })}
      </List>
    </Paper>
  );

  const workspaceContent = (
    <>
          {view === 'list' && (
            <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
              <Typography variant="h6" sx={{ color: 'text.primary', mb: 0.5 }}>
                Workspace home
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                Open a section below or use the sidebar. Git actions are in the header when the folder is a repository.
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
                  gap: 2,
                  maxWidth: 960,
                }}
              >
                {[
                  {
                    title: 'Tests',
                    desc: 'Create and edit tests, open the step editor.',
                    icon: <SearchIcon sx={{ color: 'primary.main' }} />,
                    onClick: () => { setView('tests'); clearSubSelection(); },
                  },
                  {
                    title: 'Pages',
                    desc: 'URLs, captured elements, and page-level tools.',
                    icon: <DescriptionIcon sx={{ color: 'primary.main' }} />,
                    onClick: () => { setView('page'); clearSubSelection(); },
                  },
                  {
                    title: 'Run tests',
                    desc: 'Select tests and run with chosen workers.',
                    icon: <PlayArrowIcon sx={{ color: 'primary.main' }} />,
                    onClick: () => { setView('run'); clearSubSelection(); },
                  },
                  {
                    title: 'Reports',
                    desc: 'Browse recent runs and step results.',
                    icon: <AssessmentIcon sx={{ color: 'primary.main' }} />,
                    onClick: () => { setView('report'); clearSubSelection(); },
                  },
                  {
                    title: 'Variables',
                    desc: 'Workspace variables for {{placeholders}} in steps.',
                    icon: <DataObjectIcon sx={{ color: 'primary.main' }} />,
                    onClick: () => { setView('variables'); clearSubSelection(); },
                  },
                  {
                    title: 'API bases',
                    desc: 'Base URLs, endpoints, Swagger import.',
                    icon: <ApiIcon sx={{ color: 'primary.main' }} />,
                    onClick: () => { setView('apiBases'); clearSubSelection(); },
                  },
                  {
                    title: 'Shared steps',
                    desc: 'Reusable step groups for multiple tests.',
                    icon: <AllInclusiveIcon sx={{ color: 'primary.main' }} />,
                    onClick: () => { setView('sharedSteps'); clearSubSelection(); },
                  },
                  {
                    title: 'Git',
                    desc: 'Repository operations in dedicated screen.',
                    icon: <AccountTreeIcon sx={{ color: 'primary.main' }} />,
                    onClick: () => { setView('git'); clearSubSelection(); },
                  },
                  {
                    title: 'AI Generate',
                    desc: 'Generate tests from pages and API bases.',
                    icon: <AutoAwesomeIcon sx={{ color: 'primary.main' }} />,
                    onClick: () => { setView('ai'); clearSubSelection(); },
                  },
                ].map((card) => (
                  <Paper
                    key={card.title}
                    elevation={0}
                    sx={{
                      p: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: 'background.paper',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                      cursor: 'pointer',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                      '&:hover': {
                        borderColor: 'primary.main',
                        boxShadow: 1,
                      },
                    }}
                    onClick={card.onClick}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        card.onClick();
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {card.icon}
                      <Typography variant="subtitle1" sx={{ color: 'text.primary', fontWeight: 600 }}>
                        {card.title}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: 'text.secondary', flex: 1 }}>
                      {card.desc}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600 }}>
                      Open
                    </Typography>
                  </Paper>
                ))}
              </Box>
            </Box>
          )}
          {view === 'page' && !selectedPageId && (
            <PagesListScreen
              pages={pages}
              onAddPage={handleAddPageOpen}
              onOpenPage={(id) => { setSelectedPageId(id); }}
              onRefresh={onRefresh}
            />
          )}
          {view === 'page' && selectedPageId && (
            <PageScreen
              pageId={selectedPageId}
              page={pages.find((p) => p.id === selectedPageId)}
              onBack={() => { setSelectedPageId(null); }}
              onRefresh={onRefresh}
            />
          )}
          {view === 'test' && selectedTestId && (
            <TestEditorScreen
              testId={selectedTestId}
              onBack={() => { setView('list'); setSelectedTestId(null); }}
              onRefresh={onRefresh}
              onOpenRun={() => setView('run')}
              onViewReport={(id) => { setReportId(id); setView('report'); }}
              onOpenSharedSteps={() => {
                setSelectedTestId(null);
                setSelectedPageId(null);
                setView('sharedSteps');
              }}
            />
          )}
          {view === 'tests' && (
            <TestsScreen
              pages={pages}
              onBack={() => setView('list')}
              onRefresh={onRefresh}
              onOpenTest={(id) => { setView('test'); setSelectedTestId(id); setSelectedPageId(null); }}
            />
          )}
          {view === 'run' && (
            <RunScreen
              onBack={() => setView('list')}
              onRefresh={onRefresh}
              onViewReport={(id) => { setReportId(id); setView('report'); }}
            />
          )}
          {view === 'git' && (
            <GitScreen
              workspacePath={workspacePath}
              onBack={() => setView('list')}
              onRefresh={onRefresh}
            />
          )}
          {view === 'ai' && (
            <AiGenerateScreen
              pages={pages}
              onBack={() => setView('list')}
              onRefresh={onRefresh}
            />
          )}
          {view === 'report' && (
            <ReportView reportId={reportId} onBack={() => setView('list')} onRefresh={onRefresh} />
          )}
          {view === 'variables' && (
            <VariablesScreen onBack={() => setView('list')} />
          )}
          {view === 'apiBases' && (
            <ApiBasesListScreen
              onBack={() => setView('list')}
              onRefresh={onRefresh}
              onOpenBase={(id) => { setSelectedBaseId(id); setView('apiBase'); }}
            />
          )}
          {view === 'apiBase' && selectedBaseId && (
            <ApiBaseScreen
              baseId={selectedBaseId}
              onBack={() => { setView('apiBases'); setSelectedBaseId(null); }}
              onRefresh={onRefresh}
            />
          )}
          {view === 'sharedSteps' && (
            <SharedStepsScreen onBack={() => setView('list')} onRefresh={onRefresh} />
          )}

      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: 'background.paper' } }}>
        <DialogTitle sx={{ color: 'secondary.main' }}>Settings</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle2" sx={{ color: 'primary.main', mt: 1, mb: 1 }}>Browser for tests</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
            Set a browser executable path once; it is applied globally to all test runs.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              label="Executable path"
              value={browserForm.executablePath}
              onChange={(e) => setBrowserForm((f) => ({ ...f, executablePath: e.target.value }))}
              placeholder="C:\\path\\to\\browser.exe"
              sx={{ '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
            />
            <Button variant="outlined" onClick={handleBrowserBrowse} sx={{ flexShrink: 0, borderColor: 'divider', color: 'text.primary' }}>Browse</Button>
          </Box>

          <Typography variant="subtitle2" sx={{ color: 'primary.main', mt: 2, mb: 1 }}>LLM (OpenRouter)</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Used for AI test generation. Leave the field empty or keep the masked value to retain the current key.
          </Typography>
          <TextField
            fullWidth
            label="API Key"
            type="password"
            value={llmForm.apiKey}
            onChange={(e) => setLlmForm((f) => ({ ...f, apiKey: e.target.value }))}
            onFocus={(e) => {
              if (llmForm.apiKey === LLM_API_KEY_MASK_DISPLAY) {
                e.target.select();
              }
            }}
            placeholder="sk-..."
            sx={{ mb: 0.5, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
            Key and model are saved to this workspace root .env as TESTBLOX_LLM_API_KEY and TESTBLOX_LLM_MODEL (keep .env out of git).
          </Typography>
          {llmConfig?.sources?.apiKey === 'env' && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Effective API key is currently coming from environment variables. Saved value may not be used until env override is removed.
            </Alert>
          )}
          <TextField
            fullWidth
            label="Model name"
            value={llmForm.modelName}
            onChange={(e) => setLlmForm((f) => ({ ...f, modelName: e.target.value }))}
            placeholder="openai/gpt-4o-mini"
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
          />
          <TextField
            fullWidth
            label="API Base URL"
            value={llmForm.apiBaseUrl}
            placeholder="https://openrouter.ai/api/v1"
            InputProps={{ readOnly: true }}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1.5 }}>
            Effective sources: API key - {llmSourceLabel(llmConfig?.sources?.apiKey)}, model - {llmSourceLabel(llmConfig?.sources?.modelName)}, base URL - {llmSourceLabel(llmConfig?.sources?.apiBaseUrl)}.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)} sx={{ color: 'text.secondary' }}>Cancel</Button>
          <Button onClick={handleLlmSave} disabled={llmSaving} variant="contained" sx={{ bgcolor: 'success.main', color: 'background.default', '&:hover': { bgcolor: 'success.dark' } }}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={workspaceTitleOpen} onClose={() => !workspaceTitleSaving && setWorkspaceTitleOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: 'background.paper' } }}>
        <DialogTitle sx={{ color: 'secondary.main' }}>Workspace name</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Title"
            value={workspaceTitleValue}
            onChange={(e) => setWorkspaceTitleValue(e.target.value)}
            sx={{ mt: 1, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWorkspaceTitleOpen(false)} disabled={workspaceTitleSaving} sx={{ color: 'text.secondary' }}>Cancel</Button>
          <Button onClick={handleWorkspaceTitleSave} disabled={workspaceTitleSaving} variant="contained" sx={{ bgcolor: 'success.main', color: 'background.default', '&:hover': { bgcolor: 'success.dark' } }}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={newTestDialogOpen} onClose={() => !newTestSaving && setNewTestDialogOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: 'background.paper' } }}>
        <DialogTitle sx={{ color: 'secondary.main' }}>Add test</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Test title"
            value={newTestTitle}
            onChange={(e) => setNewTestTitle(e.target.value)}
            placeholder="e.g. Login flow"
            sx={{ mt: 1, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewTestDialogOpen(false)} disabled={newTestSaving} sx={{ color: 'text.secondary' }}>Cancel</Button>
          <Button onClick={handleNewTestSubmit} disabled={newTestSaving} variant="contained" sx={{ bgcolor: 'success.main', color: 'background.default', '&:hover': { bgcolor: 'success.dark' } }}>Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={addPageOpen} onClose={() => !addPageSaving && setAddPageOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: 'background.paper' } }}>
        <DialogTitle sx={{ color: 'secondary.main' }}>Add page</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            A page is a URL you want to test. You can parse it later to get elements for building test steps.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Title"
            value={newPageTitle}
            onChange={(e) => setNewPageTitle(e.target.value)}
            placeholder="e.g. Login page"
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
          />
          <TextField
            fullWidth
            label="URL"
            value={newPageUrl}
            onChange={(e) => setNewPageUrl(e.target.value)}
            placeholder="https://example.com"
            sx={{ '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddPageOpen(false)} disabled={addPageSaving} sx={{ color: 'text.secondary' }}>Cancel</Button>
          <Button onClick={handleAddPageSubmit} disabled={addPageSaving} variant="contained" sx={{ bgcolor: 'success.main', color: 'background.default', '&:hover': { bgcolor: 'success.dark' } }}>
            {addPageSaving ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={cloneDialogOpen} onClose={() => !cloneLoading && setCloneDialogOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: 'background.paper' } }}>
        <DialogTitle sx={{ color: 'secondary.main' }}>Copy workspace</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="New workspace name"
            value={cloneFolderName}
            onChange={(e) => setCloneFolderName(e.target.value)}
            placeholder="Workspace (copy)"
            sx={{ mt: 1, mb: 2, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
          />
          <TextField fullWidth label="Destination folder" value={cloneParentPath} readOnly placeholder="Choose folder" sx={{ mb: 1, '& .MuiOutlinedInput-root': { color: 'text.primary' } }} />
          <Button size="small" onClick={handleCloneChooseFolder} sx={{ color: 'secondary.main' }}>Choose folder</Button>
          {cloneError && <Typography variant="body2" sx={{ color: 'error.main', mt: 2 }}>{cloneError}</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloneDialogOpen(false)} disabled={cloneLoading} sx={{ color: 'text.secondary' }}>Cancel</Button>
          <Button onClick={handleCloneSubmit} disabled={cloneLoading || !cloneParentPath.trim()} variant="contained" sx={{ bgcolor: 'success.main', color: 'background.default', '&:hover': { bgcolor: 'success.dark' } }}>
            {cloneLoading ? 'Copying…' : 'Copy'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={importDialogOpen} onClose={() => !importLoading && setImportDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: 'background.paper' } }}>
        <DialogTitle sx={{ color: 'secondary.main' }}>Import workspace from ZIP</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="ZIP file" value={importZipPath} readOnly placeholder="Select ZIP file" sx={{ mt: 1, mb: 1, '& .MuiOutlinedInput-root': { color: 'text.primary' } }} />
          <Button size="small" onClick={handleImportSelectZip} sx={{ color: 'secondary.main', mb: 2 }}>Select ZIP file</Button>
          <TextField fullWidth label="Destination folder" value={importTargetPath} readOnly placeholder="Choose folder" sx={{ mb: 1, '& .MuiOutlinedInput-root': { color: 'text.primary' } }} />
          <Button size="small" onClick={handleImportSelectFolder} sx={{ color: 'secondary.main' }}>Choose folder</Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)} disabled={importLoading} sx={{ color: 'text.secondary' }}>Cancel</Button>
          <Button onClick={handleImportSubmit} disabled={importLoading || !importZipPath || !importTargetPath} variant="contained" sx={{ bgcolor: 'success.main', color: 'background.default', '&:hover': { bgcolor: 'success.dark' } }}>
            {importLoading ? 'Importing…' : 'Import'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );

  return (
    <MainLayout
      topBar={<WindowTitleBar />}
      header={workspaceHeader}
      sidebar={workspaceSidebar}
      content={workspaceContent}
    />
  );
}
