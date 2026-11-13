import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TableHead,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ScreenHeader from '../components/ScreenHeader';
import SectionLabel from '../components/SectionLabel';

export default function TestsScreen({ tests: initialTests, pages: initialPages, onBack, onRefresh, onOpenTest }) {
  const [tests, setTests] = useState(initialTests || []);
  const [pages, setPages] = useState(initialPages || []);
  const [endpoints, setEndpoints] = useState([]);
  const [filterPageId, setFilterPageId] = useState('');
  const [filterEndpointId, setFilterEndpointId] = useState('');
  const [testsWithSteps, setTestsWithSteps] = useState({});
  const [loadingEndpointFilter, setLoadingEndpointFilter] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [duplicatesDialogOpen, setDuplicatesDialogOpen] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState([]);
  const [idsToDelete, setIdsToDelete] = useState(new Set());
  const [duplicatesLoading, setDuplicatesLoading] = useState(false);
  const [duplicatesDeleting, setDuplicatesDeleting] = useState(false);

  useEffect(() => {
    setTests(initialTests || []);
    setPages(initialPages || []);
  }, [initialTests, initialPages]);

  // Fetch tests: all when no page filter, or only tests that use that page's web elements
  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.listTests(filterPageId || null).then(setTests).catch(() => setTests([]));
  }, [filterPageId]);

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.listEndpoints().then(setEndpoints).catch(() => setEndpoints([]));
  }, []);

  useEffect(() => {
    if (!filterEndpointId || !window.electronAPI) {
      setTestsWithSteps({});
      return;
    }
    setLoadingEndpointFilter(true);
    const load = async () => {
      const map = {};
      for (const t of tests) {
        try {
          const full = await window.electronAPI.getTest(t.id);
          if (full?.steps) map[t.id] = full;
        } catch (_) {}
      }
      setTestsWithSteps(map);
      setLoadingEndpointFilter(false);
    };
    load();
  }, [filterEndpointId, tests.length]);

  const filteredTests = (() => {
    let list = tests;
    // When filterPageId is set, list is already from listTests(filterPageId); no extra filter
    if (filterEndpointId) {
      list = list.filter((t) => {
        const full = testsWithSteps[t.id];
        if (!full?.steps) return false;
        return full.steps.some((s) => (s.endpointId || s.targetId) === filterEndpointId);
      });
    }
    return list;
  })();

  const handleAddSubmit = async () => {
    const title = newTitle.trim() || 'New Test';
    setAddSaving(true);
    try {
      const created = await window.electronAPI.createTest({ title });
      setAddOpen(false);
      setNewTitle('');
      onRefresh?.();
      if (created && onOpenTest) onOpenTest(created.id);
    } catch (e) {
      console.error(e);
    } finally {
      setAddSaving(false);
    }
  };

  const handleFindDuplicates = async () => {
    setDuplicatesLoading(true);
    setDuplicatesDialogOpen(true);
    setDuplicateGroups([]);
    setIdsToDelete(new Set());
    try {
      const groups = await window.electronAPI.findDuplicateTests?.() || [];
      setDuplicateGroups(groups);
    } catch (e) {
      console.error(e);
      setDuplicateGroups([]);
    } finally {
      setDuplicatesLoading(false);
    }
  };

  const toggleDuplicateDelete = (id) => {
    setIdsToDelete((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSelectedDuplicates = async () => {
    if (idsToDelete.size === 0) return;
    setDuplicatesDeleting(true);
    try {
      for (const id of idsToDelete) {
        await window.electronAPI.deleteTest(id);
      }
      setDuplicatesDialogOpen(false);
      setIdsToDelete(new Set());
      onRefresh?.();
    } catch (e) {
      console.error(e);
    } finally {
      setDuplicatesDeleting(false);
    }
  };

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <ScreenHeader
        title="Tests"
        onBack={onBack}
        actions={
          <>
            <Button size="small" startIcon={<ContentCopyIcon />} onClick={handleFindDuplicates} disabled={!window.electronAPI?.findDuplicateTests} sx={{ color: 'text.secondary' }}>Find duplicates</Button>
            <Button size="small" startIcon={<AddIcon />} onClick={() => setAddOpen(true)} sx={{ color: 'primary.main' }}>Add test</Button>
          </>
        }
      />
      <SectionLabel sx={{ mb: 0.5 }}>Filters</SectionLabel>
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="filter-page-label" sx={{ color: 'text.secondary' }}>Filter by page</InputLabel>
          <Select
            labelId="filter-page-label"
            value={filterPageId}
            label="Filter by page"
            onChange={(e) => setFilterPageId(e.target.value)}
            sx={{ color: 'text.primary', '.MuiOutlinedInput-notchedOutline': { borderColor: 'divider' } }}
          >
            <MenuItem value="">All</MenuItem>
            {pages.map((p) => (
              <MenuItem key={p.id} value={p.id}>{p.title}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="filter-endpoint-label" sx={{ color: 'text.secondary' }}>Filter by endpoint</InputLabel>
          <Select
            labelId="filter-endpoint-label"
            value={filterEndpointId}
            label="Filter by endpoint"
            onChange={(e) => setFilterEndpointId(e.target.value)}
            sx={{ color: 'text.primary', '.MuiOutlinedInput-notchedOutline': { borderColor: 'divider' } }}
          >
            <MenuItem value="">All</MenuItem>
            {endpoints.map((ep) => (
              <MenuItem key={ep.id} value={ep.id}>{ep.method} {ep.path}</MenuItem>
            ))}
          </Select>
        </FormControl>
        {loadingEndpointFilter && <Typography variant="body2" sx={{ color: 'text.secondary', alignSelf: 'center' }}>Loading…</Typography>}
      </Box>
      <SectionLabel sx={{ mt: 1, mb: 0.5 }}>Test list</SectionLabel>
      <Paper sx={{ flex: 1, minHeight: 200, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: 'primary.main', borderColor: 'divider', bgcolor: 'action.hover' }}>Title</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredTests.length === 0 && (
              <TableRow>
                <TableCell colSpan={1} sx={{ color: 'text.secondary', borderColor: 'divider' }}>
                  {tests.length === 0 ? 'No tests. Click Add test to create one.' : 'No tests match the filters.'}
                </TableCell>
              </TableRow>
            )}
            {filteredTests.map((t) => (
              <TableRow
                key={t.id}
                hover
                sx={{ cursor: 'pointer', '& td': { borderColor: 'divider', color: 'text.primary' } }}
                onClick={() => onOpenTest?.(t.id)}
              >
                <TableCell>{t.title || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={addOpen} onClose={() => !addSaving && setAddOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: 'background.paper' } }}>
        <DialogTitle sx={{ color: 'text.primary' }}>Add test</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Test title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. Login flow"
            sx={{ mt: 1, mb: 2, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)} disabled={addSaving} sx={{ color: 'text.secondary' }}>Cancel</Button>
          <Button onClick={handleAddSubmit} disabled={addSaving} variant="contained" sx={{ bgcolor: 'primary.main' }}>Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={duplicatesDialogOpen} onClose={() => !duplicatesDeleting && setDuplicatesDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: 'background.paper' } }}>
        <DialogTitle sx={{ color: 'text.primary' }}>Duplicate tests</DialogTitle>
        <DialogContent>
          {duplicatesLoading && <Typography sx={{ color: 'text.secondary' }}>Searching…</Typography>}
          {!duplicatesLoading && duplicateGroups.length === 0 && (
            <Typography sx={{ color: 'text.secondary' }}>No duplicate groups found. Duplicates are tests with the same title, type, page, and steps.</Typography>
          )}
          {!duplicatesLoading && duplicateGroups.length > 0 && (
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>Select tests to delete (keep one per group).</Typography>
          )}
          {duplicateGroups.map((group, gIdx) => (
            <Box key={gIdx} sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 1 }}>Group {gIdx + 1}</Typography>
              <List dense disablePadding>
                {group.map((t) => (
                  <ListItem key={t.id} disablePadding secondaryAction={
                    <ListItemSecondaryAction>
                      <Checkbox
                        edge="end"
                        checked={idsToDelete.has(t.id)}
                        onChange={() => toggleDuplicateDelete(t.id)}
                        sx={{ color: 'text.secondary' }}
                      />
                    </ListItemSecondaryAction>
                  }>
                    <ListItemText primary={t.title || '—'} secondary={t.id} primaryTypographyProps={{ sx: { color: 'text.primary' } }} secondaryTypographyProps={{ sx: { color: 'text.secondary', fontSize: '0.75rem' } }} />
                  </ListItem>
                ))}
              </List>
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDuplicatesDialogOpen(false)} disabled={duplicatesDeleting} sx={{ color: 'text.secondary' }}>Close</Button>
          <Button onClick={handleDeleteSelectedDuplicates} disabled={idsToDelete.size === 0 || duplicatesDeleting} color="error" variant="contained">Delete selected ({idsToDelete.size})</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
