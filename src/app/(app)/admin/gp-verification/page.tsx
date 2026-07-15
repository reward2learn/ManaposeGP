'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Alert, Snackbar, CircularProgress, Skeleton,
  Grid, Divider,
} from '@mui/material';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';

interface GpRow {
  id: string;
  name: string;
  practiceName: string | null;
  practiceAddress: string | null;
  practiceSuburb: string | null;
  practiceState: string | null;
  practicePostcode: string | null;
  practicePhone: string | null;
  ahpraNumber: string | null;
  email: string | null;
  verified: boolean;
  verificationStatus: string;
  verificationNotes: string | null;
  createdAt: string;
  indemnityProvider: string | null;
  indemnityPolicyNumber: string | null;
  indemnityExpiryDate: string | null;
}

interface EditFormData {
  name: string;
  practiceName: string;
  practiceAddress: string;
  practiceSuburb: string;
  practiceState: string;
  practicePostcode: string;
  practicePhone: string;
  ahpraNumber: string;
  email: string;
  indemnityProvider: string;
  indemnityPolicyNumber: string;
  indemnityExpiryDate: string;
}

function emptyEditForm(gp?: GpRow | null): EditFormData {
  return {
    name: gp?.name ?? '',
    practiceName: gp?.practiceName ?? '',
    practiceAddress: gp?.practiceAddress ?? '',
    practiceSuburb: gp?.practiceSuburb ?? '',
    practiceState: gp?.practiceState ?? '',
    practicePostcode: gp?.practicePostcode ?? '',
    practicePhone: gp?.practicePhone ?? '',
    ahpraNumber: gp?.ahpraNumber ?? '',
    email: gp?.email ?? '',
    indemnityProvider: gp?.indemnityProvider ?? '',
    indemnityPolicyNumber: gp?.indemnityPolicyNumber ?? '',
    indemnityExpiryDate: gp?.indemnityExpiryDate ?? '',
  };
}

