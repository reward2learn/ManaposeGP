'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import ContentCopy from '@mui/icons-material/ContentCopy';
import Delete from '@mui/icons-material/Delete';
import PersonAdd from '@mui/icons-material/PersonAdd';
import LinkIcon from '@mui/icons-material/Link';
import Refresh from '@mui/icons-material/Refresh';
import { useState, useEffect, useCallback } from 'react';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';

interface Patient {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  notes?: string;
  healthProfileId?: string;
  createdAt: string;
}

export default function GpPatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addResult, setAddResult] = useState<string | null>(null);

  // Invite dialog
  const [invitePatient, setInvitePatient] = useState<Patient | null>(null);
  const [inviteLink, setInviteLink] = useState('');

  const fetchPatients = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/gp/patients/manage', { credentials: 'include' });
      const data = await res.json();
      if (data.success) setPatients(data.patients ?? []);
      else setError(data.error);
    } catch { setError('Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPatients(); }, [fetchPatients]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setAddLoading(true);
    try {
      const res = await fetch('/api/gp/patients/manage', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim() || undefined, phone: phone.trim() || undefined, notes: notes.trim() || undefined }),
      });
      const data = await res.json();
      if (data.success) { setName(''); setEmail(''); setPhone(''); setNotes(''); setAddResult('Patient added'); fetchPatients(); }
      else setAddResult(data.error);
    } catch { setAddResult('Network error'); }
    finally { setAddLoading(false); }
  };

  const handleInvite = (patient: Patient) => {
    setInvitePatient(patient);
    setInviteLink(`${window.location.origin}/api/auth?action=google&redirect=%2Fhealth-dashboard&gp=${patient.id}`);
  };

  const handleDelete = async (patientId: string) => {
    await fetch('/api/gp/patients/manage', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', patientId }),
    });
    fetchPatients();
  };

  return (
    <AuthGate requiredTier="pin" fallback={<SignInPanelGate requiredTier="pin" />}>
      <Box sx={{ maxWidth: 'stretch', mx: 'auto', px: 3, py: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }}>My Patients</Typography>

        {/* Add Patient */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Add New Patient</Typography>
          {addResult && <Alert severity={addResult.includes('error') ? 'error' : 'success'} sx={{ mb: 2 }} onClose={() => setAddResult(null)}>{addResult}</Alert>}
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Name *" value={name} onChange={e => setName(e.target.value)} size="small" sx={{ flex: 1 }} />
              <TextField label="Email" value={email} onChange={e => setEmail(e.target.value)} size="small" sx={{ flex: 1 }} />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Phone" value={phone} onChange={e => setPhone(e.target.value)} size="small" sx={{ flex: 1 }} />
              <TextField label="Notes" value={notes} onChange={e => setNotes(e.target.value)} size="small" sx={{ flex: 1 }} />
            </Stack>
            <Button variant="contained" startIcon={<PersonAdd />} onClick={handleAdd} disabled={addLoading || !name.trim()}>
              {addLoading ? <CircularProgress size={20} /> : 'Add Patient'}
            </Button>
          </Stack>
        </Paper>

        {/* Patient List */}
        <Paper sx={{ p: 3 }}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">Patients ({patients.length})</Typography>
            <Button size="small" startIcon={<Refresh />} onClick={fetchPatients}>Refresh</Button>
          </Stack>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {loading ? <CircularProgress size={24} /> : patients.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No patients yet. Add your first patient above.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Platform</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {patients.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell sx={{ fontWeight: 500 }}>{p.name}</TableCell>
                      <TableCell>{p.email || '—'}</TableCell>
                      <TableCell>{p.phone || '—'}</TableCell>
                      <TableCell>
                        {p.healthProfileId ? (
                          <Chip label="Registered" size="small" color="success" variant="outlined" />
                        ) : (
                          <Chip label="Invited" size="small" color="default" variant="outlined" />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Copy invite link">
                          <IconButton size="small" onClick={() => handleInvite(p)}><LinkIcon fontSize="small" /></IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => handleDelete(p.id)}><Delete fontSize="small" /></IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>

        {/* Invite Dialog */}
        <Dialog open={Boolean(invitePatient)} onClose={() => setInvitePatient(null)} maxWidth="sm" fullWidth>
          <DialogTitle>Invite {invitePatient?.name}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Share this link with your patient. When they sign in with Google, they will be connected to your practice.
              </Typography>
              <TextField fullWidth value={inviteLink} size="small" slotProps={{ input: { readOnly: true } }} />
              <Button variant="outlined" startIcon={<ContentCopy />} onClick={() => { navigator.clipboard.writeText(inviteLink); }}>
                Copy Link
              </Button>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setInvitePatient(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </AuthGate>
  );
}
