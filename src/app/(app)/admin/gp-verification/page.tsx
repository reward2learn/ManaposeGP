'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Alert, Snackbar, CircularProgress, Skeleton,
} from '@mui/material';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';

interface GpRow {
  id: string;
  name: string;
  practiceName: string | null;
  practiceSuburb: string | null;
  practiceState: string | null;
  ahpraNumber: string | null;
  email: string | null;
  verified: boolean;
  verificationStatus: string;
  verificationNotes: string | null;
  createdAt: string;
  indemnityProvider: string | null;
  indemnityExpiryDate: string | null;
}

export default function GpVerificationPage() {
  const [gps, setGps] = useState<GpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GpRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const fetchGps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/gp-verification', { credentials: 'include' });
      const d = await res.json();
      if (d.success) setGps(d.gps as GpRow[]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchGps(); }, [fetchGps]);

  const handleAction = (gp: GpRow, action: 'APPROVED' | 'REJECTED') => {
    setSelected(gp);
    setActionType(action);
    setNotes('');
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/gp-verification', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gpId: selected.id, status: actionType, notes: notes || undefined }),
      });
      const d = await res.json();
      if (d.success) {
        setSnackbar({ message: `GP ${actionType.toLowerCase()} successfully`, severity: 'success' });
        setDialogOpen(false);
        fetchGps();
      } else {
        setSnackbar({ message: d.error ?? 'Failed', severity: 'error' });
      }
    } catch { setSnackbar({ message: 'Network error', severity: 'error' }); }
    finally { setSubmitting(false); }
  };

  const statusChip = (status: string) => {
    const color = status === 'APPROVED' ? 'success' : status === 'REJECTED' ? 'error' : 'warning';
    return <Chip label={status} size="small" color={color} variant="outlined" />;
  };

  return (
    <AuthGate requiredTier="pin" fallback={<SignInPanelGate requiredTier="pin" />}>
      <Box sx={{ maxWidth: 1200, mx: 'auto', px: 3, py: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>GP Verification</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Review and approve GP registrations. Approved GPs gain access to clinical workflows.
        </Typography>

        {loading ? (
          <Stack spacing={2}>{[1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={60} />)}</Stack>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell><TableCell>Practice</TableCell>
                  <TableCell>AHPRA</TableCell><TableCell>Email</TableCell>
                  <TableCell>Indemnity</TableCell><TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {gps.map((gp) => (
                  <TableRow key={gp.id} hover sx={{ bgcolor: gp.verificationStatus === 'PENDING' ? 'warning.50' : undefined }}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{gp.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(gp.createdAt).toLocaleDateString('en-AU')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{gp.practiceName ?? '—'}</Typography>
                      <Typography variant="caption">{gp.practiceSuburb}{gp.practiceState ? `, ${gp.practiceState}` : ''}</Typography>
                    </TableCell>
                    <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{gp.ahpraNumber ?? '—'}</Typography></TableCell>
                    <TableCell>{gp.email ?? '—'}</TableCell>
                    <TableCell>
                      {gp.indemnityProvider ? (
                        <Box>
                          <Typography variant="caption">{gp.indemnityProvider}</Typography>
                          {gp.indemnityExpiryDate && (
                            <Chip label={`Exp: ${gp.indemnityExpiryDate.slice(0, 10)}`} size="small" variant="outlined" sx={{ display: 'block', mt: 0.25 }} />
                          )}
                        </Box>
                      ) : '—'}
                    </TableCell>
                    <TableCell>{statusChip(gp.verificationStatus)}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                        {gp.verificationStatus !== 'APPROVED' && (
                          <Button size="small" color="success" variant="outlined" onClick={() => handleAction(gp, 'APPROVED')}>
                            Approve
                          </Button>
                        )}
                        {gp.verificationStatus !== 'REJECTED' && (
                          <Button size="small" color="error" variant="outlined" onClick={() => handleAction(gp, 'REJECTED')}>
                            Reject
                          </Button>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {gps.length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center"><Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>No GPs registered yet.</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* ── Confirm Dialog ──────────────────────────────────────── */}
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
          <DialogTitle>{actionType === 'APPROVED' ? 'Approve' : 'Reject'} GP — {selected?.name}</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {actionType === 'APPROVED'
                ? 'This GP will gain access to clinical workflows including patient dashboards, consultation notes, prescriptions, and billing.'
                : 'This GP will be rejected and will not have access to clinical features. They can re-register.'}
            </Typography>
            <TextField
              label="Notes (optional)" multiline rows={2} size="small" fullWidth
              value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder={actionType === 'APPROVED' ? 'e.g. AHPRA verified, indemnity confirmed' : 'e.g. Invalid AHPRA number'}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained" color={actionType === 'APPROVED' ? 'success' : 'error'}
              onClick={handleSubmit} disabled={submitting}
            >
              {submitting ? <CircularProgress size={18} /> : actionType === 'APPROVED' ? 'Approve' : 'Reject'}
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar open={!!snackbar} autoHideDuration={4000} onClose={() => setSnackbar(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert severity={snackbar?.severity} onClose={() => setSnackbar(null)} variant="filled">{snackbar?.message}</Alert>
        </Snackbar>
      </Box>
    </AuthGate>
  );
}
