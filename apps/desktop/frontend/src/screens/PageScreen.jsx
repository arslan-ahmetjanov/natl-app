import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TableHead,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import LinkIcon from '@mui/icons-material/Link';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import ParsePageElementsDialog from '../components/ParsePageElementsDialog';

export default function PageScreen({ pageId, page: initialPage, onBack, onRefresh }) {
  const [page, setPage] = useState(initialPage || null);
  const [editingPage, setEditingPage] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [pageSaveLoading, setPageSaveLoading] = useState(false);
  const [parseOptionsOpen, setParseOptionsOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [elementsFilter, setElementsFilter] = useState('');
  const [addElementOpen, setAddElementOpen] = useState(false);
  const [newElTitle, setNewElTitle] = useState('');
  const [newElSelector, setNewElSelector] = useState('');
  const [newElType, setNewElType] = useState('element');
  const [elementsSaving, setElementsSaving] = useState(false);
  const [editingElementId, setEditingElementId] = useState(null);
  const [editElTitle, setEditElTitle] = useState('');
  const [editElSelector, setEditElSelector] = useState('');
  const [editElType, setEditElType] = useState('element');

  useEffect(() => {
    if (!pageId || !window.electronAPI) return;
    window.electronAPI.getPage(pageId).then((data) => setPage(data)).catch(() => setPage(null));
  }, [pageId]);

  const startEditPage = () => {
    setEditTitle(page?.title ?? '');
    setEditUrl(page?.url ?? '');
    setEditingPage(true);
  };

  const handleSavePage = async () => {
    setPageSaveLoading(true);
    try {
      await window.electronAPI.updatePage(pageId, { title: editTitle.trim() || page?.title, url: editUrl.trim() ?? '' });
      setPage((p) => (p ? { ...p, title: editTitle.trim() || p.title, url: editUrl.trim() } : null));
      setEditingPage(false);
      onRefresh?.();
    } catch (e) {
      console.error(e);
    } finally {
      setPageSaveLoading(false);
    }
  };

  const handleDeletePage = async () => {
    setDeleteLoading(true);
    try {
      await window.electronAPI.deletePage(pageId);
      setDeleteConfirmOpen(false);
      onBack?.();
      onRefresh?.();
    } catch (e) {
      console.error(e);
    } finally {
      setDeleteLoading(false);
    }
  };

  const saveElements = async (nextElements) => {
    setElementsSaving(true);
    try {
      await window.electronAPI.updatePage(pageId, { webElements: nextElements });
      setPage((p) => (p ? { ...p, webElements: nextElements } : null));
      onRefresh?.();
    } catch (e) {
      console.error(e);
    } finally {
      setElementsSaving(false);
    }
  };

  const handleAddElement = async () => {
    const title = newElTitle.trim() || 'Element';
    const selector = newElSelector.trim() || '';
    if (!selector) return;
    const next = [...(page?.webElements || []), { id: crypto.randomUUID?.() || `el-${Date.now()}`, title, selector, type: newElType || 'element' }];
    await saveElements(next);
    setAddElementOpen(false);
    setNewElTitle('');
    setNewElSelector('');
    setNewElType('element');
  };

  const handleUpdateElement = (id, patch) => {
    const next = (page?.webElements || []).map((el) => (el.id === id ? { ...el, ...patch } : el));
    saveElements(next);
    setEditingElementId(null);
  };

  const handleRemoveElement = (id) => {
    const next = (page?.webElements || []).filter((el) => el.id !== id);
    saveElements(next);
  };

  const startEditElement = (el) => {
    setEditingElementId(el.id);
    setEditElTitle(el.title || '');
    setEditElSelector(el.selector || '');
    setEditElType(el.type || 'element');
  };

  if (!page) {
    return (
      <Box sx={{ p: 2, color: 'text.secondary' }}>
        <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ color: 'primary.main', mb: 2 }}>Back</Button>
        <Typography>Page not found.</Typography>
      </Box>
    );
  }

  const elements = page.webElements || [];
  const elementsFilterLower = (elementsFilter || '').toLowerCase();
  const filteredElements = elementsFilterLower
    ? elements.filter((el) => (el.title || '').toLowerCase().includes(elementsFilterLower) || (el.selector || '').toLowerCase().includes(elementsFilterLower))
    : elements;

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ color: 'primary.main' }}>Back</Button>
        {editingPage ? (
          <>
            <TextField size="small" placeholder="Title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} sx={{ flex: 1, minWidth: 120, '& .MuiOutlinedInput-root': { color: 'text.primary' } }} />
            <TextField size="small" placeholder="URL" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} sx={{ flex: 1, minWidth: 200, '& .MuiOutlinedInput-root': { color: 'text.primary' } }} />
            <Button size="small" onClick={handleSavePage} disabled={pageSaveLoading} sx={{ color: 'primary.main' }}>Save</Button>
            <Button size="small" onClick={() => setEditingPage(false)} sx={{ color: 'text.secondary' }}>Cancel</Button>
          </>
        ) : (
          <>
            <Typography variant="h6" sx={{ color: 'text.primary', flex: 1 }}>{page.title}</Typography>
            <Button size="small" startIcon={<EditIcon />} onClick={startEditPage} sx={{ color: 'primary.main' }}>Edit</Button>
          </>
        )}
        <Button size="small" startIcon={<DeleteOutlineIcon />} onClick={() => setDeleteConfirmOpen(true)} sx={{ color: 'error.main' }}>
          Delete page
        </Button>
      </Box>
      {!editingPage && (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <LinkIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
        <Typography variant="body2" sx={{ color: 'text.secondary', wordBreak: 'break-all' }}>{page.url || '—'}</Typography>
      </Box>
      )}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshIcon />}
          onClick={() => setParseOptionsOpen(true)}
          sx={{ color: 'primary.main', borderColor: 'primary.main' }}
        >
          Parse/import page elements
        </Button>
      </Box>
      <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1 }}>
          <Typography variant="overline" sx={{ color: 'primary.main' }}>Elements ({elements.length})</Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Search by title or selector"
              value={elementsFilter}
              onChange={(e) => setElementsFilter(e.target.value)}
              sx={{ width: 220, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
            />
            <Button size="small" startIcon={<AddIcon />} onClick={() => setAddElementOpen(true)} disabled={elementsSaving} sx={{ color: 'primary.main' }}>
              Add element
            </Button>
          </Box>
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>Parse page imports from URL. Edit or add elements below.</Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: 'primary.main', borderColor: 'divider' }}>Title</TableCell>
              <TableCell sx={{ color: 'primary.main', borderColor: 'divider' }}>Selector</TableCell>
              <TableCell sx={{ color: 'primary.main', borderColor: 'divider' }}>Type</TableCell>
              <TableCell sx={{ color: 'primary.main', borderColor: 'divider', width: 90 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredElements.length === 0 && (
              <TableRow><TableCell colSpan={4} sx={{ color: 'text.secondary', borderColor: 'divider' }}>{elements.length === 0 ? 'No elements. Parse page or add one.' : 'No elements match the search.'}</TableCell></TableRow>
            )}
            {filteredElements.map((el) => (
              <TableRow key={el.id} sx={{ '& td': { borderColor: 'divider', color: 'text.primary' } }}>
                {editingElementId === el.id ? (
                  <>
                    <TableCell><TextField size="small" fullWidth value={editElTitle} onChange={(e) => setEditElTitle(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { color: 'text.primary' } }} /></TableCell>
                    <TableCell><TextField size="small" fullWidth value={editElSelector} onChange={(e) => setEditElSelector(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { color: 'text.primary' } }} /></TableCell>
                    <TableCell>
                      <TextField size="small" select SelectProps={{ native: true }} value={editElType} onChange={(e) => setEditElType(e.target.value)} sx={{ minWidth: 100, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}>
                        <option value="element">element</option>
                        <option value="button">button</option>
                        <option value="input">input</option>
                        <option value="link">link</option>
                        <option value="textarea">textarea</option>
                        <option value="select">select</option>
                      </TextField>
                    </TableCell>
                    <TableCell>
                      <Button size="small" onClick={() => handleUpdateElement(el.id, { title: editElTitle.trim(), selector: editElSelector.trim(), type: editElType })} sx={{ color: 'primary.main', mr: 0.5 }}>Save</Button>
                      <Button size="small" onClick={() => setEditingElementId(null)} sx={{ color: 'text.secondary' }}>Cancel</Button>
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell>{el.title || '—'}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{el.selector || '—'}</TableCell>
                    <TableCell>{el.type || 'element'}</TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => startEditElement(el)} sx={{ color: 'text.secondary' }}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" onClick={() => { if (window.confirm('Delete this element?')) handleRemoveElement(el.id); }} sx={{ color: 'text.secondary' }}><DeleteOutlineIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={addElementOpen} onClose={() => setAddElementOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: 'background.paper' } }}>
        <DialogTitle sx={{ color: 'text.primary' }}>Add element</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Title" value={newElTitle} onChange={(e) => setNewElTitle(e.target.value)} placeholder="e.g. Login button" sx={{ mt: 1, mb: 2, '& .MuiOutlinedInput-root': { color: 'text.primary' } }} />
          <TextField fullWidth label="Selector" value={newElSelector} onChange={(e) => setNewElSelector(e.target.value)} placeholder="e.g. button[type=submit]" sx={{ mb: 2, '& .MuiOutlinedInput-root': { color: 'text.primary' } }} />
          <TextField fullWidth label="Type" select SelectProps={{ native: true }} value={newElType} onChange={(e) => setNewElType(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { color: 'text.primary' } }}>
            <option value="element">element</option>
            <option value="button">button</option>
            <option value="input">input</option>
            <option value="link">link</option>
            <option value="textarea">textarea</option>
            <option value="select">select</option>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddElementOpen(false)} sx={{ color: 'text.secondary' }}>Cancel</Button>
          <Button onClick={handleAddElement} disabled={elementsSaving || !newElSelector.trim()} variant="contained" sx={{ bgcolor: 'primary.main' }}>Add</Button>
        </DialogActions>
      </Dialog>

      <ParsePageElementsDialog
        open={parseOptionsOpen}
        onClose={() => setParseOptionsOpen(false)}
        onSuccess={() => {
          window.electronAPI.getPage(pageId).then((data) => setPage(data)).catch(() => {});
          onRefresh?.();
        }}
        targetPageId={pageId}
        pages={[page]}
      />

      <Dialog open={deleteConfirmOpen} onClose={() => !deleteLoading && setDeleteConfirmOpen(false)} PaperProps={{ sx: { bgcolor: 'background.paper' } }}>
        <DialogTitle sx={{ color: 'text.primary' }}>Delete page</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'text.primary' }}>
            Delete page &quot;{page.title}&quot;? Tests on this page will remain but will have no page.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)} disabled={deleteLoading} sx={{ color: 'text.secondary' }}>Cancel</Button>
          <Button onClick={handleDeletePage} disabled={deleteLoading} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
