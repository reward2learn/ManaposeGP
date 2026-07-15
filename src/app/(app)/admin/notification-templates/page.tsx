'use client';
import { useState, useEffect } from 'react';
import { Box, Typography, Paper, Stack, TextField, Button, Select, MenuItem, FormControl, InputLabel, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Snackbar, Alert, CircularProgress, Chip, Skeleton } from '@mui/material';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';

interface Template { id: string; templateType: string; subject: string; bodyTemplate: string; channel: string; isActive: boolean; }
const TEMPLATE_TYPES = ['APPOINTMENT_REMINDER', 'VERIFICATION_APPROVED', 'VERIFICATION_REJECTED', 'CONSULTATION_SUMMARY', 'GENERAL'];
const CHANNELS = ['EMAIL', 'SMS', 'BOTH'];

async function api(url: string, opts?: RequestInit) { const res = await fetch(url, { credentials: 'include', ...opts }); return res.json(); }

export default function NotificationTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('APPOINTMENT_REMINDER'); const [subject, setSubject] = useState(''); const [body, setBody] = useState(''); const [channel, setChannel] = useState('EMAIL');
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState<{ m: string; s: 'success' | 'error' } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const d = await api('/api/admin/notification-templates');
    if (d.success) setTemplates(d.templates);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const add = async () => {
    if (!subject.trim() || !body.trim()) return;
    setSaving(true);
    const d = await api('/api/admin/notification-templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ templateType: type, subject, bodyTemplate: body, channel }) });
    if (d.success) { setSubject(''); setBody(''); fetchData(); } else setSnack({ m: d.error, s: 'error' });
    setSaving(false);
  };

  return (
    <AuthGate requiredTier="pin" fallback={<SignInPanelGate requiredTier="pin" />}>
      <Box sx={{ maxWidth: 900, mx: 'auto', px: 3, py: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }}>Notification Templates</Typography>
        <Paper sx={{ p: 2, mb: 3 }}><Stack spacing={2}>
          <Stack direction="row" spacing={2}>
            <FormControl size="small" sx={{ minWidth: 180 }}><InputLabel>Template Type</InputLabel><Select value={type} label="Template Type" onChange={(e) => setType(e.target.value)}>{TEMPLATE_TYPES.map((t) => <MenuItem key={t} value={t}>{t.replace(/_/g, ' ')}</MenuItem>)}</Select></FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}><InputLabel>Channel</InputLabel><Select value={channel} label="Channel" onChange={(e) => setChannel(e.target.value)}>{CHANNELS.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}</Select></FormControl>
          </Stack>
          <TextField label="Subject" size="small" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Your appointment is confirmed" />
          <TextField label="Body Template" size="small" multiline rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Use {{variables}}: e.g. Dear {{patientName}}, your appointment with {{gpName}} on {{date}} at {{time}} is confirmed." helperText="Variables: {{patientName}}, {{gpName}}, {{date}}, {{time}}, {{practiceName}}" />
          <Box><Button variant="contained" onClick={add} disabled={saving}>{saving ? <CircularProgress size={18} /> : 'Add Template'}</Button></Box>
        </Stack></Paper>
        {loading ? <Skeleton variant="rounded" height={200} /> : (<TableContainer component={Paper} variant="outlined"><Table size="small"><TableHead><TableRow><TableCell>Type</TableCell><TableCell>Subject</TableCell><TableCell>Channel</TableCell><TableCell>Status</TableCell></TableRow></TableHead><TableBody>
          {templates.map((t) => (<TableRow key={t.id}><TableCell><Chip label={t.templateType.replace(/_/g, ' ')} size="small" variant="outlined" /></TableCell><TableCell>{t.subject}</TableCell><TableCell><Chip label={t.channel} size="small" color={t.channel === 'EMAIL' ? 'info' : 'secondary'} variant="outlined" /></TableCell><TableCell>{t.isActive ? <Chip label="Active" size="small" color="success" variant="outlined" /> : <Chip label="Inactive" size="small" variant="outlined" />}</TableCell></TableRow>))}
        </TableBody></Table></TableContainer>)}
        <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}><Alert severity={snack?.s} onClose={() => setSnack(null)} variant="filled">{snack?.m}</Alert></Snackbar>
      </Box>
    </AuthGate>
  );
}
