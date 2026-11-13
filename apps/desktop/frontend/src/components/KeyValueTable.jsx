import { Box, Button, IconButton, TextField } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

const emptyRow = () => ({ key: '', value: '' });

/**
 * Generic editable key/value rows (headers, query params, form fields).
 */
export default function KeyValueTable({
  rows,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  addLabel = 'Add row',
  size = 'small',
}) {
  const list = Array.isArray(rows) && rows.length > 0 ? rows : [emptyRow()];

  const updateRow = (index, field, val) => {
    const next = list.map((r, j) => (j === index ? { ...r, [field]: val } : r));
    onChange(next);
  };

  const removeRow = (index) => {
    const filtered = list.filter((_, j) => j !== index);
    onChange(filtered.length ? filtered : [emptyRow()]);
  };

  const addRow = () => {
    onChange([...list, emptyRow()]);
  };

  return (
    <Box>
      {list.map((row, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
          <TextField
            size={size}
            placeholder={keyPlaceholder}
            value={row.key ?? ''}
            onChange={(e) => updateRow(i, 'key', e.target.value)}
            sx={{ flex: 1, minWidth: 0, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
          />
          <TextField
            size={size}
            placeholder={valuePlaceholder}
            value={row.value ?? ''}
            onChange={(e) => updateRow(i, 'value', e.target.value)}
            sx={{ flex: 1, minWidth: 0, '& .MuiOutlinedInput-root': { color: 'text.primary' } }}
          />
          <IconButton size="small" onClick={() => removeRow(i)} sx={{ color: 'text.secondary' }}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Button size="small" startIcon={<AddIcon />} onClick={addRow} sx={{ color: 'primary.main', mt: 0.5 }}>
        {addLabel}
      </Button>
    </Box>
  );
}
