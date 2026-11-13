import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  TextField,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ScreenHeader from '../components/ScreenHeader';
import SectionLabel from '../components/SectionLabel';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';

function genId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function VariablesScreen({ onBack }) {
  const [variables, setVariables] = useState([]);
  const [saving, setSaving] = useState(false);
  const [generatingId, setGeneratingId] = useState(null);

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.getVariables()
      .then((data) => setVariables((data || []).map((x) => ({ ...x, id: x.id || genId() }))))
      .catch(() => setVariables([]));
  }, []);

  const handleAdd = () => {
    setVariables((v) => [...v, { id: genId(), name: '', value: '' }]);
  };

  const handleChange = (id, field, value) => {
    setVariables((v) => v.map((x) => (x.id === id ? { ...x, [field]: value } : x)));
  };

  const handleRemove = (id) => {
    setVariables((v) => v.filter((x) => x.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const list = variables.filter((x) => x.name != null && String(x.name).trim() !== '');
      const normalized = list.map((x) => ({
        id: x.id || genId(),
        name: String(x.name).trim(),
        value: x.value != null ? String(x.value) : '',
        valuePattern: x.valuePattern != null && String(x.valuePattern).trim() !== '' ? String(x.valuePattern).trim() : undefined,
      }));
      await window.electronAPI.updateVariables(normalized);
      setVariables(normalized);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateFromPattern = async (id) => {
    const row = variables.find((x) => x.id === id);
    if (!row?.valuePattern?.trim() || !window.electronAPI?.generateVariableFromPattern) return;
    setGeneratingId(id);
    try {
      const value = await window.electronAPI.generateVariableFromPattern(row.valuePattern);
      handleChange(id, 'value', value);
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <ScreenHeader
        title="Variables"
        onBack={onBack}
        actions={
          <>
            <Button size="small" startIcon={<AddIcon />} onClick={handleAdd} sx={{ color: 'primary.main' }}>Add</Button>
            <Button size="small" variant="outlined" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving} sx={{ color: 'primary.main' }}>Save</Button>
          </>
        }
      />
      <SectionLabel sx={{ mb: 0.5 }}>Workspace variables</SectionLabel>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Use in steps as <code style={{ background: 'action.hover', padding: '2px 6px', borderRadius: 4 }}>{'{{variableName}}'}</code>. Optional pattern (regex): when set, the value is regenerated from that pattern on every test run; use Generate to preview a sample value.
      </Typography>
      <TableContainer component={Paper} sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: 'primary.main' }}>Name</TableCell>
              <TableCell sx={{ color: 'primary.main' }}>Value</TableCell>
              <TableCell sx={{ color: 'primary.main' }}>Pattern (regex)</TableCell>
              <TableCell width={120} />
            </TableRow>
          </TableHead>
          <TableBody>
            {variables.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} sx={{ color: 'text.secondary' }}>No variables. Click Add to create one.</TableCell>
              </TableRow>
            )}
            {variables.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <TextField
                    size="small"
                    placeholder="name"
                    value={row.name ?? ''}
                    onChange={(e) => handleChange(row.id, 'name', e.target.value)}
                    sx={{ width: '100%', maxWidth: 200, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    type="password"
                    placeholder="value"
                    value={row.value ?? ''}
                    onChange={(e) => handleChange(row.id, 'value', e.target.value)}
                    autoComplete="new-password"
                    sx={{ width: '100%', '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    placeholder="e.g. [a-z]{5}"
                    value={row.valuePattern ?? ''}
                    onChange={(e) => handleChange(row.id, 'valuePattern', e.target.value)}
                    sx={{ width: '100%', maxWidth: 180, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
                  />
                </TableCell>
                <TableCell>
                  <Button size="small" disabled={!row.valuePattern?.trim() || generatingId === row.id} onClick={() => handleGenerateFromPattern(row.id)} sx={{ color: 'primary.main', mr: 0.5 }}>
                    {generatingId === row.id ? '…' : 'Generate'}
                  </Button>
                  <IconButton size="small" onClick={() => handleRemove(row.id)} sx={{ color: 'text.secondary' }}><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
