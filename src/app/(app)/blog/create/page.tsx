'use client';

import { useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Link from 'next/link';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';

export default function BlogCreatePage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    post: { id: string; title: string; slug: string; sourceName?: string; tags: string[] };
    scrapedTitle: string;
  } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/blog/create', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
        setUrl('');
      } else {
        setError(data.error ?? 'Failed to create post');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthGate requiredTier="pin" fallback={<SignInPanelGate requiredTier="pin" />}>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
          Create Blog Post
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          Paste a health article URL below. It will be scraped, enhanced with AI, and published to the blog.
        </Typography>

        {/* Input form */}
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Stack
              component="form"
              direction="row"
              spacing={2}
              onSubmit={handleSubmit}
              sx={{ alignItems: 'flex-start' }}
            >
              <TextField
                fullWidth
                size="medium"
                label="Article URL"
                placeholder="https://www.jeanhailes.org.au/health-a-z/menopause/understanding-menopause"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
                helperText="Health articles, medical journals, or trusted sources work best"
              />
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={!url.trim() || loading}
                startIcon={loading ? <CircularProgress size={18} /> : <CloudDownloadIcon />}
                sx={{ minWidth: 140, mt: 0.5 }}
              >
                {loading ? 'Scraping…' : 'Create Post'}
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Loading state */}
        {loading && (
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2">Scraping URL content…</Typography>
                </Stack>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2">Enhancing with AI (this may take 10–20 seconds)…</Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Success result */}
        {result && (
          <Card variant="outlined" sx={{ borderColor: 'success.main', bgcolor: 'success.50' }}>
            <CardContent>
              <Alert severity="success" sx={{ mb: 2 }}>
                Blog post created successfully!
              </Alert>

              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                {result.post.title}
              </Typography>

              {result.post.sourceName && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Source: {result.post.sourceName}
                </Typography>
              )}

              {result.post.tags.length > 0 && (
                <Stack direction="row" spacing={0.5} sx={{ mb: 2, flexWrap: 'wrap', gap: 0.5 }}>
                  {result.post.tags.map((tag) => (
                    <Chip key={tag} label={tag} size="small" color="primary" variant="outlined" />
                  ))}
                </Stack>
              )}

              <Stack direction="row" spacing={1}>
                <Button
                  component={Link}
                  href={`/blog/${result.post.slug}`}
                  variant="contained"
                  size="small"
                  endIcon={<OpenInNewIcon />}
                >
                  View Post
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setResult(null);
                    setError(null);
                  }}
                >
                  Create Another
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Help text */}
        <Card variant="outlined" sx={{ mt: 3, bgcolor: 'action.hover' }}>
          <CardContent>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Tips
            </Typography>
            <Typography variant="body2" color="text.secondary" component="div">
              <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                <li>Best results from health authority sites (Jean Hailes, RACGP, HealthDirect, AMS)</li>
                <li>Avoid paywalled articles — the scraper needs public access</li>
                <li>Articles with clear headings and paragraph structure work best</li>
                <li>AI enhancement takes ~15 seconds and produces a formatted blog post</li>
                <li>Posts are published immediately and appear on the public /blog page</li>
                <li>You can also use the Telegram bot: <code>@manaposegp_blog_bot</code> (once your account is unblocked)</li>
              </ul>
            </Typography>
          </CardContent>
        </Card>
      </Container>
    </AuthGate>
  );
}
