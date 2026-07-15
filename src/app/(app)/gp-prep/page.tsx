'use client';

import { useState, useCallback, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';

interface GpInfo {
  id: string;
  name: string;
  practiceName: string | null;
  practiceSuburb: string | null;
}

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00',
];

const DURATIONS = [15, 30, 45, 60];
const APPT_TYPES = ['IN_PERSON', 'TELEHEALTH', 'PHONE'] as const;

const todayISO = new Date().toISOString().slice(0, 10);

export default function GpPrepPage() {
  // ── GP Summary ──────────────────────────────────────────────────────
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // ── Booking ──────────────────────────────────────────────────────────
  const [gps, setGps] = useState<GpInfo[]>([]);
  const [loadingGps, setLoadingGps] = useState(true);
  const [selectedGpId, setSelectedGpId] = useState('');
  const [bookingDate, setBookingDate] = useState(todayISO);
  const [timeSlot, setTimeSlot] = useState('');
  const [duration, setDuration] = useState(15);
  const [apptType, setApptType] = useState<string>('IN_PERSON');
  const [reason, setReason] = useState('');
  const [booking, setBooking] = useState(false);
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const checklistItems = [
    { key: 'symptoms', label: 'Tracked symptoms for 30+ days', done: true },
    { key: 'severity', label: 'Completed symptom severity log', done: true },
    { key: 'concerns', label: 'Noted top 3 concerns for GP', done: false },
    { key: 'medications', label: 'Listed current medications', done: false },
    { key: 'family', label: 'Recorded family health history', done: false },
    { key: 'questions', label: 'Prepared questions for GP', done: false },
  ];

  // ── Load GPs ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/gp/list', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (d.success) setGps(d.gps as GpInfo[]); })
      .finally(() => setLoadingGps(false));
  }, []);

  // ── Generate summary ─────────────────────────────────────────────────
  const generateSummary = useCallback(async () => {
    setSummaryLoading(true); setSummaryError(null);
    try {
      const res = await fetch('/api/health/export/summary?format=json', { credentials: 'include' });
      const data = await res.json();
      if (data.success) setSummary(JSON.stringify(data.summary, null, 2));
      else setSummaryError(data.error || 'Failed to generate summary');
    } catch { setSummaryError('Network error. Please try again.'); }
    finally { setSummaryLoading(false); }
  }, []);

  // ── Book appointment ─────────────────────────────────────────────────
  const handleBook = useCallback(async () => {
    if (!selectedGpId || !timeSlot) {
      setSnackbar({ message: 'Please select a GP and time slot', severity: 'error' });
      return;
    }
    setBooking(true);
    try {
      const res = await fetch('/api/gp/appointments', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          healthProfileId: '', // filled server-side from session
          gpId: selectedGpId,
          date: bookingDate,
          timeSlot,
          durationMinutes: duration,
          type: apptType,
          reason: reason || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSnackbar({ message: `Appointment booked for ${bookingDate} at ${timeSlot}`, severity: 'success' });
        setTimeSlot(''); setReason('');
      } else {
        setSnackbar({ message: data.error ?? 'Booking failed', severity: 'error' });
      }
    } catch {
      setSnackbar({ message: 'Network error', severity: 'error' });
    } finally { setBooking(false); }
  }, [selectedGpId, timeSlot, bookingDate, duration, apptType, reason]);

  return (
    <AuthGate requiredTier="google" fallback={<SignInPanelGate requiredTier="google" />}>
      <Box sx={{ maxWidth: 'stretch', mx: 'auto', px: 3, py: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }}>GP Consultation Prep</Typography>
        <Stack spacing={3}>
          {/* ── Book Appointment ──────────────────────────────────────── */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Book an Appointment</Typography>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <FormControl size="small" sx={{ minWidth: 220, flex: 1 }}>
                  <InputLabel>Select GP</InputLabel>
                  <Select value={selectedGpId} label="Select GP" onChange={(e) => setSelectedGpId(e.target.value)} disabled={loadingGps}>
                    <MenuItem value=""><em>— Select a GP —</em></MenuItem>
                    {gps.map((gp) => (
                      <MenuItem key={gp.id} value={gp.id}>
                        {gp.name}{gp.practiceName ? ` — ${gp.practiceName}` : ''}{gp.practiceSuburb ? ` (${gp.practiceSuburb})` : ''}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField type="date" label="Date" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} size="small" slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: todayISO } }} sx={{ minWidth: 160 }} />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Time</InputLabel>
                  <Select value={timeSlot} label="Time" onChange={(e) => setTimeSlot(e.target.value)}>
                    <MenuItem value=""><em>— Select time —</em></MenuItem>
                    {TIME_SLOTS.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Duration</InputLabel>
                  <Select value={duration} label="Duration" onChange={(e) => setDuration(Number(e.target.value))}>
                    {DURATIONS.map((d) => <MenuItem key={d} value={d}>{d} min</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Type</InputLabel>
                  <Select value={apptType} label="Type" onChange={(e) => setApptType(e.target.value)}>
                    {APPT_TYPES.map((t) => <MenuItem key={t} value={t}>{t.replace('_', ' ')}</MenuItem>)}
                  </Select>
                </FormControl>
              </Stack>
              <TextField label="Reason for visit (optional)" value={reason} onChange={(e) => setReason(e.target.value)} size="small" placeholder="e.g. Menopause review, prescription renewal" />
              <Button variant="contained" onClick={handleBook} disabled={booking || !selectedGpId || !timeSlot}>
                {booking ? <CircularProgress size={20} /> : 'Book Appointment'}
              </Button>
            </Stack>
          </Paper>

          {/* ── Checklist ─────────────────────────────────────────────── */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Pre-Consultation Checklist</Typography>
            <List>
              {checklistItems.map((item) => (
                <ListItem key={item.key} disablePadding>
                  <ListItemIcon><Checkbox checked={item.done} color={item.done ? 'success' : 'default'} /></ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItem>
              ))}
            </List>
          </Paper>

          {/* ── Generate Summary ──────────────────────────────────────── */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Generate GP Summary</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Creates a structured summary of your symptoms, health metrics, and medications to share with your GP.
            </Typography>
            <Button variant="contained" onClick={generateSummary} disabled={summaryLoading} sx={{ mb: 2 }}>
              {summaryLoading ? <CircularProgress size={24} /> : 'Generate GP Summary'}
            </Button>
            {summaryError && <Alert severity="error" sx={{ mt: 2 }}>{summaryError}</Alert>}
            {summary && (
              <Paper variant="outlined" sx={{ p: 2, mt: 2, maxHeight: 400, overflow: 'auto', bgcolor: 'grey.100' }}>
                <Typography component="pre" variant="body2" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                  {summary}
                </Typography>
              </Paper>
            )}
          </Paper>
        </Stack>

        <Snackbar open={!!snackbar} autoHideDuration={5000} onClose={() => setSnackbar(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert severity={snackbar?.severity ?? 'info'} onClose={() => setSnackbar(null)} variant="filled">{snackbar?.message}</Alert>
        </Snackbar>
      </Box>
    </AuthGate>
  );
}
