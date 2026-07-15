'use client';
import { useState, useEffect } from 'react';
import { Box, Typography, Paper, Stack, TextField, Button, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Select, MenuItem, FormControl, InputLabel, Snackbar, Alert, CircularProgress, Chip } from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';

interface FeeItem { id: string; mbsItemNumber: string; description: string; category: string; scheduleFee: number; practiceFee: number; isActive: boolean; }
const CATEGORIES = ['CONSULTATION', 'PROCEDURE', 'MENTAL_HEALTH', 'CHRONIC_DISEASE', 'OTHER'];

async function api(url: string, opts?: RequestInit) {
  const res = await fetch(url, { credentials: 'include', ...opts });
  return res.json();
}

export default function FeeSchedulePage() {
  const [items, setItems] = useState<FeeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mbs, setMbs] = useState(''); const [desc, setDesc] = useState(''); const [cat, setCat] = useState('CONSULTATION');
  const [schedFee, setSchedFee] = useState(0); const [pracFee, setPracFee] = useState(0);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState<{ m: string; s: 'success' | 'error' } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const d = await api('/api/admin/fee-schedule');
    if (d.success) setItems(d.items);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const add = async () => {
    if (!mbs.trim() || !desc.trim()) return;
    setSaving(true);
    const d = await api('/api/admin/fee-schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mbsItemNumber: mbs, description: desc, category: cat, scheduleFee: schedFee, practiceFee: pracFee }) });
    if (d.success) { setMbs(''); setDesc(''); fetchData(); } else setSnack({ m: d.error, s: 'error' });
    setSaving(false);
  };

  const del = async (id: string) => { await api(`/api/admin/fee-schedule?id=${id}`, { method: 'DELETE' }); fetchData(); };

  return (
    <AuthGate requiredTier="pin" fallback={<SignInPanelGate requiredTier="pin" />}>
      <Box sx={{ maxWidth: 900, mx: 'auto', px: 3, py: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }}>Fee Schedule</Typography>
        <Paper sx={{ p: 2, mb: 3 }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <TextField label="MBS Item" size="small" value={mbs} onChange={(e) => setMbs(e.target.value)} placeholder="e.g. 23" sx={{ width: 100 }} />
            <TextField label="Description" size="small" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Level B" sx={{ flex: 1, minWidth: 180 }} />
            <FormControl size="small" sx={{ minWidth: 140 }}><InputLabel>Category</InputLabel><Select value={cat} label="Category" onChange={(e) => setCat(e.target.value)}>{CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c.replace('_', ' ')}</MenuItem>)}</Select></FormControl>
            <TextField label="MBS Fee (c)" type="number" size="small" value={schedFee} onChange={(e) => setSchedFee(Number(e.target.value))} sx={{ width: 100 }} />
            <TextField label="Practice Fee (c)" type="number" size="small" value={pracFee} onChange={(e) => setPracFee(Number(e.target.value))} sx={{ width: 120 }} />
            <Button variant="contained" onClick={add} disabled={saving}>{saving ? <CircularProgress size={18} /> : 'Add'}</Button>
          </Stack>
        </Paper>
        <TableContainer component={Paper} variant="outlined"><Table size="small"><TableHead><TableRow><TableCell>MBS</TableCell><TableCell>Description</TableCell><TableCell>Category</TableCell><TableCell>Schedule Fee</TableCell><TableCell>Practice Fee</TableCell><TableCell>Status</TableCell><TableCell align="right" /></TableRow></TableHead><TableBody>
          {items.map((i) => (<TableRow key={i.id}><TableCell><Chip label={i.mbsItemNumber} size="small" variant="outlined" /></TableCell><TableCell>{i.description}</TableCell><TableCell><Chip label={i.category.replace('_', ' ')} size="small" /></TableCell><TableCell>${(i.scheduleFee / 100).toFixed(2)}</TableCell><TableCell sx={{ color: i.practiceFee > 0 ? 'primary.main' : 'text.disabled', fontWeight: i.practiceFee > 0 ? 600 : 400 }}>{i.practiceFee > 0 ? `$${(i.practiceFee / 100).toFixed(2)}` : '—'}</TableCell><TableCell>{i.isActive ? <Chip label="Active" size="small" color="success" variant="outlined" /> : <Chip label="Inactive" size="small" variant="outlined" />}</TableCell><TableCell align="right"><IconButton size="small" color="error" onClick={() => del(i.id)}><DeleteIcon fontSize="small" /></IconButton></TableCell></TableRow>))}
          {items.length === 0 && <TableRow><TableCell colSpan={7} align="center"><Typography color="text.secondary" sx={{ py: 3 }}>No fee items.</Typography></TableCell></TableRow>}
        </TableBody></Table></TableContainer>
        <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}><Alert severity={snack?.s} onClose={() => setSnack(null)} variant="filled">{snack?.m}</Alert></Snackbar>
      </Box>
    </AuthGate>
  );
}
