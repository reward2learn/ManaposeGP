'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, MenuItem, Select, FormControl, InputLabel, Snackbar, Alert,
  CircularProgress, Skeleton,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';

interface PatientRow {
  id: string;
  userId: string;
  dateOfBirth: string | null;
  sexAtBirth: string | null;
  menopauseStatus: string | null;
  gpId: string | null;
  gpName: string | null;
  userEmail: string | null;
  createdAt: string;
}

interface GpOption {
  id: string;
  name: string;
}

async function api(url: string, opts?: RequestInit) {
  const res = await fetch(url, { credentials: 'include', ...opts });
  return res.json();
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [gps, setGps] = useState<GpOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState<{ m: string; s: 'success' | 'error' } | null>(null);

  // Assign dialog state
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientRow | null>(null);
  const [selectedGpId, setSelectedGpId] = useState('');
  const [saving, setSaving] = useState(false);

  // Details dialog state
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsPatient, setDetailsPatient] = useState<PatientRow | null>(null);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    const d = await api('/api/admin/patients');
    if (d.success) setPatients(d.patients as PatientRow[]);
    setLoading(false);
  }, []);

  const fetchApprovedGps = useCallback(async () => {
    const d = await api('/api/admin/gp-verification');
    if (d.success && Array.isArray(d.gps)) {
      const approved = (d.gps as Array<{ id: string; name: string; verified: boolean; verificationStatus: string }>)
        .filter((g) => g.verified || g.verificationStatus === 'APPROVED')
        .map((g) => ({ id: g.id, name: g.name }));
      setGps(approved);
    }
  }, []);

  useEffect(() => { fetchPatients(); fetchApprovedGps(); }, [fetchPatients, fetchApprovedGps]);

  const openAssign = (patient: PatientRow) => {
    setSelectedPatient(patient);
    setSelectedGpId(patient.gpId ?? '');
    setAssignOpen(true);
  };

  const handleAssign = async () => {
    if (!selectedPatient) return;
    setSaving(true);
    const d = await api('/api/admin/patients', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: selectedPatient.id, gpId: selectedGpId || undefined }),
    });
    if (d.success) {
      setPatients((prev) => prev.map((p) =>
        p.id === selectedPatient.id
          ? { ...p, gpId: selectedGpId || null, gpName: selectedGpId ? (gps.find((g) => g.id === selectedGpId)?.name ?? p.gpName) : null }
          : p,
      ));
      setSnack({ m: d.message ?? 'Assignment updated', s: 'success' });
      setAssignOpen(false);
    } else {
      setSnack({ m: d.error ?? 'Failed', s: 'error' });
    }
    setSaving(false);
  };

  const handleUnassign = async (patient: PatientRow) => {
    setSaving(true);
    const d = await api('/api/admin/patients', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: patient.id }),
    });
    if (d.success) {
      setPatients((prev) => prev.map((p) =>
        p.id === patient.id ? { ...p, gpId: null, gpName: null } : p,
      ));
      setSnack({ m: d.message ?? 'Patient unassigned', s: 'success' });
    } else {
      setSnack({ m: d.error ?? 'Failed', s: 'error' });
    }
    setSaving(false);
  };

  const openDetails = (patient: PatientRow) => {
    setDetailsPatient(patient);
    setDetailsOpen(true);
  };

  const truncate = (s: string, len = 8) => s.length > len ? `${s.slice(0, len)}…` : s;

  return (
    <AuthGate requiredTier="pin" fallback={<SignInPanelGate requiredTier="pin" />}>
      <Box sx={{ maxWidth: 1200, mx: 'auto', px: 3, py: 3 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 3 }}>
          <PeopleIcon color="primary" fontSize="large" />
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Patient Management</Typography>
        </Stack>

        {loading ? (
          <Skeleton variant="rounded" height={400} />
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Patient ID</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Date of Birth</TableCell>
                  <TableCell>Sex</TableCell>
                  <TableCell>Menopause Status</TableCell>
                  <TableCell>Assigned GP</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {patients.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {truncate(p.id)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{p.userEmail ?? '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {p.dateOfBirth ? new Date(p.dateOfBirth).toLocaleDateString('en-AU') : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={p.sexAtBirth ?? '—'}
                        size="small"
                        variant="outlined"
                        color={p.sexAtBirth === 'FEMALE' ? 'secondary' : p.sexAtBirth === 'MALE' ? 'primary' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={p.menopauseStatus ?? '—'}
                        size="small"
                        variant="outlined"
                        color={p.menopauseStatus ? 'warning' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      {p.gpName ? (
                        <Chip
                          label={p.gpName}
                          size="small"
                          color="success"
                          onDelete={() => handleUnassign(p)}
                          deleteIcon={<CircularProgress size={12} />}
                        />
                      ) : (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => openAssign(p)}
                          disabled={saving}
                        >
                          Assign GP
                        </Button>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                        <Button size="small" variant="outlined" onClick={() => openDetails(p)}>
                          View Details
                        </Button>
                        {p.gpName && (
                          <Button
                            size="small"
                            variant="text"
                            color="warning"
                            onClick={() => openAssign(p)}
                            disabled={saving}
                          >
                            Reassign
                          </Button>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {patients.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography color="text.secondary" sx={{ py: 3 }}>
                        No patients found.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Assign GP Dialog */}
        <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>
            {selectedPatient?.gpName ? 'Reassign GP' : 'Assign GP'} for{' '}
            {selectedPatient?.userEmail ?? truncate(selectedPatient?.id ?? '')}
          </DialogTitle>
          <DialogContent>
            <FormControl fullWidth sx={{ mt: 1 }}>
              <InputLabel>Select GP</InputLabel>
              <Select
                value={selectedGpId}
                label="Select GP"
                onChange={(e) => setSelectedGpId(e.target.value)}
              >
                <MenuItem value="">
                  <em>Unassigned</em>
                </MenuItem>
                {gps.map((g) => (
                  <MenuItem key={g.id} value={g.id}>
                    {g.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {gps.length === 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                No approved GPs available. Verify GPs in{' '}
                <strong>GP Verification</strong> first.
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAssignOpen(false)} disabled={saving}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleAssign}
              disabled={saving || (!!selectedPatient?.gpId && selectedGpId === selectedPatient.gpId)}
            >
              {saving ? <CircularProgress size={18} /> : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* View Details Dialog */}
        <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Patient Details</DialogTitle>
          <DialogContent dividers>
            {detailsPatient && (
              <Stack spacing={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Patient ID</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{detailsPatient.id}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">User ID</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{detailsPatient.userId}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Email</Typography>
                  <Typography variant="body2">{detailsPatient.userEmail ?? '—'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Date of Birth</Typography>
                  <Typography variant="body2">
                    {detailsPatient.dateOfBirth ? new Date(detailsPatient.dateOfBirth).toLocaleDateString('en-AU') : '—'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Sex at Birth</Typography>
                  <Typography variant="body2">{detailsPatient.sexAtBirth ?? '—'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Menopause Status</Typography>
                  <Typography variant="body2">{detailsPatient.menopauseStatus ?? '—'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Assigned GP</Typography>
                  <Typography variant="body2">
                    {detailsPatient.gpName ? (
                      <Chip label={detailsPatient.gpName} size="small" color="success" />
                    ) : (
                      <Chip label="Unassigned" size="small" variant="outlined" />
                    )}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Created At</Typography>
                  <Typography variant="body2">
                    {new Date(detailsPatient.createdAt).toLocaleDateString('en-AU', { dateStyle: 'long' })}
                  </Typography>
                </Box>
              </Stack>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDetailsOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={!!snack}
          autoHideDuration={4000}
          onClose={() => setSnack(null)}
        >
          <Alert severity={snack?.s} onClose={() => setSnack(null)} variant="filled">
            {snack?.m}
          </Alert>
        </Snackbar>
      </Box>
    </AuthGate>
  );
}
