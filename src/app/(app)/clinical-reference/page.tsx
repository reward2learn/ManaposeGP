'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import { useState, useCallback } from 'react';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';
import { RiskCalculator } from '@/components/health/risk-calculator';

interface GuidelineResult {
  id: string;
  title: string;
  source: string;
  category: string;
  content: string;
  summary?: string;
  url?: string;
}

export default function ClinicalReferencePage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GuidelineResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drug interaction state
  const [medications, setMedications] = useState('');
  const [drugResults, setDrugResults] = useState<string | null>(null);
  const [drugLoading, setDrugLoading] = useState(false);

  const searchGuidelines = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/gp/guidelines?query=${encodeURIComponent(query)}&topK=5`, { credentials: 'include' });
      const data = await res.json();
      setResults(data.results ?? []);
    } catch { setError('Search failed'); }
    finally { setLoading(false); }
  }, [query]);

  const checkDrugInteractions = useCallback(async () => {
    const medList = medications.split(',').map(m => m.trim()).filter(Boolean);
    if (medList.length === 0) return;
    setDrugLoading(true);
    try {
      const res = await fetch('/api/gp/drug-interactions', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medications: medList }),
      });
      const data = await res.json();
      setDrugResults(data.noInteractionsFound ? 'No clinically significant interactions found.' : JSON.stringify(data.interactions, null, 2));
    } catch { setDrugResults('Check failed'); }
    finally { setDrugLoading(false); }
  }, [medications]);

  return (
    <AuthGate requiredTier="pin" fallback={<SignInPanelGate requiredTier="pin" />}>
      <Box sx={{ maxWidth: 'stretch', mx: 'auto', px: 3, py: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }}>Clinical Tools</Typography>
        <Stack spacing={3}>

          {/* Guideline Search */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Guideline Search</Typography>
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <TextField fullWidth size="small" placeholder="Search clinical guidelines... (e.g., MHT dosing, osteoporosis screening)" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchGuidelines()} />
              <Button variant="contained" onClick={searchGuidelines} disabled={loading}>{loading ? <CircularProgress size={20} /> : 'Search'}</Button>
            </Stack>
            {error && <Alert severity="error">{error}</Alert>}
            <Stack spacing={1}>
              {results.map((r) => (
                <Card key={r.id} variant="outlined">
                  <CardContent>
                    <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                      <Chip label={r.source.toUpperCase()} size="small" color="primary" variant="outlined" />
                      <Chip label={r.category} size="small" variant="outlined" />
                    </Stack>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{r.title}</Typography>
                    <Typography variant="body2" color="text.secondary">{r.content?.slice(0, 300)}...</Typography>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Paper>

          {/* Drug Interaction Checker */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Drug Interaction Checker</Typography>
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <TextField fullWidth size="small" placeholder="Medications (comma-separated, e.g., estradiol, venlafaxine, paracetamol)" value={medications} onChange={e => setMedications(e.target.value)} onKeyDown={e => e.key === 'Enter' && checkDrugInteractions()} />
              <Button variant="contained" onClick={checkDrugInteractions} disabled={drugLoading}>{drugLoading ? <CircularProgress size={20} /> : 'Check'}</Button>
            </Stack>
            {drugResults && (
              <Paper variant="outlined" sx={{ p: 2, maxHeight: 300, overflow: 'auto', bgcolor: 'grey.900' }}>
                <Typography component="pre" variant="body2" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{drugResults}</Typography>
              </Paper>
            )}
          </Paper>

          {/* Risk Calculator */}
          <RiskCalculator />

        </Stack>
      </Box>
    </AuthGate>
  );
}
