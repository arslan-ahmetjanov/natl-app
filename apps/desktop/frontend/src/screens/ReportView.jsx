import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Chip,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import ScreenHeader from '../components/ScreenHeader';
import SectionLabel from '../components/SectionLabel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ScheduleIcon from '@mui/icons-material/Schedule';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ScreenshotGallery from '../components/ScreenshotGallery';

function StepScreenshot({ reportId, filename, alt, onOpenGallery }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    if (!reportId || !filename || !window.electronAPI) return;
    window.electronAPI.reportsGetScreenshot(reportId, filename).then((base64) => {
      if (base64) setSrc(`data:image/png;base64,${base64}`);
    }).catch(() => {});
  }, [reportId, filename]);
  if (!src) return null;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box
        component="img"
        alt={alt}
        src={src}
        sx={{ width: 120, height: 68, objectFit: 'cover', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}
      />
      {onOpenGallery && (
        <Button size="small" onClick={onOpenGallery} sx={{ color: 'success.main' }}>
          Open screenshot
        </Button>
      )}
    </Box>
  );
}

function ApiStepRequestResponse({ step }) {
  const [requestOpen, setRequestOpen] = useState(true);
  const [responseOpen, setResponseOpen] = useState(true);
  const req = step.request;
  const res = step.response;
  if (!req && !res) return null;
  const formatBody = (body) => {
    if (body == null || body === '') return '—';
    if (typeof body === 'object') return JSON.stringify(body, null, 2);
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return String(body);
    }
  };
  return (
    <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {req && (
        <Paper variant="outlined" sx={{ bgcolor: 'action.hover', p: 1 }}>
          <Button size="small" onClick={() => setRequestOpen((o) => !o)} sx={{ color: 'primary.main', textTransform: 'none' }}>
            Request: {req.method} {req.url}
          </Button>
          <Collapse in={requestOpen}>
            <Box component="pre" sx={{ fontSize: '0.75rem', color: 'text.primary', overflow: 'auto', maxHeight: 200, mt: 0.5 }}>
              {req.headers && Object.keys(req.headers).length > 0 && (
                <Box sx={{ mb: 0.5 }}>Headers: {JSON.stringify(req.headers, null, 2)}</Box>
              )}
              {req.body != null && <Box>Body: {formatBody(req.body)}</Box>}
            </Box>
          </Collapse>
        </Paper>
      )}
      {res && (
        <Paper variant="outlined" sx={{ bgcolor: 'action.hover', p: 1 }}>
          <Button size="small" onClick={() => setResponseOpen((o) => !o)} sx={{ color: 'primary.main', textTransform: 'none' }}>
            Response: {res.status}
          </Button>
          <Collapse in={responseOpen}>
            <Box component="pre" sx={{ fontSize: '0.75rem', color: 'text.primary', overflow: 'auto', maxHeight: 200, mt: 0.5 }}>
              {res.headers && Object.keys(res.headers).length > 0 && (
                <Box sx={{ mb: 0.5 }}>Headers: {JSON.stringify(res.headers, null, 2)}</Box>
              )}
              {res.body != null && <Box>Body: {formatBody(res.body)}</Box>}
            </Box>
          </Collapse>
        </Paper>
      )}
    </Box>
  );
}

