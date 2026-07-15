'use client';
import { useState, useEffect } from 'react';
import { Box, Typography, Paper, Stack, TextField, Button, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Select, MenuItem, FormControl, InputLabel, ToggleButtonGroup, ToggleButton, Snackbar, Alert, CircularProgress, Chip } from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';

interface Provider { id: string; providerType: string; name: string; address: string | null; phone: string | null; fax: string | null; email: string | null; website: string | null; isDefault: boolean; isActive: boolean; }

async function api(url: string, opts?: RequestInit) { const res = await fetch(url, { credentials: 'include', ...opts }); return res.json(); }

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'PATHOLOGY' | 'RADIOLOGY'>('ALL');
  const [name, setName] = useState(''); const [type, setType] = useState('PATHOLOGY'); const [phone, setPhone] = useState(''); const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState<{ m: string; s: 'success' | 'error' } | null>(null);

  const fetchData = async () => {
    const typeParam = filter === 'ALL' ? '' : `?type=${filter}`;
    const d = await api(`/api/admin/providers${typeParam}`);
    if (d.success) setProviders(d.providers);
  };
  useEffect(() => { fetchData(); }, [filter]);

  const add = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const d = await api('/api/admin/providers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerType: type, name, phone: phone || null, address: address || null, isDefault: false, isActive: true }) });
    if (d.success) { setName(''); setPhone(''); setAddress(''); fetchData(); } else setSnack({ m: d.error, s: 'error' });
    setSaving(false);
  };

  const del = async (id: string) => { await api(`/api/admin/providers?id=${id}`, { method: 'DELETE' }); fetchData(); };

  return (
    <AuthGate requiredTier="pin" fallback={<SignInPanelGate requiredTier="pin" />}>
      <Box sx={{ maxWidth: 900, mx: 'auto', px: 3, py: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }}>Provider Directory</Typography>
        <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <ToggleButtonGroup value={filter} exclusive onChange={(_, v) => v && setFilter(v)} size="small">
            <ToggleButton value="ALL">All</ToggleButton><ToggleButton value="PATHOLOGY">Pathology</ToggleButton><ToggleButton value="RADIOLOGY">Radiology</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        <Paper sx={{ p: 2, mb: 3 }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <FormControl size="small" sx={{ minWidth: 130 }}><InputLabel>Type</InputLabel><Select value={type} label="Type" onChange={(e) => setType(e.target.value)}><MenuItem value="PATHOLOGY">Pathology</MenuItem><MenuItem value="RADIOLOGY">Radiology</MenuItem></Select></FormControl>
            <TextField label="Name" size="small" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Clinpath" sx={{ flex: 1, minWidth: 150 }} />
            <TextField label="Phone" size="small" value={phone} onChange={(e) => setPhone(e.target.value)} sx={{ width: 130 }} />
            <TextField label="Address" size="small" value={address} onChange={(e) => setAddress(e.target.value)} sx={{ width: 200 }} />
            <Button variant="contained" onClick={add} disabled={saving}>{saving ? <CircularProgress size={18} /> : 'Add'}</Button>
          </Stack>
        </Paper>
        <TableContainer component={Paper} variant="outlined"><Table size="small"><TableHead><TableRow><TableCell>Type</TableCell><TableCell>Name</TableCell><TableCell>Phone</TableCell><TableCell>Address</TableCell><TableCell align="right" /></TableRow></TableHead><TableBody>
          {providers.map((p) => (<TableRow key={p.id}><TableCell><Chip label={p.providerType} size="small" color={p.providerType === 'PATHOLOGY' ? 'info' : 'secondary'} variant="outlined" /></TableCell><TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{p.name}</Typography>{p.isDefault && <Chip label="Default" size="small" color="success" sx={{ ml: 0.5 }} />}</TableCell><TableCell>{p.phone ?? '—'}</TableCell><TableCell>{p.address ?? '—'}</TableCell><TableCell align="right"><IconButton size="small" color="error" onClick={() => del(p.id)}><DeleteIcon fontSize="small" /></IconButton></TableCell></TableRow>))}
          {providers.length === 0 && <TableRow><TableCell colSpan={5} align="center"><Typography color="text.secondary" sx={{ py: 3 }}>No providers registered.</Typography></TableCell></TableRow>}
        </TableBody></Table></TableContainer>
        <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}><Alert severity={snack?.s} onClose={() => setSnack(null)} variant="filled">{snack?.m}</Alert></Snackbar>
      </Box>
    </AuthGate>
  );
}
