'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Snackbar,
  Alert,
  CircularProgress,
  Skeleton,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';
import {
  HEALTH_EDUCATION_CATEGORIES,
  HEALTH_EDUCATION_SOURCES,
  HEALTH_EDUCATION_LANGUAGES,
  READING_LEVELS,
  type HealthEducationArticle,
} from '@/domain/admin/health-education-service';

// ── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  menopause: 'Menopause',
  mental_health: 'Mental Health',
  bone_health: 'Bone Health',
  cardiovascular: 'Cardiovascular',
  sexual_health: 'Sexual Health',
  nutrition: 'Nutrition',
  exercise: 'Exercise',
  sleep: 'Sleep',
  general: 'General',
};

const CATEGORY_COLORS: Record<string, string> = {
  menopause: '#C2185B',
  mental_health: '#7B1FA2',
  bone_health: '#E65100',
  cardiovascular: '#C62828',
  sexual_health: '#AD1457',
  nutrition: '#2E7D32',
  exercise: '#1565C0',
  sleep: '#4527A0',
  general: '#546E7A',
};

const SOURCE_LABELS: Record<string, string> = {
  jean_hailes: "Jean Hailes for Women's Health",
  ams: 'Australasian Menopause Society',
  healthdirect: 'healthdirect Australia',
  beyond_blue: 'Beyond Blue',
  racgp: 'RACGP',
  nps: 'NPS MedicineWise',
  pubmed: 'PubMed',
  etg: 'Therapeutic Guidelines',
  osteoporosis_australia: 'Osteoporosis Australia',
  admin: 'Admin (Manual)',
};

