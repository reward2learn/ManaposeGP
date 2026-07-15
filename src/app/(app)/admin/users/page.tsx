'use client';
import { useState, useEffect } from 'react';
import { Box, Typography, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Button, Select, MenuItem, FormControl, InputLabel, Snackbar, Alert, CircularProgress, Skeleton } from '@mui/material';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';

interface User { id: string; email: string; name: string | null; tier: string; isGp: boolean; role: string; status: string; lastLogin: string | null; createdAt: string; }
const ROLES = ['SUPER_ADMIN', 'ADMIN', 'GP', 'RECEPTIONIST', 'NURSE', 'USER'];
const TIERS = ['public', 'google', 'pin'];
const STATUSES = ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'];

async function api(url: string, opts?: RequestInit) { const res = await fetch(url, { credentials: 'include', ...opts }); return res.json(); }

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editRole, setEditRole] = useState('USER'); const [editTier, setEditTier] = useState('google'); const [editStatus, setEditStatus] = useState('ACTIVE');
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState<{ m: string; s: 'success' | 'error' } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const d = await api('/api/admin/users');
    if (d.success) setUsers(d.users as User[]);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const startEdit = (u: User) => { setEditing(u.id); setEditRole(u.role); setEditTier(u.tier); setEditStatus(u.status); };

  const save = async (userId: string) => {
    setSaving(true);
    const d = await api('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: userId, role: editRole, tier: editTier, status: editStatus }) });
    if (d.success) { setEditing(null); fetchData(); setSnack({ m: 'User updated', s: 'success' }); } else setSnack({ m: d.error, s: 'error' });
    setSaving(false);
  };

  return (
    <AuthGate requiredTier="pin" fallback={<SignInPanelGate requiredTier="pin" />}>
      <Box sx={{ maxWidth: 1100, mx: 'auto', px: 3, py: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }}>User Management</Typography>
        {loading ? <Skeleton variant="rounded" height={300} /> : (
          <TableContainer component={Paper} variant="outlined"><Table size="small"><TableHead><TableRow><TableCell>Email</TableCell><TableCell>Name</TableCell><TableCell>Tier</TableCell><TableCell>Role</TableCell><TableCell>GP</TableCell><TableCell>Status</TableCell><TableCell>Last Login</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead><TableBody>
            {users.map((u) => (<TableRow key={u.id} hover sx={{ bgcolor: editing === u.id ? 'action.hover' : undefined }}>
              <TableCell><Typography variant="body2">{u.email}</Typography></TableCell><TableCell>{u.name ?? '—'}</TableCell>
              <TableCell>{editing === u.id ? <FormControl size="small" sx={{ minWidth: 100 }}><Select value={editTier} onChange={(e) => setEditTier(e.target.value)}>{TIERS.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}</Select></FormControl> : <Chip label={u.tier} size="small" color={u.tier === 'pin' ? 'warning' : 'info'} variant="outlined" />}</TableCell>
              <TableCell>{editing === u.id ? <FormControl size="small" sx={{ minWidth: 130 }}><Select value={editRole} onChange={(e) => setEditRole(e.target.value)}>{ROLES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}</Select></FormControl> : <Chip label={u.role} size="small" variant="outlined" />}</TableCell>
              <TableCell>{u.isGp ? <Chip label="GP" size="small" color="success" variant="outlined" /> : '—'}</TableCell>
              <TableCell>{editing === u.id ? <FormControl size="small" sx={{ minWidth: 120 }}><Select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>{STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}</Select></FormControl> : <Chip label={u.status} size="small" color={u.status === 'ACTIVE' ? 'success' : 'error'} variant="outlined" />}</TableCell>
              <TableCell><Typography variant="caption">{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('en-AU') : 'Never'}</Typography></TableCell>
              <TableCell align="right">
                {editing === u.id ? (<Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}><Button size="small" variant="contained" onClick={() => save(u.id)} disabled={saving}>{saving ? <CircularProgress size={14} /> : 'Save'}</Button><Button size="small" onClick={() => setEditing(null)}>Cancel</Button></Stack>) : (<Button size="small" variant="outlined" onClick={() => startEdit(u)}>Edit</Button>)}
              </TableCell>
            </TableRow>))}
            {users.length === 0 && <TableRow><TableCell colSpan={8} align="center"><Typography color="text.secondary" sx={{ py: 3 }}>No users found.</Typography></TableCell></TableRow>}
          </TableBody></Table></TableContainer>
        )}
        <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}><Alert severity={snack?.s} onClose={() => setSnack(null)} variant="filled">{snack?.m}</Alert></Snackbar>
      </Box>
    </AuthGate>
  );
}