function detailRow(label: string, value: string | null | undefined, mono = false) {
  return (
    <Grid size={{ xs: 6, sm: 4 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={mono ? { fontFamily: 'monospace' } : undefined}>
        {value || '—'}
      </Typography>
    </Grid>
  );
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

  // ── View Details state ──
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  // ── Edit state ──
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditFormData>(emptyEditForm());
  const [editSubmitting, setEditSubmitting] = useState(false);

  const fetchGps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/gp-verification', { credentials: 'include' });
      const d = await res.json();
      if (d.success) setGps(d.gps as GpRow[]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchGps(); }, [fetchGps]);

  // ── Approve / Reject ──
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

  // ── View Details ──
  const handleViewDetails = (gp: GpRow) => {
    setSelected(gp);
    setViewDialogOpen(true);
  };

  // ── Edit ──
  const handleEditOpen = (gp: GpRow) => {
    setSelected(gp);
    setEditForm(emptyEditForm(gp));
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!selected) return;
    setEditSubmitting(true);
    try {
      const res = await fetch('/api/admin/gp-verification', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gpId: selected.id, ...editForm }),
      });
      const d = await res.json();
      if (d.success) {
        setSnackbar({ message: 'GP details updated successfully', severity: 'success' });
        setEditDialogOpen(false);
        fetchGps();
      } else {
        setSnackbar({ message: d.error ?? 'Edit failed', severity: 'error' });
      }
    } catch { setSnackbar({ message: 'Network error', severity: 'error' }); }
    finally { setEditSubmitting(false); }
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
                      <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end', flexWrap: 'wrap', gap: 0.5 }}>
                        <Button size="small" variant="outlined" onClick={() => handleViewDetails(gp)}>
                          View
                        </Button>
                        <Button size="small" variant="outlined" color="primary" onClick={() => handleEditOpen(gp)}>
                          Edit
                        </Button>
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

        {/* ── View Details Dialog ──────────────────────────────────────── */}
        <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>GP Details — {selected?.name}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              {detailRow('Full Name', selected?.name)}
              {detailRow('AHPRA Number', selected?.ahpraNumber, true)}
              {detailRow('Email', selected?.email)}
              {detailRow('Registration Date', selected?.createdAt ? new Date(selected.createdAt).toLocaleDateString('en-AU') : null)}
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" sx={{ mb: 1 }}>Practice Details</Typography>
            <Grid container spacing={2}>
              {detailRow('Practice Name', selected?.practiceName)}
              {detailRow('Address', selected?.practiceAddress)}
              {detailRow('Suburb', selected?.practiceSuburb)}
              {detailRow('State', selected?.practiceState)}
              {detailRow('Postcode', selected?.practicePostcode)}
              {detailRow('Phone', selected?.practicePhone)}
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" sx={{ mb: 1 }}>Indemnity Insurance</Typography>
            <Grid container spacing={2}>
              {detailRow('Provider', selected?.indemnityProvider)}
              {detailRow('Policy Number', selected?.indemnityPolicyNumber)}
              {detailRow('Expiry Date', selected?.indemnityExpiryDate?.slice(0, 10))}
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" sx={{ mb: 1 }}>Verification</Typography>
            <Grid container spacing={2}>
              <Grid size={6}>
                <Typography variant="caption" color="text.secondary">Status</Typography>
                <Box sx={{ mt: 0.5 }}>{selected && statusChip(selected.verificationStatus)}</Box>
              </Grid>
              {detailRow('Notes', selected?.verificationNotes)}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* ── Edit Dialog ──────────────────────────────────────── */}
        <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Edit GP — {selected?.name}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid size={12}>
                <TextField
                  label="Full Name" size="small" fullWidth
                  value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  label="Practice Name" size="small" fullWidth
                  value={editForm.practiceName} onChange={(e) => setEditForm((f) => ({ ...f, practiceName: e.target.value }))}
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  label="Practice Address" size="small" fullWidth
                  value={editForm.practiceAddress} onChange={(e) => setEditForm((f) => ({ ...f, practiceAddress: e.target.value }))}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="Practice Suburb" size="small" fullWidth
                  value={editForm.practiceSuburb} onChange={(e) => setEditForm((f) => ({ ...f, practiceSuburb: e.target.value }))}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="Practice State" size="small" fullWidth
                  value={editForm.practiceState} onChange={(e) => setEditForm((f) => ({ ...f, practiceState: e.target.value }))}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="Practice Postcode" size="small" fullWidth
                  value={editForm.practicePostcode} onChange={(e) => setEditForm((f) => ({ ...f, practicePostcode: e.target.value }))}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="Practice Phone" size="small" fullWidth
                  value={editForm.practicePhone} onChange={(e) => setEditForm((f) => ({ ...f, practicePhone: e.target.value }))}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="AHPRA Number" size="small" fullWidth
                  value={editForm.ahpraNumber} onChange={(e) => setEditForm((f) => ({ ...f, ahpraNumber: e.target.value }))}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="Email" size="small" fullWidth type="email"
                  value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                />
              </Grid>
              <Grid size={12}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Indemnity Insurance</Typography>
              </Grid>
              <Grid size={6}>
                <TextField
                  label="Indemnity Provider" size="small" fullWidth
                  value={editForm.indemnityProvider} onChange={(e) => setEditForm((f) => ({ ...f, indemnityProvider: e.target.value }))}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="Indemnity Policy Number" size="small" fullWidth
                  value={editForm.indemnityPolicyNumber} onChange={(e) => setEditForm((f) => ({ ...f, indemnityPolicyNumber: e.target.value }))}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="Indemnity Expiry Date" size="small" fullWidth
                  value={editForm.indemnityExpiryDate} onChange={(e) => setEditForm((f) => ({ ...f, indemnityExpiryDate: e.target.value }))}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleEditSubmit} disabled={editSubmitting}>
              {editSubmitting ? <CircularProgress size={18} /> : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>

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
