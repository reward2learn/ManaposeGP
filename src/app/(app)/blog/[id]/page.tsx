import { notFound } from 'next/navigation';
import { getBlogPostBySlug } from '@/domain/blog/blog-service';
import { Container, Typography, Box, Chip, Stack, Link as MuiLink } from '@mui/material';
import ReactMarkdown from 'react-markdown';

interface BlogPostPageProps {
  params: Promise<{ id: string }>;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { id: slug } = await params;
  const post = await getBlogPostBySlug(slug);

  if (!post) notFound();

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Header */}
      <Typography variant="h3" sx={{ fontWeight: 800, mb: 2, lineHeight: 1.2 }}>
        {post.title}
      </Typography>

      <Stack direction="row" spacing={2} sx={{ mb: 3, alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          By {post.authorName}
        </Typography>
        <Typography variant="body2" color="text.disabled">
          {formatDate(post.createdAt)}
        </Typography>
        {post.sourceUrl && (
          <MuiLink href={post.sourceUrl} target="_blank" rel="noopener" variant="body2" color="primary">
            View original source →
          </MuiLink>
        )}
      </Stack>

      {(post.tags?.length ?? 0) > 0 && (
        <Stack direction="row" spacing={0.5} sx={{ mb: 3, flexWrap: 'wrap', gap: 0.5 }}>
          {post.tags.map((tag: string) => (
            <Chip key={tag} label={tag} size="small" color="primary" variant="outlined" />
          ))}
        </Stack>
      )}

      {post.excerpt && (
        <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 4, fontStyle: 'italic', borderLeft: '3px solid', borderColor: 'primary.main', pl: 2 }}>
          {post.excerpt}
        </Typography>
      )}

      {/* Article body */}
      <Box
        sx={{
          '& h2': { fontWeight: 700, mt: 4, mb: 1.5, fontSize: '1.5rem' },
          '& h3': { fontWeight: 600, mt: 3, mb: 1, fontSize: '1.2rem' },
          '& p': { mb: 2, lineHeight: 1.8, color: 'text.primary' },
          '& ul, & ol': { mb: 2, pl: 3 },
          '& li': { mb: 0.5 },
          '& blockquote': { borderLeft: '3px solid', borderColor: 'divider', pl: 2, py: 0.5, my: 2, color: 'text.secondary' },
          '& strong': { fontWeight: 700 },
          '& a': { color: 'primary.main' },
          '& img': {
            maxWidth: '100%',
            height: 'auto',
            borderRadius: 2,
            my: 2,
            display: 'block',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          },
        }}
      >
        <ReactMarkdown>{post.content}</ReactMarkdown>
      </Box>

      {/* Footer */}
      <Box sx={{ mt: 6, pt: 3, borderTop: 1, borderColor: 'divider' }}>
        {post.sourceName && (
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.5 }}>
            Originally sourced from {post.sourceName}
          </Typography>
        )}
        <Typography variant="caption" color="text.disabled">
          This article was automatically curated by ManaposeGP. Content is for educational purposes only and does not constitute medical advice.
        </Typography>
      </Box>
    </Container>
  );
}
