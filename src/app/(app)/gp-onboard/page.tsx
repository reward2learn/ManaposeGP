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
import VerifiedIcon from '@mui/icons-material/Verified';
import UnpublishedIcon from '@mui/icons-material/Unpublished';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { useState, useEffect, useCallback } from 'react';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';

interface GpRecord {
  id: string;
  userId: string;
  name: string;
  practiceName?: string;
  ahpraNumber?: string;
  email?: string;
  verified: boolean;
  indemnityProvider?: string;
  indemnityPolicyNumber?: string;
  indemnityExpiryDate?: string;
  createdAt: string;
}

interface GpDocument {
  id: string;
  gpId: string;
  documentType: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}

const DOC_TYPES: Record<string, string> = {
  ahpra_cert: 'AHPRA Certificate',
  indemnity_insurance: 'Indemnity Insurance',
  medical_degree: 'Medical Degree',
  id_proof: 'ID Proof',
  other: 'Other',
};

export default function GpOnboardPage() {
  const [name, setName] = useState('');
  const [practiceName, setPracticeName] = useState('');
  const [ahpraNumber, setAhpraNumber] = useState('');
  const [email, setEmail] = useState('');
  const [indemnityProvider, setIndemnityProvider] = useState('');
  const [indemnityPolicyNumber, setIndemnityPolicyNumber] = useState('');
  const [indemnityExpiryDate, setIndemnityExpiryDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const [gps, setGps] = useState<GpRecord[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // Edit dialog
  const [editGp, setEditGp] = useState<GpRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [editPractice, setEditPractice] = useState('');
  const [editAhpra, setEditAhpra] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editIndemnityProvider, setEditIndemnityProvider] = useState('');
  const [editIndemnityPolicyNumber, setEditIndemnityPolicyNumber] = useState('');
  const [editIndemnityExpiryDate, setEditIndemnityExpiryDate] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Document upload state
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('ahpra_cert');
  const [docUploading, setDocUploading] = useState(false);
  const [editDocs, setEditDocs] = useState<GpDocument[]>([]);

  const fetchGpList = useCallback(async () => {
    setListLoading(true); setListError(null);
    try {
      const res = await fetch('/api/gp/onboard', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list' }),
      });
      const data = await res.json();
      if (data.success) setGps(data.gps ?? []);
      else setListError(data.error);
    } catch { setListError('Failed to load GP list'); }
    finally { setListLoading(false); }
  }, []);

  useEffect(() => { fetchGpList(); }, [fetchGpList]);

  const handleVerify = async (gpId: string) => {
    try {
      await fetch('/api/gp/onboard', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', gpId }),
      });
      fetchGpList();
    } catch { /* ignore */ }
  };

  const openEdit = (gp: GpRecord) => {
    setEditGp(gp);
    setEditName(gp.name);
    setEditPractice(gp.practiceName || '');
    setEditAhpra(gp.ahpraNumber || '');
    setEditEmail(gp.email || '');
    setEditIndemnityProvider(gp.indemnityProvider || '');
    setEditIndemnityPolicyNumber(gp.indemnityPolicyNumber || '');
    setEditIndemnityExpiryDate(gp.indemnityExpiryDate || '');
    // Fetch existing documents
    fetch(`/api/gp/onboard`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list-docs', gpId: gp.id }),
    }).then(r => r.json()).then(d => { if (d.success) setEditDocs(d.documents || []); }).catch(() => {});
  };

  const handleDocUpload = async (gpId: string) => {
    if (!docFile) return;
    setDocUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(docFile);
      });
      const res = await fetch('/api/gp/onboard', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upload-doc', gpId,
          documentType: docType,
          fileName: docFile.name,
          fileSize: docFile.size,
          mimeType: docFile.type || 'application/octet-stream',
          dataBase64: base64,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditDocs(prev => [...prev, { ...data.document, dataBase64: undefined }]);
        setDocFile(null);
      }
    } catch { /* ignore */ }
    finally { setDocUploading(false); }
  };

  const handleDocDownload = async (doc: GpDocument) => {
    const res = await fetch('/api/gp/onboard', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get-doc', docId: doc.id }),
    });
    const data = await res.json();
    if (data.success && data.document?.dataBase64) {
      const link = document.createElement('a');
      link.href = `data:${doc.mimeType};base64,${data.document.dataBase64}`;
      link.download = doc.fileName;
      link.click();
    }
  };

  const handleDocDelete = async (docId: string) => {
    await fetch('/api/gp/onboard', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete-doc', docId }),
    });
    setEditDocs(prev => prev.filter(d => d.id !== docId));
  };

  const handleEditSave = async () => {
    if (!editGp || !editName.trim()) return;
    setEditLoading(true);
    try {
      await fetch('/api/gp/onboard', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          gpId: editGp.id,
          name: editName.trim(),
          practiceName: editPractice.trim() || undefined,
          ahpraNumber: editAhpra.trim() || undefined,
          email: editEmail.trim() || undefined,
          indemnityProvider: editIndemnityProvider.trim() || undefined,
          indemnityPolicyNumber: editIndemnityPolicyNumber.trim() || undefined,
          indemnityExpiryDate: editIndemnityExpiryDate || undefined,
        }),
      });
      setEditGp(null);
      fetchGpList();
    } catch { /* ignore */ }
    finally { setEditLoading(false); }
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setLoading(true); setResult(null);
    try {
      const res = await fetch('/api/gp/onboard', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          practiceName: practiceName.trim() || undefined,
          ahpraNumber: ahpraNumber.trim() || undefined,
          email: email.trim() || undefined,
          indemnityProvider: indemnityProvider.trim() || undefined,
          indemnityPolicyNumber: indemnityPolicyNumber.trim() || undefined,
          indemnityExpiryDate: indemnityExpiryDate || undefined,
        }),
      });
      const data = await res.json();
      setResult(data);
      if (data.success) { setName(''); setPracticeName(''); setAhpraNumber(''); setEmail(''); setIndemnityProvider(''); setIndemnityPolicyNumber(''); setIndemnityExpiryDate(''); fetchGpList(); }
    } catch { setResult({ success: false, message: 'Network error.' }); }
    finally { setLoading(false); }
  };

  return (
    <AuthGate requiredTier="pin" fallback={<SignInPanelGate requiredTier="pin" />}>
      <Box sx={{ maxWidth: 'stretch', mx: 'auto', px: 3, py: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }}>GP Management</Typography>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Register New GP</Typography>
          {result && <Alert severity={result.success ? 'success' : 'error'} sx={{ mb: 2 }} onClose={() => setResult(null)}>{result.message}</Alert>}
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Full Name *" value={name} onChange={e => setName(e.target.value)} size="small" sx={{ flex: 1 }} />
              <TextField label="Practice / Clinic" value={practiceName} onChange={e => setPracticeName(e.target.value)} size="small" sx={{ flex: 1 }} />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="AHPRA Number *" value={ahpraNumber} onChange={e => setAhpraNumber(e.target.value)} size="small" sx={{ flex: 1 }} required helperText="Required for verification — Australian Health Practitioner Regulation Agency number" />
              <TextField label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} size="small" sx={{ flex: 1 }} />
            </Stack>
            <Typography variant="subtitle2" sx={{ mt: 1 }}>Medical Indemnity Insurance (Recommended)</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Indemnity Provider" value={indemnityProvider} onChange={e => setIndemnityProvider(e.target.value)} size="small" sx={{ flex: 1 }} placeholder="e.g. MDA National, Avant" />
              <TextField label="Policy Number" value={indemnityPolicyNumber} onChange={e => setIndemnityPolicyNumber(e.target.value)} size="small" sx={{ flex: 1 }} />
            </Stack>
            <TextField label="Indemnity Expiry Date" type="date" value={indemnityExpiryDate} onChange={e => setIndemnityExpiryDate(e.target.value)} size="small" sx={{ maxWidth: 240 }} slotProps={{ inputLabel: { shrink: true } }} />

            <Typography variant="subtitle2" sx={{ mt: 1 }}>Required Documents</Typography>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Doc Type</InputLabel>
                <Select value={docType} label="Doc Type" onChange={e => setDocType(e.target.value)}>
                  {Object.entries(DOC_TYPES).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
                </Select>
              </FormControl>
              <Button variant="outlined" component="label" startIcon={<AttachFileIcon />} size="small">
                {docFile ? docFile.name.slice(0, 30) : 'Choose File'}
                <input type="file" hidden accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => setDocFile(e.target.files?.[0] || null)} />
              </Button>
            </Stack>

            <Button variant="contained" onClick={handleSubmit} disabled={loading || !name.trim()}>
              {loading ? <CircularProgress size={20} /> : 'Register GP'}
            </Button>
          </Stack>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">Registered GPs ({gps.length})</Typography>
            <Button size="small" startIcon={<RefreshIcon />} onClick={fetchGpList} disabled={listLoading}>Refresh</Button>
          </Stack>
          {listError && <Alert severity="error" sx={{ mb: 2 }}>{listError}</Alert>}
          {listLoading ? <CircularProgress size={24} /> : gps.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No GPs registered yet. Use the form above to register the first GP.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Practice</TableCell>
                      <TableCell>AHPRA</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Indemnity</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {gps.map((gp) => (
                      <TableRow key={gp.id}>
                        <TableCell sx={{ fontWeight: 500 }}>{gp.name}</TableCell>
                        <TableCell>{gp.practiceName || '—'}</TableCell>
                        <TableCell>{gp.ahpraNumber || '—'}</TableCell>
                        <TableCell>{gp.email || '—'}</TableCell>
                        <TableCell>
                          {gp.indemnityProvider ? (
                            <Tooltip title={`${gp.indemnityProvider} — Policy: ${gp.indemnityPolicyNumber || 'N/A'} — Expiry: ${gp.indemnityExpiryDate || 'N/A'}`}>
                              <Chip label={gp.indemnityProvider} size="small" color="info" variant="outlined" />
                            </Tooltip>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                        {gp.verified ? (
                          <Chip icon={<VerifiedIcon />} label="Verified" size="small" color="success" variant="outlined" />
                        ) : (
                          <Chip icon={<UnpublishedIcon />} label="Pending" size="small" color="warning" variant="outlined" />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Edit GP">
                          <IconButton size="small" onClick={() => openEdit(gp)}><EditIcon fontSize="small" /></IconButton>
                        </Tooltip>
                        <Tooltip title={gp.verified ? 'Revoke' : 'Verify'}>
                          <IconButton size="small" onClick={() => handleVerify(gp.id)} color={gp.verified ? 'warning' : 'success'}>
                            {gp.verified ? <UnpublishedIcon fontSize="small" /> : <VerifiedIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>

        {/* Edit Dialog */}
        <Dialog open={Boolean(editGp)} onClose={() => setEditGp(null)} maxWidth="sm" fullWidth>
          <DialogTitle>Edit GP: {editGp?.name}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Full Name" value={editName} onChange={e => setEditName(e.target.value)} size="small" fullWidth />
              <TextField label="Practice / Clinic" value={editPractice} onChange={e => setEditPractice(e.target.value)} size="small" fullWidth />
              <TextField label="AHPRA Number" value={editAhpra} onChange={e => setEditAhpra(e.target.value)} size="small" fullWidth />
              <TextField label="Email" type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} size="small" fullWidth />
              <Typography variant="subtitle2" sx={{ mt: 1 }}>Medical Indemnity Insurance</Typography>
              <TextField label="Indemnity Provider" value={editIndemnityProvider} onChange={e => setEditIndemnityProvider(e.target.value)} size="small" fullWidth placeholder="e.g. MDA National, Avant" />
              <TextField label="Policy Number" value={editIndemnityPolicyNumber} onChange={e => setEditIndemnityPolicyNumber(e.target.value)} size="small" fullWidth />
              <TextField label="Expiry Date" type="date" value={editIndemnityExpiryDate} onChange={e => setEditIndemnityExpiryDate(e.target.value)} size="small" fullWidth slotProps={{ inputLabel: { shrink: true } }} />
              <Typography variant="caption" color="text.secondary">
                User ID: {editGp?.userId}
              </Typography>

              {/* Documents section */}
              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Verification Documents ({editDocs.length})</Typography>
              {editDocs.length === 0 ? (
                <Typography variant="caption" color="text.disabled">No documents uploaded yet.</Typography>
              ) : (
                editDocs.map(doc => (
                  <Stack key={doc.id} direction="row" spacing={1} sx={{ alignItems: 'center', py: 0.5 }}>
                    <Chip label={DOC_TYPES[doc.documentType] || doc.documentType} size="small" color="info" variant="outlined" />
                    <Typography variant="caption" sx={{ flex: 1 }} noWrap>{doc.fileName}</Typography>
                    <Typography variant="caption" color="text.disabled">{Math.round(doc.fileSize / 1024)}KB</Typography>
                    <IconButton size="small" onClick={() => handleDocDownload(doc)}><DownloadIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDocDelete(doc.id)}><DeleteIcon fontSize="small" /></IconButton>
                  </Stack>
                ))
              )}

              {/* Upload new document */}
              <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <Select value={docType} onChange={e => setDocType(e.target.value)} displayEmpty>
                    {Object.entries(DOC_TYPES).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
                  </Select>
                </FormControl>
                <Button variant="outlined" size="small" component="label" startIcon={<AttachFileIcon />}>
                  {docFile ? docFile.name.slice(0, 20) : 'File'}
                  <input type="file" hidden accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => setDocFile(e.target.files?.[0] || null)} />
                </Button>
                <Button variant="contained" size="small" disabled={!docFile || docUploading} onClick={() => handleDocUpload(editGp!.id)}>
                  {docUploading ? <CircularProgress size={14} /> : 'Upload'}
                </Button>
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditGp(null)}>Cancel</Button>
            <Button variant="contained" onClick={handleEditSave} disabled={editLoading || !editName.trim()}>
              {editLoading ? <CircularProgress size={20} /> : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </AuthGate>
  );
}
