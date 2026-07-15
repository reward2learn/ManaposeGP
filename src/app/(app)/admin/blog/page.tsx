'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Switch, FormControlLabel, Snackbar, Alert,
  CircularProgress, Skeleton, Link as MuiLink,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  sourceUrl?: string;
  sourceName?: string;
  imageUrl?: string;
  sectionImages: Array<{ src: string; alt: string; caption?: string }>;
  authorName: string;
  tags: string[];
  published: boolean;
  createdAt: string;
}

async function api(url: string, opts?: RequestInit) {
  const res = await fetch(url, { credentials: 'include', ...opts });
  return res.json();
}

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState<{ m: string; s: 'success' | 'error' } | null>(null);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editPost, setEditPost] = useState<BlogPost | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editExcerpt, setEditExcerpt] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editSectionImages, setEditSectionImages] = useState('');
  const [editPublished, setEditPublished] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const d = await api('/api/blog/admin');
    if (d.success) setPosts(d.posts as BlogPost[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const openEdit = (post: BlogPost) => {
    setEditPost(post);
    setEditTitle(post.title);
    setEditContent(post.content);
    setEditExcerpt(post.excerpt || '');
    setEditImageUrl(post.imageUrl || '');
    setEditSectionImages(JSON.stringify(post.sectionImages || [], null, 2));
    setEditPublished(post.published);
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editPost) return;
    setSaving(true);
    let sectionImages: Array<{ src: string; alt: string; caption?: string }> = [];
    try { sectionImages = JSON.parse(editSectionImages); } catch { /* keep empty */ }

    const d = await api('/api/blog/admin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editPost.id,
        title: editTitle,
        content: editContent,
        excerpt: editExcerpt || null,
        imageUrl: editImageUrl || null,
        sectionImages,
        published: editPublished,
      }),
    });
    if (d.success) {
      setSnack({ m: 'Post updated', s: 'success' });
      setEditOpen(false);
      fetchPosts();
    } else {
      setSnack({ m: d.error || 'Failed', s: 'error' });
    }
    setSaving(false);
  };

  const togglePublished = async (post: BlogPost) => {
    const d = await api('/api/blog/admin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: post.id, published: !post.published }),
    });
    if (d.success) {
      setSnack({ m: post.published ? 'Post set to draft' : 'Post published', s: 'success' });
      fetchPosts();
    } else {
      setSnack({ m: d.error || 'Failed', s: 'error' });
    }
  };

  return (
    <AuthGate requiredTier="pin" fallback={<SignInPanelGate requiredTier="pin" />}>
      <Box sx={{ maxWidth: 1200, mx: 'auto', px: 3, py: 3 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Blog Posts</Typography>
          <Button href="/blog/create" variant="contained" size="small">New Post</Button>
        </Stack>

        {loading ? (
          <Skeleton variant="rounded" height={400} />
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Image</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {posts.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{p.title}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {p.excerpt?.slice(0, 80)}…
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {p.sourceUrl ? (
                        <MuiLink href={p.sourceUrl} target="_blank" rel="noopener" variant="caption">
                          {p.sourceName || 'Link'} <OpenInNewIcon sx={{ fontSize: 12, verticalAlign: 'text-bottom' }} />
                        </MuiLink>
                      ) : (
                        <Typography variant="caption" color="text.disabled">Manual</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={p.published ? 'Published' : 'Draft'}
                        size="small"
                        color={p.published ? 'success' : 'default'}
                        onClick={() => togglePublished(p)}
                        sx={{ cursor: 'pointer' }}
                      />
                    </TableCell>
                    <TableCell>
                      {p.imageUrl ? (
                        <Box component="img" src={p.imageUrl} alt="" sx={{ width: 48, height: 32, borderRadius: 1, objectFit: 'cover' }} />
                      ) : (
                        <Typography variant="caption" color="text.disabled">None</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {new Date(p.createdAt).toLocaleDateString('en-AU')}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                        <Button size="small" variant="outlined" onClick={() => openEdit(p)}>Edit</Button>
                        <Button
                          size="small"
                          component="a"
                          href={`/blog/${p.slug}`}
                          target="_blank"
                          variant="outlined"
                        >
                          View
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {posts.length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center"><Typography color="text.secondary" sx={{ py: 3 }}>No blog posts yet.</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Edit Dialog */}
        <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Edit Blog Post</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} size="small" fullWidth />
              <Stack direction="row" spacing={2}>
                <TextField label="Card Image URL" value={editImageUrl} onChange={(e) => setEditImageUrl(e.target.value)} size="small" fullWidth helperText="Primary image for blog card and header" />
              </Stack>
              <TextField label="Excerpt" value={editExcerpt} onChange={(e) => setEditExcerpt(e.target.value)} size="small" fullWidth multiline rows={2} />
              <TextField label="Section Images (JSON)" value={editSectionImages} onChange={(e) => setEditSectionImages(e.target.value)} size="small" fullWidth multiline rows={3} helperText='JSON array: [{"src":"url","alt":"description","caption":"optional"}]' />
              <TextField label="Content (Markdown)" value={editContent} onChange={(e) => setEditContent(e.target.value)} size="small" fullWidth multiline rows={10} />
              <FormControlLabel
                control={<Switch checked={editPublished} onChange={(e) => setEditPublished(e.target.checked)} />}
                label="Published"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="contained" onClick={handleSave} disabled={saving}>
              {saving ? <CircularProgress size={18} /> : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}>
          <Alert severity={snack?.s} onClose={() => setSnack(null)} variant="filled">{snack?.m}</Alert>
        </Snackbar>
      </Box>
    </AuthGate>
  );
}
