'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Stack, TextField, Button, FormControl, InputLabel,
  Select, MenuItem, Switch, CircularProgress, Alert, Snackbar, Skeleton,
} from '@mui/material';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';

interface PracticeSettings {
  practiceName: string | null;
  timezone: string;
  openingHours: Record<string, { open: string; close: string }>;
  defaultAppointmentDuration: number;
  bulkBillDefault: boolean;
  defaultFeeCents: number;
  autoVerifyGps: boolean;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

const TIMEZONES = [
  'Australia/Adelaide', 'Australia/Brisbane', 'Australia/Darwin', 'Australia/Hobart',
  'Australia/Melbourne', 'Australia/Perth', 'Australia/Sydney',
];

export default function PracticeSettingsPage() {
  const [settings, setSettings] = useState<PracticeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/practice-settings', { credentials: 'include' });
      const d = await res.json();
      if (d.success) setSettings(d.settings as PracticeSettings);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/practice-settings', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const d = await res.json();
      setSnackbar({ message: d.success ? 'Settings saved' : (d.error ?? 'Failed'), severity: d.success ? 'success' : 'error' });
      if (d.success) fetchSettings();
    } catch { setSnackbar({ message: 'Network error', severity: 'error' }); }
    finally { setSaving(false); }
  };

  const updateHours = (day: string, field: 'open' | 'close', value: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      openingHours: {
        ...settings.openingHours,
        [day]: { ...(settings.openingHours[day] ?? { open: '08:00', close: '17:00' }), [field]: value },
      },
    });
  };

  if (loading) {
    return (
      <AuthGate requiredTier="pin" fallback={<SignInPanelGate requiredTier="pin" />}>
        <Box sx={{ maxWidth: 700, mx: 'auto', px: 3, py: 3 }}>
          <Skeleton variant="rounded" height={400} />
        </Box>
      </AuthGate>
    );
  }

  return (
    <AuthGate requiredTier="pin" fallback={<SignInPanelGate requiredTier="pin" />}>
      <Box sx={{ maxWidth: 700, mx: 'auto', px: 3, py: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>Practice Settings</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Configure practice-wide defaults for appointments, billing, and GP verification.
        </Typography>

        {settings && (
          <Stack spacing={3}>
            {/* ── General ─────────────────────────────────────────── */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>General</Typography>
              <Stack spacing={2}>
                <TextField label="Practice Name" size="small" fullWidth value={settings.practiceName ?? ''} onChange={(e) => setSettings({ ...settings, practiceName: e.target.value || null })} placeholder="e.g. ManaposeGP Women's Health" />
                <FormControl size="small">
                  <InputLabel>Timezone</InputLabel>
                  <Select value={settings.timezone} label="Timezone" onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}>
                    {TIMEZONES.map((tz) => <MenuItem key={tz} value={tz}>{tz}</MenuItem>)}
                  </Select>
                </FormControl>
              </Stack>
            </Paper>

            {/* ── Opening Hours ─────────────────────────────────────── */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Opening Hours</Typography>
              <Stack spacing={1.5}>
                {DAYS.map((day) => (
                  <Stack key={day} direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ width: 40, fontWeight: 600 }}>{DAY_LABELS[day]}</Typography>
                    <TextField
                      type="time" size="small" label="Open"
                      value={settings.openingHours[day]?.open ?? '08:00'}
                      onChange={(e) => updateHours(day, 'open', e.target.value)}
                      slotProps={{ inputLabel: { shrink: true } }}
                      sx={{ width: 140 }}
                    />
                    <Typography variant="body2">to</Typography>
                    <TextField
                      type="time" size="small" label="Close"
                      value={settings.openingHours[day]?.close ?? '17:00'}
                      onChange={(e) => updateHours(day, 'close', e.target.value)}
                      slotProps={{ inputLabel: { shrink: true } }}
                      sx={{ width: 140 }}
                    />
                  </Stack>
                ))}
              </Stack>
            </Paper>

            {/* ── Appointment Defaults ──────────────────────────────── */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Appointment Defaults</Typography>
              <Stack spacing={2}>
                <TextField
                  type="number" label="Default Appointment Duration (minutes)" size="small"
                  value={settings.defaultAppointmentDuration}
                  onChange={(e) => setSettings({ ...settings, defaultAppointmentDuration: Number(e.target.value) || 15 })}
                  slotProps={{ htmlInput: { min: 5, max: 120 } }}
                />
              </Stack>
            </Paper>

            {/* ── Billing Defaults ──────────────────────────────────── */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Billing Defaults</Typography>
              <Stack spacing={2}>
                <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Bulk Bill by Default</Typography>
                  <Switch checked={settings.bulkBillDefault} onChange={(e) => setSettings({ ...settings, bulkBillDefault: e.target.checked })} />
                </Stack>
                <TextField
                  type="number" label="Default Consultation Fee (cents)" size="small"
                  value={settings.defaultFeeCents}
                  onChange={(e) => setSettings({ ...settings, defaultFeeCents: Number(e.target.value) || 0 })}
                  helperText={`$${(settings.defaultFeeCents / 100).toFixed(2)}`}
                  slotProps={{ htmlInput: { min: 0 } }}
                />
              </Stack>
            </Paper>

            {/* ── GP Verification ────────────────────────────────────── */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>GP Verification</Typography>
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2">Auto-Approve New GPs</Typography>
                  <Typography variant="caption" color="text.secondary">When enabled, new GP registrations are automatically approved without manual review.</Typography>
                </Box>
                <Switch checked={settings.autoVerifyGps} onChange={(e) => setSettings({ ...settings, autoVerifyGps: e.target.checked })} />
              </Stack>
            </Paper>

            {/* ── Save ───────────────────────────────────────────────── */}
            <Button variant="contained" size="large" onClick={handleSave} disabled={saving}>
              {saving ? <CircularProgress size={20} /> : 'Save Settings'}
            </Button>
          </Stack>
        )}

        <Snackbar open={!!snackbar} autoHideDuration={4000} onClose={() => setSnackbar(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert severity={snackbar?.severity} onClose={() => setSnackbar(null)} variant="filled">{snackbar?.message}</Alert>
        </Snackbar>
      </Box>
    </AuthGate>
  );
}
