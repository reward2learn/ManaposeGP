'use client';
import { useState, useEffect } from 'react';
import { Box, Typography, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, FormControl, InputLabel, Select, MenuItem, Skeleton } from '@mui/material';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';

interface Log { id: string; actorId: string; action: string; target: string | null; details: Record<string, unknown>; createdAt: string; }

async function api(url: string) { const res = await fetch(url, { credentials: 'include' }); return res.json(); }

const actionColor = (a: string): 'success' | 'error' | 'warning' | 'info' | 'default' => {
  if (a.includes('APPROVED')) return 'success';
  if (a.includes('REJECTED') || a.includes('DELETE')) return 'error';
  if (a.includes('UPDATE') || a.includes('UPSERT')) return 'warning';
  return 'default';
};

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('');

  const fetchData = async () => {
    setLoading(true);
    const p = filterAction ? `?action=${filterAction}` : '';
    const d = await api(`/api/admin/activity-log${p}`);
    if (d.success) setLogs(d.logs);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, [filterAction]);

  return (
    <AuthGate requiredTier="pin" fallback={<SignInPanelGate requiredTier="pin" />}>
      <Box sx={{ maxWidth: 1000, mx: 'auto', px: 3, py: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }}>Activity Log</Typography>
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 200 }}><InputLabel>Filter by Action</InputLabel>
            <Select value={filterAction} label="Filter by Action" onChange={(e) => setFilterAction(e.target.value)}>
              <MenuItem value="">All Actions</MenuItem>
              <MenuItem value="VERIFY_GP_APPROVED">GP Approved</MenuItem>
              <MenuItem value="VERIFY_GP_REJECTED">GP Rejected</MenuItem>
              <MenuItem value="UPDATE_SETTINGS">Settings Updated</MenuItem>
              <MenuItem value="UPDATE_FEATURE_FLAGS">Feature Flags</MenuItem>
              <MenuItem value="UPSERT_FEE_ITEM">Fee Items</MenuItem>
              <MenuItem value="UPDATE_USER">User Updated</MenuItem>
            </Select>
          </FormControl>
        </Stack>
        <TableContainer component={Paper} variant="outlined"><Table size="small"><TableHead><TableRow><TableCell>Time</TableCell><TableCell>Actor</TableCell><TableCell>Action</TableCell><TableCell>Target</TableCell><TableCell>Details</TableCell></TableRow></TableHead><TableBody>
          {loading ? [1,2,3,4,5].map((i) => <TableRow key={i}><TableCell colSpan={5}><Skeleton height={36} /></TableCell></TableRow>) :
            logs.map((l) => (<TableRow key={l.id} hover><TableCell><Typography variant="caption">{new Date(l.createdAt).toLocaleString('en-AU')}</Typography></TableCell><TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{l.actorId.slice(0, 8)}...</Typography></TableCell><TableCell><Chip label={l.action.replace(/_/g, ' ')} size="small" color={actionColor(l.action)} variant="outlined" /></TableCell><TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace', maxWidth: 120, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.target?.slice(0, 12) ?? '—'}</Typography></TableCell><TableCell><Typography variant="caption">{JSON.stringify(l.details).slice(0, 80)}{JSON.stringify(l.details).length > 80 ? '...' : ''}</Typography></TableCell></TableRow>))
          }
        </TableBody></Table></TableContainer>
      </Box>
    </AuthGate>
  );
}
