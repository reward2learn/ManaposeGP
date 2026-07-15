'use client';
import { useState, useEffect } from 'react';
import { Box, Typography, Paper, Stack, Switch, Button, CircularProgress, Snackbar, Alert, Skeleton } from '@mui/material';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';

const DEFAULT_FLAGS: Record<string, { label: string; description: string }> = {
  aiPrescriptions: { label: 'AI Prescription Suggestions', description: 'AI-powered medication suggestions during consultations' },
  aiInvestigations: { label: 'AI Investigation Suggestions', description: 'AI-powered pathology and radiology test recommendations' },
  aiMbsCodes: { label: 'AI MBS Code Suggestions', description: 'AI-powered Medicare item number suggestions for billing' },
  aiPatientSummary: { label: 'AI Patient Summaries', description: 'AI-generated plain-language summaries for patients' },
  telehealth: { label: 'Telehealth Appointments', description: 'Enable video telehealth consultations' },
  pathologyOrders: { label: 'Pathology Ordering', description: 'Electronic pathology/lab test ordering' },
  radiologyOrders: { label: 'Radiology Ordering', description: 'Electronic radiology/imaging ordering' },
  billingModule: { label: 'Billing Module', description: 'Invoice creation and payment recording' },
  patientBooking: { label: 'Patient Self-Booking', description: 'Patients can book their own appointments' },
  gpVerification: { label: 'GP Verification', description: 'Manual GP registration approval workflow' },
};

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState<{ m: string; s: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetch('/api/admin/feature-flags', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (d.success) setFlags(d.flags as Record<string, boolean>); })
      .finally(() => setLoading(false));
  }, []);

  const toggle = (key: string) => setFlags((prev) => ({ ...prev, [key]: !prev[key] }));

  const save = async () => {
    setSaving(true);
    const r = await (await fetch('/api/admin/feature-flags', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(flags) })).json();
    setSnack({ m: r.success ? 'Feature flags updated' : (r.error ?? 'Failed'), s: r.success ? 'success' : 'error' });
    setSaving(false);
  };

  if (loading) return <AuthGate requiredTier="pin" fallback={<SignInPanelGate requiredTier="pin" />}><Box sx={{ maxWidth: 700, mx: 'auto', px: 3, py: 3 }}><Skeleton variant="rounded" height={400} /></Box></AuthGate>;

  return (
    <AuthGate requiredTier="pin" fallback={<SignInPanelGate requiredTier="pin" />}>
      <Box sx={{ maxWidth: 700, mx: 'auto', px: 3, py: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>Feature Flags</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Toggle features on/off across the platform.</Typography>
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            {Object.entries(DEFAULT_FLAGS).map(([key, { label, description }]) => (
              <Stack key={key} direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>{label}</Typography>
                  <Typography variant="caption" color="text.secondary">{description}</Typography>
                </Box>
                <Switch checked={flags[key] ?? false} onChange={() => toggle(key)} />
              </Stack>
            ))}
          </Stack>
          <Button variant="contained" onClick={save} disabled={saving} sx={{ mt: 3 }}>
            {saving ? <CircularProgress size={20} /> : 'Save Feature Flags'}
          </Button>
        </Paper>
        <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}><Alert severity={snack?.s} onClose={() => setSnack(null)} variant="filled">{snack?.m}</Alert></Snackbar>
      </Box>
    </AuthGate>
  );
}
