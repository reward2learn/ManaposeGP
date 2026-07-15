'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Chip from '@mui/material/Chip';
import { useState } from 'react';
import { HealthEducationLibrary } from '@/components/health/health-education-library';
import { useAppSelector } from '@/store/hooks';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import AddIcon from '@mui/icons-material/Add';

const CATEGORIES = ['menopause','mental_health','bone_health','cardiovascular','sexual_health','nutrition','exercise','sleep','general'];

export default function HealthEducationPage() {
  const { tier } = useAppSelector((s) => s.auth);
  const isAdmin = tier === 'pin';

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('menopause');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [source, setSource] = useState('');
  const [url, setUrl] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return;
    setLoading(true); setResult(null);
    try {
      const res = await fetch('/api/health/education/upload', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(), category, content: content.trim(),
          summary: summary.trim() || undefined, source: source.trim() || undefined,
          url: url.trim() || undefined,
          tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
        }),
      });
      const data = await res.json();
      setResult(data);
      if (data.success) {
        setTitle(''); setSummary(''); setContent(''); setSource(''); setUrl(''); setTags('');
        setShowForm(false);
        // Force library refresh by reloading page
        window.location.reload();
      }
    } catch { setResult({ success: false, message: 'Network error' }); }
    finally { setLoading(false); }
  };

  return (
    <Box sx={{ mx: 'auto', px: 3, py: 3 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Health Library</Typography>
        {isAdmin && (
          <Button
            variant="outlined"
            startIcon={showForm ? <AdminPanelSettingsIcon /> : <AddIcon />}
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? 'Close' : 'Add Article'}
          </Button>
        )}
      </Stack>

      {isAdmin && showForm && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            <AdminPanelSettingsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Admin: Add Medical Article
          </Typography>
          {result && (
            <Alert severity={result.success ? 'success' : 'error'} sx={{ mb: 2 }} onClose={() => setResult(null)}>
              {result.message}
            </Alert>
          )}
          <Stack spacing={2}>
            <TextField label="Title *" value={title} onChange={e => setTitle(e.target.value)} size="small" fullWidth />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Category</InputLabel>
                <Select value={category} label="Category" onChange={e => setCategory(e.target.value)}>
                  {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c.replace('_', ' ')}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField label="Source" value={source} onChange={e => setSource(e.target.value)} size="small" helperText="e.g., Jean Hailes, AMS, RACGP" sx={{ flex: 1 }} />
            </Stack>
            <TextField label="Summary" value={summary} onChange={e => setSummary(e.target.value)} size="small" fullWidth helperText="1-2 sentence summary shown in card view" />
            <TextField label="Content *" value={content} onChange={e => setContent(e.target.value)} size="small" fullWidth multiline rows={6} helperText="Full article content. Supports markdown formatting." />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Reference URL" value={url} onChange={e => setUrl(e.target.value)} size="small" sx={{ flex: 1 }} />
              <TextField label="Tags (comma-separated)" value={tags} onChange={e => setTags(e.target.value)} size="small" sx={{ flex: 1 }} />
            </Stack>
            <Box sx={{ p: 2, bgcolor: 'rgba(76,175,80,0.08)', borderRadius: 1, border: '1px solid rgba(76,175,80,0.2)' }}>
              <Typography variant="body2" color="success.main" sx={{ fontWeight: 600, mb: 0.5 }}>
                🔗 Chatbot Integration
              </Typography>
              <Typography variant="caption" color="text.secondary">
                This article will be automatically indexed for the AI chatbot. Patients and GPs can reference it through the consultation assistant.
              </Typography>
            </Box>
            <Button variant="contained" onClick={handleSubmit} disabled={loading || !title.trim() || !content.trim()}>
              {loading ? <CircularProgress size={20} /> : 'Publish & Index for Chatbot'}
            </Button>
          </Stack>
        </Paper>
      )}

      <HealthEducationLibrary />
    </Box>
  );
}