export default function ReportView({ reportId: initialReportId, onBack, onRefresh }) {
  const [reportId, setReportId] = useState(initialReportId || null);
  const [report, setReport] = useState(null);
  const [reportsList, setReportsList] = useState([]);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState([]);
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (initialReportId) setReportId(initialReportId);
  }, [initialReportId]);

  const refreshReportsList = useCallback(async () => {
    if (!window.electronAPI) return [];
    const list = await window.electronAPI.reportsList(null).catch(() => []);
    setReportsList(list);
    return list;
  }, []);

  useEffect(() => {
    refreshReportsList();
  }, [refreshReportsList]);

  useEffect(() => {
    if (reportsList.length > 0 && !reportId) setReportId(reportsList[0].id);
  }, [reportsList, reportId]);

  useEffect(() => {
    if (!reportId || !window.electronAPI) return;
    window.electronAPI.reportsGet(reportId).then(setReport).catch(() => setReport(null));
  }, [reportId]);

  const handleSelectReport = (id) => {
    setReportId(id);
    window.electronAPI?.reportsGet(id).then(setReport).catch(() => setReport(null));
  };

  const handleConfirmDelete = async () => {
    if (!reportId || !window.electronAPI?.reportsDelete) return;
    const idToRemove = reportId;
    setDeleting(true);
    try {
      await window.electronAPI.reportsDelete(idToRemove);
      const list = await window.electronAPI.reportsList(null).catch(() => []);
      setReportsList(list);
      const nextId = list[0]?.id ?? null;
      if (nextId) {
        setReportId(nextId);
        const nextReport = await window.electronAPI.reportsGet(nextId).catch(() => null);
        setReport(nextReport);
      } else {
        setReportId(null);
        setReport(null);
      }
      setDeleteDialogOpen(false);
      onRefresh?.();
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
    }
  };

  const openScreenshotGallery = useCallback(async (stepIndex) => {
    if (!reportId || !report?.steps || !window.electronAPI) return;
    const stepsWithScreenshots = report.steps
      .map((s, i) => (s.screenshotPath ? i : null))
      .filter((i) => i != null);
    const galleryIndex = stepsWithScreenshots.indexOf(stepIndex);
    if (galleryIndex < 0) return;
    const filenames = stepsWithScreenshots.map((i) => report.steps[i].screenshotPath);
    const urls = await Promise.all(
      filenames.map((f) =>
        window.electronAPI.reportsGetScreenshot(reportId, f).then((b64) => (b64 ? `data:image/png;base64,${b64}` : null))
      )
    );
    setGalleryImages(urls.filter(Boolean));
    setGalleryInitialIndex(galleryIndex);
    setGalleryOpen(true);
  }, [reportId, report?.steps]);

  const reportStatus = report && (report.status === true || report.status === 'passed' ? 'passed' : 'failed');
  const stepStatus = (s) => (s.status === true || s.status === 'passed' ? 'passed' : 'failed');

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <ScreenHeader title="Reports" onBack={onBack} />
      <Box sx={{ display: 'flex', gap: 2, flex: 1, minHeight: 0 }}>
        <Paper sx={{ width: 280, p: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
          <SectionLabel sx={{ mb: 0.5 }}>Recent</SectionLabel>
          <List dense>
            {reportsList.length === 0 && <ListItem><ListItemText primary="No reports" sx={{ color: 'text.secondary' }} /></ListItem>}
            {reportsList.map((r) => (
              <ListItem key={r.id} disablePadding>
                <ListItemButton selected={r.id === reportId} onClick={() => handleSelectReport(r.id)} dense>
                  <ListItemText
                    primary={r.testTitle || r.testId}
                    secondary={r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}
                    primaryTypographyProps={{ sx: { color: 'text.primary', fontSize: '0.9rem' } }}
                    secondaryTypographyProps={{ sx: { color: 'text.secondary', fontSize: '0.75rem' } }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Paper>
        <Paper sx={{ flex: 1, p: 2, overflow: 'auto', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
          {!report && <Typography sx={{ color: 'text.secondary' }}>Select a report</Typography>}
          {report && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap', width: '100%' }}>
                <Typography variant="h6" sx={{ color: 'text.primary' }}>{report.testTitle || report.testId}</Typography>
                <Chip
                  size="small"
                  icon={reportStatus === 'passed' ? <CheckCircleIcon /> : <ErrorIcon />}
                  label={reportStatus}
                  sx={{
                    bgcolor: reportStatus === 'passed' ? 'action.hover' : 'action.hover',
                    color: reportStatus === 'passed' ? 'success.main' : 'error.main',
                  }}
                />
                {report.executionTime != null && (
                  <Chip size="small" icon={<ScheduleIcon />} label={`${report.executionTime}ms`} sx={{ color: 'text.secondary' }} />
                )}
                <Button
                  size="small"
                  color="error"
                  variant="outlined"
                  startIcon={<DeleteOutlineIcon />}
                  onClick={() => setDeleteDialogOpen(true)}
                  sx={{ ml: 'auto' }}
                >
                  Delete report
                </Button>
              </Box>
              <SectionLabel sx={{ mt: 1, mb: 1 }}>Step timeline</SectionLabel>
              <Box sx={{ pl: 0.5 }}>
                {(report.steps || []).map((step, i) => {
                  const ok = stepStatus(step) === 'passed';
                  const isLast = i === (report.steps || []).length - 1;
                  return (
                    <Box
                      key={i}
                      sx={{
                        display: 'flex',
                        gap: 1.5,
                        pb: isLast ? 0 : 2,
                        position: 'relative',
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          width: 28,
                          flexShrink: 0,
                        }}
                      >
                        <Box
                          sx={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: ok ? 'success.dark' : 'error.dark',
                            color: 'background.paper',
                          }}
                        >
                          {ok ? <CheckCircleIcon sx={{ fontSize: 18 }} /> : <ErrorIcon sx={{ fontSize: 18 }} />}
                        </Box>
                        {!isLast && (
                          <Box
                            sx={{
                              flex: 1,
                              width: 2,
                              minHeight: 16,
                              mt: 0.5,
                              bgcolor: 'divider',
                            }}
                          />
                        )}
                      </Box>
                      <Paper
                        variant="outlined"
                        sx={{
                          flex: 1,
                          minWidth: 0,
                          p: 1.5,
                          borderColor: 'divider',
                          bgcolor: 'action.hover',
                        }}
                      >
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                          Step {i + 1}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.primary', mt: 0.25 }}>
                          {step.value != null ? step.value : `Step ${i + 1}`}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ color: step.error ? 'error.main' : 'text.secondary', display: 'block', mt: 0.5 }}
                        >
                          {step.error || (ok ? 'Passed' : 'Failed')}
                        </Typography>
                        {(step.request || step.response) && <ApiStepRequestResponse step={step} />}
                        {step.screenshotPath && reportId && (
                          <Box sx={{ mt: 1 }}>
                            <StepScreenshot
                              reportId={reportId}
                              filename={step.screenshotPath}
                              alt={`Step ${i + 1}`}
                              onOpenGallery={() => openScreenshotGallery(i)}
                            />
                          </Box>
                        )}
                      </Paper>
                    </Box>
                  );
                })}
              </Box>
            </>
          )}
        </Paper>
      </Box>
      {galleryOpen && galleryImages.length > 0 && (
        <ScreenshotGallery
          images={galleryImages}
          initialIndex={galleryInitialIndex}
          onClose={() => setGalleryOpen(false)}
        />
      )}
      <Dialog open={deleteDialogOpen} onClose={() => !deleting && setDeleteDialogOpen(false)}>
        <DialogTitle sx={{ color: 'text.primary' }}>Delete this report?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.secondary' }}>
            This removes the report file and any stored screenshots. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained" disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
