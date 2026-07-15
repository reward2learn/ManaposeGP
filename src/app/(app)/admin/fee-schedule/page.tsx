'use client';
import { useState, useEffect } from 'react';
import { Box, Typography, Paper, Stack, TextField, Button, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Select, MenuItem, FormControl, InputLabel, Snackbar, Alert, CircularProgress, Chip, Divider } from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';

interface FeeItem { id: string; mbsItemNumber: string; description: string; category: string; scheduleFee: number; practiceFee: number; isActive: boolean; }
const CATEGORIES = ['CONSULTATION', 'PROCEDURE', 'MENTAL_HEALTH', 'HEALTH_ASSESSMENT', 'CHRONIC_DISEASE', 'TELEHEALTH', 'OTHER'];

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
  // Quick-select from existing schedule to auto-fill form
  const [selectedPreset, setSelectedPreset] = useState('');
  // Edit mode
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const d = await api('/api/admin/fee-schedule');
    if (d.success) setItems(d.items);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const applyPreset = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    setMbs(item.mbsItemNumber);
    setDesc(item.description);
    setCat(item.category);
    setSchedFee(item.scheduleFee);
    setPracFee(item.practiceFee);
    setEditingId(item.id);
    setSelectedPreset(itemId);
  };

  const addOrUpdate = async () => {
    if (!mbs.trim() || !desc.trim()) return;
    setSaving(true);
    const d = await api('/api/admin/fee-schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingId ?? undefined, mbsItemNumber: mbs, description: desc, category: cat, scheduleFee: schedFee, practiceFee: pracFee }),
    });
    if (d.success) {
      setMbs(''); setDesc(''); setCat('CONSULTATION'); setSchedFee(0); setPracFee(0);
      setEditingId(null); setSelectedPreset('');
      fetchData();
    } else setSnack({ m: d.error, s: 'error' });
    setSaving(false);
  };

  const del = async (id: string) => { await api(`/api/admin/fee-schedule?id=${id}`, { method: 'DELETE' }); fetchData(); };

  const formatFee = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <AuthGate requiredTier="pin" fallback={<SignInPanelGate requiredTier="pin" />}>
      <Box sx={{ maxWidth: 1000, mx: 'auto', px: 3, py: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>Fee Schedule</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Manage MBS items and practice fees. All fees are in Australian cents.
        </Typography>

        {/* Quick Select */}
        {items.length > 0 && (
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Quick Edit — Select an existing item to modify its fees</Typography>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 380 }}>
                <InputLabel>Select MBS Item</InputLabel>
                <Select
                  value={selectedPreset}
                  label="Select MBS Item"
                  onChange={(e) => { if (e.target.value) applyPreset(e.target.value); }}
                >
                  <MenuItem value=""><em>Choose an item to edit…</em></MenuItem>
                  {items.map((i) => (
                    <MenuItem key={i.id} value={i.id}>
                      {i.mbsItemNumber} — {i.description} ({formatFee(i.scheduleFee)})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {selectedPreset && (
                <Button size="small" variant="text" color="inherit" onClick={() => { setSelectedPreset(''); setEditingId(null); setMbs(''); setDesc(''); setCat('CONSULTATION'); setSchedFee(0); setPracFee(0); }}>
                  New Item Instead
                </Button>
              )}
            </Stack>
          </Paper>
        )}

        {/* Add / Edit Form */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            {editingId ? `Edit: ${mbs} — ${desc}` : 'Add Custom Fee Item'}
          </Typography>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <TextField label="MBS Item" size="small" value={mbs} onChange={(e) => setMbs(e.target.value)} placeholder="e.g. 23" sx={{ width: 100 }} />
            <TextField label="Description" size="small" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Level B" sx={{ flex: 1, minWidth: 180 }} />
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel>Category</InputLabel>
              <Select value={cat} label="Category" onChange={(e) => setCat(e.target.value)}>
                {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c.replace(/_/g, ' ')}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="MBS Fee (c)" type="number" size="small" value={schedFee} onChange={(e) => setSchedFee(Number(e.target.value))} sx={{ width: 110 }} />
            <TextField label="Practice Fee (c)" type="number" size="small" value={pracFee} onChange={(e) => setPracFee(Number(e.target.value))} sx={{ width: 120 }}
              helperText={schedFee > 0 && pracFee > schedFee ? `Gap: ${formatFee(pracFee - schedFee)}` : ''}
            />
            <Button variant="contained" onClick={addOrUpdate} disabled={saving} startIcon={<AddIcon />}>
              {saving ? <CircularProgress size={18} /> : editingId ? 'Update' : 'Add'}
            </Button>
            {editingId && (
              <Button size="small" color="inherit" onClick={() => { setEditingId(null); setSelectedPreset(''); setMbs(''); setDesc(''); setSchedFee(0); setPracFee(0); }}>
                Cancel
              </Button>
            )}
          </Stack>
        </Paper>

        {/* Items Table */}
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>MBS</TableCell><TableCell>Description</TableCell><TableCell>Category</TableCell>
                <TableCell>MBS Rebate</TableCell><TableCell>Practice Fee</TableCell><TableCell>Status</TableCell><TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.id} hover onClick={() => applyPreset(i.id)} sx={{ cursor: 'pointer' }}>
                  <TableCell><Chip label={i.mbsItemNumber} size="small" variant="outlined" /></TableCell>
                  <TableCell>{i.description}</TableCell>
                  <TableCell><Chip label={i.category.replace(/_/g, ' ')} size="small" /></TableCell>
                  <TableCell>{formatFee(i.scheduleFee)}</TableCell>
                  <TableCell sx={{ color: i.practiceFee > i.scheduleFee ? 'warning.main' : 'primary.main', fontWeight: 600 }}>
                    {formatFee(i.practiceFee)}
                    {i.practiceFee > i.scheduleFee && (
                      <Chip label={`+${formatFee(i.practiceFee - i.scheduleFee)} gap`} size="small" color="warning" variant="outlined" sx={{ ml: 1 }} />
                    )}
                  </TableCell>
                  <TableCell>
                    {i.isActive ? <Chip label="Active" size="small" color="success" variant="outlined" /> : <Chip label="Inactive" size="small" variant="outlined" />}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); del(i.id); }}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && <TableRow><TableCell colSpan={7} align="center"><Typography color="text.secondary" sx={{ py: 3 }}>No fee items. Seeding standard MBS schedule…</Typography></TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
        <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}>
          <Alert severity={snack?.s} onClose={() => setSnack(null)} variant="filled">{snack?.m}</Alert>
        </Snackbar>
      </Box>
    </AuthGate>
  );
}