function formatSource(source: string): string {
  return SOURCE_LABELS[source] ?? source.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

async function api(url: string, opts?: RequestInit) {
  const res = await fetch(url, { credentials: 'include', ...opts });
  return res.json();
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AdminHealthEducationPage() {
  const [articles, setArticles] = useState<HealthEducationArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState<{ m: string; s: 'success' | 'error' } | null>(null);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editArticle, setEditArticle] = useState<HealthEducationArticle | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editSource, setEditSource] = useState('');
  const [editLanguage, setEditLanguage] = useState('en');
  const [editReadingLevel, setEditReadingLevel] = useState('standard');
  const [editTags, setEditTags] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HealthEducationArticle | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api('/api/admin/health-education');
      if (d.success) setArticles(d.articles as HealthEducationArticle[]);
    } catch {
      setSnack({ m: 'Failed to load articles', s: 'error' });
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  // ── Edit ───────────────────────────────────────────────────────────────────

  const openEdit = (a: HealthEducationArticle) => {
    setEditArticle(a);
    setEditTitle(a.title);
    setEditCategory(a.category);
    setEditContent(a.content);
    setEditSummary(a.summary);
    setEditSource(a.source);
    setEditLanguage(a.language);
    setEditReadingLevel(a.readingLevel || 'standard');
    setEditTags((a.tags || []).join(', '));
    setEditUrl(a.url || '');
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editArticle) return;
    setSaving(true);

    const tagArray = editTags
      ? editTags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    const d = await api('/api/admin/health-education', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editArticle.id,
        title: editTitle,
        category: editCategory,
        content: editContent,
        summary: editSummary,
        source: editSource,
        language: editLanguage,
        readingLevel: editReadingLevel || null,
        tags: tagArray,
        url: editUrl || null,
      }),
    });

    if (d.success) {
      setSnack({ m: 'Article updated', s: 'success' });
      setEditOpen(false);
      fetchArticles();
    } else {
      setSnack({ m: d.error || 'Failed to update', s: 'error' });
    }
    setSaving(false);
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const confirmDelete = (a: HealthEducationArticle) => {
    setDeleteTarget(a);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    const d = await api(`/api/admin/health-education?id=${deleteTarget.id}`, { method: 'DELETE' });

    if (d.success) {
      setSnack({ m: 'Article deleted', s: 'success' });
      setDeleteOpen(false);
      setDeleteTarget(null);
      fetchArticles();
    } else {
      setSnack({ m: d.error || 'Failed to delete', s: 'error' });
    }
    setDeleting(false);
  };

  // ── Content preview ────────────────────────────────────────────────────────

  const stripMarkdown = (md: string, maxLen = 120): string => {
    const text = md
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[\n\r]+/g, ' ')
      .trim();
    return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AuthGate requiredTier="pin" fallback={<SignInPanelGate requiredTier="pin" />}>
      <Box sx={{ maxWidth: 1200, mx: 'auto', px: 3, py: 3 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Health Education</Typography>
          <Button href="/health-education" target="_blank" variant="outlined" size="small" startIcon={<OpenInNewIcon />}>
            View Public Page
          </Button>
        </Stack>

        {loading ? (
          <Skeleton variant="rounded" height={400} />
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Lang</TableCell>
                  <TableCell>Published</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {articles.map((a) => (
                  <TableRow key={a.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {a.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {a.summary ? stripMarkdown(a.summary, 100) : stripMarkdown(a.content, 100)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={CATEGORY_LABELS[a.category] ?? a.category}
                        size="small"
                        sx={{
                          bgcolor: CATEGORY_COLORS[a.category],
                          color: '#fff',
                          fontWeight: 600,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{formatSource(a.source)}</Typography>
                      {a.url && (
                        <Typography variant="caption" color="primary" sx={{ display: 'block', cursor: 'pointer' }}
                          component="a" href={a.url} target="_blank" rel="noopener"
                        >
                          Reference <OpenInNewIcon sx={{ fontSize: 10, verticalAlign: 'text-bottom' }} />
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip label={a.language.toUpperCase()} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{formatDate(a.publishedAt)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                        <Button size="small" variant="outlined" onClick={() => openEdit(a)}>Edit</Button>
                        <IconButton size="small" color="error" onClick={() => confirmDelete(a)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {articles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography color="text.secondary" sx={{ py: 3 }}>
                        No articles yet.{' '}
                        <Button size="small" href="/health-education" sx={{ textTransform: 'none' }}>
                          Add one from the Health Library page
                        </Button>
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* ── Edit Dialog ──────────────────────────────────────────────────── */}
        <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Edit Health Article</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Title *"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                size="small"
                fullWidth
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>Category</InputLabel>
                  <Select value={editCategory} label="Category" onChange={(e) => setEditCategory(e.target.value)}>
                    {HEALTH_EDUCATION_CATEGORIES.map((c) => (
                      <MenuItem key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Source</InputLabel>
                  <Select value={editSource} label="Source" onChange={(e) => setEditSource(e.target.value)}>
                    {HEALTH_EDUCATION_SOURCES.map((s) => (
                      <MenuItem key={s} value={s}>{formatSource(s)}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Language</InputLabel>
                  <Select value={editLanguage} label="Language" onChange={(e) => setEditLanguage(e.target.value)}>
                    {HEALTH_EDUCATION_LANGUAGES.map((l) => (
                      <MenuItem key={l} value={l}>{l.toUpperCase()}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Reading Level</InputLabel>
                  <Select value={editReadingLevel} label="Reading Level" onChange={(e) => setEditReadingLevel(e.target.value)}>
                    {READING_LEVELS.map((r) => (
                      <MenuItem key={r} value={r}>{r.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Reference URL"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  size="small"
                  fullWidth
                  placeholder="https://..."
                />
              </Stack>
              <TextField
                label="Summary"
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
                size="small"
                fullWidth
                multiline
                rows={2}
                helperText="1–2 sentence summary displayed in card view"
              />
              <TextField
                label="Tags (comma-separated)"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                size="small"
                fullWidth
                helperText="e.g., menopause, HRT, hot flushes"
              />
              <TextField
                label="Content (Markdown) *"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                size="small"
                fullWidth
                multiline
                rows={12}
                helperText="Full article content. Supports markdown formatting."
              />
              <Box sx={{ p: 2, bgcolor: 'rgba(76,175,80,0.08)', borderRadius: 1, border: '1px solid rgba(76,175,80,0.2)' }}>
                <Typography variant="body2" color="success.main" sx={{ fontWeight: 600, mb: 0.5 }}>
                  🔗 Chatbot Indexing
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Changing the title, summary, or content will trigger a re-index of this article for the AI chatbot.
                </Typography>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="contained" onClick={handleSave} disabled={saving || !editTitle.trim() || !editContent.trim()}>
              {saving ? <CircularProgress size={18} /> : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ── Delete Confirmation Dialog ───────────────────────────────────── */}
        <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
          <DialogTitle>Delete Article?</DialogTitle>
          <DialogContent>
            <Typography>
              This will permanently remove &ldquo;{deleteTarget?.title}&rdquo; and its chatbot knowledge snippet.
              This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <CircularProgress size={18} /> : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ── Snackbar ─────────────────────────────────────────────────────── */}
        <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}>
          <Alert severity={snack?.s} onClose={() => setSnack(null)} variant="filled">{snack?.m}</Alert>
        </Snackbar>
      </Box>
    </AuthGate>
  );
}
