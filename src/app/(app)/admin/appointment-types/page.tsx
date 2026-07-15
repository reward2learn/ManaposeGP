'use client';
import { useState, useEffect } from 'react';
import { Box, Typography, Paper, Stack, TextField, Button, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Snackbar, Alert, Chip, CircularProgress } from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';

interface ApptType { id: string; name: string; description: string | null; defaultDuration: number; color: string; isActive: boolean; }

async function api(url: string, opts?: RequestInit) {
  const res = await fetch(url, { credentials: 'include', ...opts });
  return res.json();
}

export default function AppointmentTypesPage() {
  const [types, setTypes] = useState<ApptType[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(''); const [duration, setDuration] = useState(15); const [color, setColor] = useState('#2196F3');
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState<{ m: string; s: 'success' | 'error' } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const d = await api('/api/admin/appointment-types');
    if (d.success) setTypes(d.types);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const add = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const d = await api('/api/admin/appointment-types', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, defaultDuration: duration, color }) });
    if (d.success) { setName(''); fetchData(); } else setSnack({ m: d.error, s: 'error' });
    setSaving(false);
  };

  const del = async (id: string) => {
    await api(`/api/admin/appointment-types?id=${id}`, { method: 'DELETE' });
    fetchData();
  };

  return (
    <AuthGate requiredTier="pin" fallback={<SignInPanelGate requiredTier="pin" />}>
      <Box sx={{ maxWidth: 800, mx: 'auto', px: 3, py: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }}>Appointment Types</Typography>
        <Paper sx={{ p: 2, mb: 3 }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <TextField label="Type Name" size="small" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. New Patient" sx={{ flex: 1 }} />
            <TextField label="Duration (min)" type="number" size="small" value={duration} onChange={(e) => setDuration(Number(e.target.value))} sx={{ width: 120 }} />
            <TextField label="Color" size="small" value={color} onChange={(e) => setColor(e.target.value)} sx={{ width: 120 }} /><Box sx={{ width: 24, height: 24, bgcolor: color, borderRadius: 1 }} />
            <Button variant="contained" onClick={add} disabled={saving}>{saving ? <CircularProgress size={18} /> : 'Add'}</Button>
          </Stack>
        </Paper>
        <TableContainer component={Paper} variant="outlined"><Table size="small"><TableHead><TableRow><TableCell>Name</TableCell><TableCell>Duration</TableCell><TableCell>Color</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead><TableBody>
          {types.map((t) => (<TableRow key={t.id}><TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{t.name}</Typography></TableCell><TableCell>{t.defaultDuration} min</TableCell><TableCell><Box sx={{ width: 20, height: 20, bgcolor: t.color, borderRadius: 1, border: '1px solid', borderColor: 'divider' }} /></TableCell><TableCell>{t.isActive ? <Chip label="Active" size="small" color="success" variant="outlined" /> : <Chip label="Inactive" size="small" variant="outlined" />}</TableCell><TableCell align="right"><IconButton size="small" color="error" onClick={() => del(t.id)}><DeleteIcon fontSize="small" /></IconButton></TableCell></TableRow>))}
          {types.length === 0 && <TableRow><TableCell colSpan={5} align="center"><Typography color="text.secondary" sx={{ py: 3 }}>No appointment types.</Typography></TableCell></TableRow>}
        </TableBody></Table></TableContainer>
        <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}><Alert severity={snack?.s} onClose={() => setSnack(null)} variant="filled">{snack?.m}</Alert></Snackbar>
      </Box>
    </AuthGate>
  );
}
