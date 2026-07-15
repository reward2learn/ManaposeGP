'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Container,
  Grid,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import Link from 'next/link';
import type { Route } from 'next';
import AddIcon from '@mui/icons-material/Add';
import { useSession } from '@/hooks/use-session';

interface BlogPostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  sourceUrl?: string;
  sourceName?: string;
  imageUrl?: string;
  authorName: string;
  tags: string[];
  createdAt: string;
}

function BlogSkeleton() {
  return (
    <Grid container spacing={3}>
      {[1, 2, 3, 4].map((i) => (
        <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
          <Card variant="outlined">
            <Skeleton variant="rectangular" height={160} />
            <CardContent>
              <Skeleton variant="text" width="80%" height={28} />
              <Skeleton variant="text" width="100%" height={20} />
              <Skeleton variant="text" width="60%" height={20} />
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function BlogListingPage() {
  const [posts, setPosts] = useState<BlogPostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const { tier, isGp } = useSession();
  const isAdmin = tier === 'pin' || (isGp && tier === 'google');

  useEffect(() => {
    fetch('/api/blog')
      .then((r) => r.json())
      .then((d) => setPosts(d.posts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header row with title + admin button */}
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}
      >
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          ManaposeGP Blog
        </Typography>
        {isAdmin && (
          <Button
            component={Link}
            href="/blog/create"
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            sx={{ mt: 0.5, flexShrink: 0 }}
          >
            Create Post
          </Button>
        )}
      </Stack>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Evidence-based health articles curated for Australian patients and practitioners.
      </Typography>

      {loading ? (
        <BlogSkeleton />
      ) : posts.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            No articles yet.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: isAdmin ? 2 : 0 }}>
            {isAdmin
              ? 'Create the first blog post to get started.'
              : 'Check back soon for new health articles.'}
          </Typography>
          {isAdmin && (
            <Button
              component={Link}
              href="/blog/create"
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
            >
              Create First Post
            </Button>
          )}
        </Box>
      ) : (
        <Grid container spacing={3}>
          {posts.map((post) => (
            <Grid key={post.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Link href={`/blog/${post.slug}` as Route} style={{ textDecoration: 'none', color: 'inherit' }}>
                <Card
                  variant="outlined"
                  sx={{
                    height: '100%',
                    transition: 'box-shadow 0.2s',
                    '&:hover': { boxShadow: 4, borderColor: 'primary.main' },
                  }}
                >
                  {post.imageUrl && (
                    <CardMedia
                      component="img"
                      image={post.imageUrl}
                      alt={post.title}
                      sx={{ height: 'auto', maxHeight: 200, objectFit: 'cover' }}
                    />
                  )}
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, lineHeight: 1.3 }}>
                      {post.title}
                    </Typography>
                    {(post.tags?.length ?? 0) > 0 && (
                      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                        {post.tags.slice(0, 3).map((tag) => (
                          <Chip key={tag} label={tag} size="small" variant="outlined" />
                        ))}
                      </Stack>
                    )}
                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        {post.authorName}
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        {formatDate(post.createdAt)}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Link>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
}
