import { Box, Button, Paper } from '@mui/material';
import SectionLabel from '../components/SectionLabel';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import GitHubIcon from '@mui/icons-material/GitHub';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';

export default function WelcomeSidebar({ onOpenFolder, onCloneClick, onCreateProjectClick }) {
  return (
    <Paper
      sx={{
        flex: '0 0 280px',
        p: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <SectionLabel sx={{ mb: 1 }}>Get started</SectionLabel>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Button
          size="small"
          startIcon={<FolderOpenIcon />}
          onClick={onOpenFolder}
          sx={{ color: 'primary.main', justifyContent: 'flex-start' }}
        >
          Open folder
        </Button>
        <Button
          size="small"
          startIcon={<GitHubIcon />}
          onClick={onCloneClick}
          sx={{ color: 'primary.main', justifyContent: 'flex-start' }}
        >
          Clone repository
        </Button>
        <Button
          size="small"
          startIcon={<CreateNewFolderIcon />}
          onClick={onCreateProjectClick}
          sx={{ color: 'primary.main', justifyContent: 'flex-start' }}
        >
          Create new project
        </Button>
      </Box>
    </Paper>
  );
}
