import { Typography } from '@mui/material';

/**
 * Consistent section title (overline) across workspace screens.
 */
export default function SectionLabel({ children, sx, ...props }) {
  return (
    <Typography
      variant="overline"
      component="div"
      sx={{ color: 'primary.main', letterSpacing: '0.08em', mb: children ? 1 : 0, ...sx }}
      {...props}
    >
      {children}
    </Typography>
  );
}
