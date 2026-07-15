'use client';

import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';
import { PopulationHealthPanel } from '@/components/health/population-health-panel';

interface PatientSummary {
  profileId: string;
  consentType: string;
  menopauseStatus?: string;
  age?: number;
}

interface Appointment {
  id: string;
  healthProfileId: string;
  date: string;
  timeSlot: string;
  durationMinutes: number;
  type: string;
  status: string;
  reason: string | null;
}

type ApptFilter = 'today' | 'week' | 'all';

export default function GpDashboardPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppts, setLoadingAppts] = useState(false);
  const [apptFilter, setApptFilter] = useState<ApptFilter>('week');

  const fetchPatients = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/gp/patients', { credentials: 'include' });
      const data = await res.json();
      if (data.success) setPatients(data.patients ?? []);
      else setError(data.error);
    } catch { setError('Failed to load patient list'); }
    finally { setLoading(false); }
  }, []);

  const fetchAppointments = useCallback(async () => {
    setLoadingAppts(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const params = new URLSearchParams();
      if (apptFilter === 'today') { params.set('from', today); params.set('to', today); }
      else if (apptFilter === 'week') {
        const d = new Date();
        const end = new Date(d);
        end.setDate(d.getDate() + 7);
        params.set('from', today);
        params.set('to', end.toISOString().slice(0, 10));
      }
      params.set('status', 'BOOKED');
      const res = await fetch(`/api/gp/appointments?${params.toString()}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) setAppointments(data.appointments ?? []);
    } catch { /* silently fail */ }
    finally { setLoadingAppts(false); }
  }, [apptFilter]);

  useEffect(() => { fetchPatients(); }, [fetchPatients]);
  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  const getStatusChip = (status: string) => {
    const colors: Record<string, 'info' | 'success' | 'error' | 'warning'> = {
      BOOKED: 'info', CONFIRMED: 'success', CANCELLED: 'error',
      COMPLETED: 'success', NO_SHOW: 'error',
    };
    return <Chip label={status.replace('_', ' ')} size="small" color={colors[status] ?? 'default'} variant="outlined" />;
  };

  return (
    <AuthGate requiredTier="pin" fallback={<SignInPanelGate requiredTier="pin" />}>
      <Box sx={{ mx: 'auto', px: 3, py: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }}>Clinical Dashboard</Typography>
        <Stack spacing={3}>
          {/* ── Appointments ──────────────────────────────────────────── */}
          <Paper sx={{ p: 3 }}>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="h6">Appointments ({appointments.length})</Typography>
              <ToggleButtonGroup value={apptFilter} exclusive onChange={(_, v) => v && setApptFilter(v)} size="small">
                <ToggleButton value="today">Today</ToggleButton>
                <ToggleButton value="week">This Week</ToggleButton>
                <ToggleButton value="all">All</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
            {loadingAppts ? (
              <Stack spacing={1}>{[1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={48} />)}</Stack>
            ) : appointments.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                No upcoming appointments.
              </Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell><TableCell>Time</TableCell><TableCell>Patient</TableCell>
                      <TableCell>Type</TableCell><TableCell>Duration</TableCell><TableCell>Reason</TableCell>
                      <TableCell>Status</TableCell><TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {appointments.map((a) => (
                      <TableRow key={a.id} hover>
                        <TableCell>{new Date(a.date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}</TableCell>
                        <TableCell>{a.timeSlot}</TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                            {a.healthProfileId.slice(0, 8)}...
                          </Typography>
                        </TableCell>
                        <TableCell><Chip label={a.type.replace('_', ' ')} size="small" variant="outlined" /></TableCell>
                        <TableCell>{a.durationMinutes} min</TableCell>
                        <TableCell sx={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.reason ?? '—'}
                        </TableCell>
                        <TableCell>{getStatusChip(a.status)}</TableCell>
                        <TableCell align="right">
                          <Button
                            size="small" variant="contained"
                            onClick={() => router.push(`/gp-consult?patientId=${a.healthProfileId}` as Route)}
                            disabled={a.status !== 'BOOKED' && a.status !== 'CONFIRMED'}
                          >
                            Start Consult
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>

          {/* ── Population Analytics ──────────────────────────────────── */}
          <PopulationHealthPanel />

          {/* ── Patient List ──────────────────────────────────────────── */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Your Patients ({patients.length})</Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" onClick={fetchPatients}>Retry</Button>}>{error}</Alert>}
            {loading ? (
              <Grid container spacing={2}>
                {[1, 2, 3].map((i) => (
                  <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
                    <Skeleton variant="rounded" height={120} />
                  </Grid>
                ))}
              </Grid>
            ) : patients.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                No consented patients yet.
              </Typography>
            ) : (
              <Grid container spacing={2}>
                {patients.map((p) => (
                  <Grid key={p.profileId} size={{ xs: 12, sm: 6, md: 4 }}>
                    <Card
                      variant="outlined"
                      sx={{ cursor: 'pointer', '&:hover': { borderColor: 'primary.main' } }}
                      onClick={() => router.push(`/gp-consult?patientId=${p.profileId}` as Route)}
                    >
                      <CardContent>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          Patient {p.profileId.slice(0, 8)}...
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
                          {p.menopauseStatus && <Chip label={p.menopauseStatus.replace('_', ' ')} size="small" color="primary" variant="outlined" />}
                          {p.age && <Chip label={`Age ${p.age}`} size="small" variant="outlined" />}
                          <Chip label={p.consentType.replace('_', ' ')} size="small" color="success" variant="outlined" />
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Paper>
        </Stack>
      </Box>
    </AuthGate>
  );
}
