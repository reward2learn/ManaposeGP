'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ThumbDownOutlinedIcon from '@mui/icons-material/ThumbDownOutlined';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import type { HealthEducation } from '@/generated/prisma';

// ── Constants ────────────────────────────────────────────────────────────────

type CategoryKey =
  | 'menopause'
  | 'mental_health'
  | 'bone_health'
  | 'cardiovascular'
  | 'sexual_health'
  | 'nutrition'
  | 'exercise'
  | 'sleep';

const ALL_CATEGORIES: { key: CategoryKey | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'menopause', label: 'Menopause' },
  { key: 'mental_health', label: 'Mental Health' },
  { key: 'bone_health', label: 'Bone Health' },
  { key: 'cardiovascular', label: 'Cardiovascular' },
  { key: 'sexual_health', label: 'Sexual Health' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'exercise', label: 'Exercise' },
  { key: 'sleep', label: 'Sleep' },
];

const CATEGORY_COLORS: Record<CategoryKey, string> = {
  menopause: '#C2185B',
  mental_health: '#7B1FA2',
  bone_health: '#E65100',
  cardiovascular: '#C62828',
  sexual_health: '#AD1457',
  nutrition: '#2E7D32',
  exercise: '#1565C0',
  sleep: '#4527A0',
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
};

function formatSource(source: string): string {
  return SOURCE_LABELS[source] ?? source.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ── API types ────────────────────────────────────────────────────────────────

interface ArticlesResponse {
  success: boolean;
  articles: HealthEducation[];
  total: number;
}

// ── Component ────────────────────────────────────────────────────────────────

export function HealthEducationLibrary() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [articles, setArticles] = useState<HealthEducation[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | 'all'>('all');
  const [selectedArticle, setSelectedArticle] = useState<HealthEducation | null>(null);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down' | null>>({});

  // ── Fetch articles ─────────────────────────────────────────────────────────
  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') {
        params.set('category', selectedCategory);
      }
      params.set('lang', 'en');
      if (searchQuery.trim().length > 0) {
        params.set('search', searchQuery.trim());
      }
      params.set('limit', '50');

      const response = await fetch(`/api/health/education?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: ArticlesResponse = await response.json();
      if (!data.success) {
        throw new Error('API returned unsuccessful response');
      }

      setArticles(data.articles);
      setTotal(data.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load articles';
      setError(message);
      setArticles([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    void fetchArticles();
  }, [fetchArticles]);

  // ── Debounced search handler ───────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState<string>('');

  useEffect(() => {
    const timer = globalThis.setTimeout(() => {
      setSearchQuery(searchInput);
    }, 400);
    return () => globalThis.clearTimeout(timer);
  }, [searchInput]);

  // ── Dialog handlers ────────────────────────────────────────────────────────
  const handleOpenArticle = useCallback((article: HealthEducation) => {
    setSelectedArticle(article);
    setDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setSelectedArticle(null);
  }, []);

  // ── Feedback handler ───────────────────────────────────────────────────────
  const handleFeedback = useCallback((articleId: string, type: 'up' | 'down') => {
    setFeedback((prev) => ({
      ...prev,
      [articleId]: prev[articleId] === type ? null : type,
    }));
  }, []);

  // ── Filtered articles (search is server-side, but local for responsiveness) ─
  const displayArticles = useMemo(() => articles, [articles]);

  // ── Skeleton grid ──────────────────────────────────────────────────────────
  const skeletonCards = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => (
        <Grid key={`skeleton-${i}`} size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Skeleton variant="rounded" width={80} height={24} sx={{ mb: 1 }} />
              <Skeleton variant="text" width="80%" height={32} sx={{ mb: 1 }} />
              <Skeleton variant="text" width="100%" />
              <Skeleton variant="text" width="100%" />
              <Skeleton variant="text" width="60%" />
              <Skeleton variant="text" width="40%" height={20} sx={{ mt: 1 }} />
            </CardContent>
          </Card>
        </Grid>
      )),
    [],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto', px: { xs: 2, md: 3 } }}>
      {/* ── Header & Search ─────────────────────────────────────────────── */}
      <Typography variant="h4" sx={{ mb: 1, fontWeight: 700 }}>
        Health Education Library
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Evidence-based articles about menopause, bone health, mental wellbeing, and more.
      </Typography>

      <TextField
        fullWidth
        placeholder="Search articles by title or topic..."
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        slotProps={{
          input: {
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
          },
        }}
        sx={{ mb: 3 }}
      />

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
        {/* ── Sidebar: Category filter ──────────────────────────────────── */}
        <Box
          sx={{
            width: { xs: '100%', md: 280 },
            flexShrink: 0,
          }}
        >
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            Categories
          </Typography>
          <Stack direction={{ xs: 'row', md: 'column' }} spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {ALL_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.key;
              const isAll = cat.key === 'all';
              const chipColor =
                !isAll && isSelected && cat.key in CATEGORY_COLORS
                  ? CATEGORY_COLORS[cat.key as CategoryKey]
                  : undefined;

              return (
                <Chip
                  key={cat.key}
                  label={`${cat.label}${!isAll && selectedCategory === cat.key ? ` (${total})` : ''}`}
                  onClick={() => setSelectedCategory(cat.key)}
                  variant={isSelected ? 'filled' : 'outlined'}
                  color={isSelected ? 'primary' : 'default'}
                  sx={{
                    fontWeight: isSelected ? 600 : 400,
                    ...(chipColor && isSelected
                      ? { bgcolor: chipColor, color: '#fff', '&:hover': { bgcolor: chipColor } }
                      : {}),
                  }}
                />
              );
            })}
          </Stack>
        </Box>

        {/* ── Main content: Article cards ───────────────────────────────── */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* ── Results count ──────────────────────────────────────────── */}
          {!loading && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {total} {total === 1 ? 'article' : 'articles'} found
              {searchQuery ? ` for "${searchQuery}"` : ''}
            </Typography>
          )}

          {/* ── Error state ───────────────────────────────────────────── */}
          {error && (
            <Typography color="error" sx={{ mb: 2 }}>
              {error}
            </Typography>
          )}

          {/* ── Loading: Skeleton cards ───────────────────────────────── */}
          {loading && (
            <Grid container spacing={2}>
              {skeletonCards}
            </Grid>
          )}

          {/* ── Empty state ───────────────────────────────────────────── */}
          {!loading && !error && displayArticles.length === 0 && (
            <Box
              sx={{
                textAlign: 'center',
                py: 8,
                color: 'text.secondary',
              }}
            >
              <Typography variant="h6" sx={{ mb: 1 }}>
                No articles found for this category.
              </Typography>
              <Typography variant="body2">
                Try selecting a different category or adjusting your search.
              </Typography>
            </Box>
          )}

          {/* ── Article grid ──────────────────────────────────────────── */}
          {!loading && displayArticles.length > 0 && (
            <Grid container spacing={2}>
              {displayArticles.map((article) => (
                <Grid key={article.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'box-shadow 0.2s',
                      '&:hover': {
                        boxShadow: 4,
                      },
                    }}
                  >
                    <CardActionArea
                      onClick={() => handleOpenArticle(article)}
                      sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
                    >
                      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        {/* Category badge */}
                        <Chip
                          label={
                            ALL_CATEGORIES.find((c) => c.key === article.category)?.label ??
                            article.category.replace(/_/g, ' ')
                          }
                          size="small"
                          sx={{
                            alignSelf: 'flex-start',
                            mb: 1,
                            bgcolor:
                              article.category in CATEGORY_COLORS
                                ? CATEGORY_COLORS[article.category as CategoryKey]
                                : undefined,
                            color: article.category in CATEGORY_COLORS ? '#fff' : undefined,
                            fontWeight: 600,
                            fontSize: '0.75rem',
                          }}
                        />

                        {/* Title */}
                        <Typography variant="h6" sx={{ mb: 1, lineHeight: 1.3, fontWeight: 600 }}>
                          {article.title}
                        </Typography>

                        {/* Summary */}
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            mb: 2,
                            flex: 1,
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {article.summary}
                        </Typography>

                        {/* Source label */}
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                          {formatSource(article.source)}
                        </Typography>

                        {/* Tags */}
                        {article.tags.length > 0 && (
                          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                            {article.tags.slice(0, 3).map((tag) => (
                              <Chip
                                key={tag}
                                label={tag}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '0.7rem' }}
                              />
                            ))}
                            {article.tags.length > 3 && (
                              <Chip
                                label={`+${article.tags.length - 3}`}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '0.7rem' }}
                              />
                            )}
                          </Stack>
                        )}
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </Box>

      {/* ── Article detail dialog ──────────────────────────────────────────── */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        scroll="paper"
        slotProps={{
          paper: {
            sx: { maxHeight: '90vh' },
          },
        }}
      >
        {selectedArticle && (
          <>
            <DialogTitle sx={{ pr: 6 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                {selectedArticle.title}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
                <Chip
                  label={
                    ALL_CATEGORIES.find((c) => c.key === selectedArticle.category)?.label ??
                    selectedArticle.category.replace(/_/g, ' ')
                  }
                  size="small"
                  sx={{
                    bgcolor:
                      selectedArticle.category in CATEGORY_COLORS
                        ? CATEGORY_COLORS[selectedArticle.category as CategoryKey]
                        : undefined,
                    color: selectedArticle.category in CATEGORY_COLORS ? '#fff' : undefined,
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  {formatSource(selectedArticle.source)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  &middot; Published {formatDate(selectedArticle.publishedAt.toString())}
                </Typography>
                {selectedArticle.reviewedAt && (
                  <Typography variant="caption" color="text.secondary">
                    &middot; Reviewed {formatDate(selectedArticle.reviewedAt.toString())}
                  </Typography>
                )}
              </Stack>
              <IconButton
                aria-label="close"
                onClick={handleCloseDialog}
                sx={{ position: 'absolute', right: 8, top: 8 }}
              >
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers>
              {/* Article body */}
              <Box
                sx={{
                  '& p': { mb: 2, lineHeight: 1.8 },
                  '& h2': { mt: 3, mb: 1.5, fontWeight: 600 },
                  '& h3': { mt: 2, mb: 1, fontWeight: 600 },
                  '& ul, & ol': { mb: 2, pl: 3 },
                  '& li': { mb: 0.5 },
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.8,
                  fontSize: '1rem',
                }}
              >
                {selectedArticle.content}
              </Box>

              {/* Tags */}
              {selectedArticle.tags.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                    {selectedArticle.tags.map((tag) => (
                      <Chip key={tag} label={tag} size="small" variant="outlined" />
                    ))}
                  </Stack>
                </Box>
              )}

              {/* Source attribution & URL */}
              <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Source
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatSource(selectedArticle.source)}
                </Typography>
                {selectedArticle.url && (
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    <a
                      href={selectedArticle.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'inherit' }}
                    >
                      {selectedArticle.url}
                    </a>
                  </Typography>
                )}
              </Box>

              {/* Feedback: "Was this helpful?" */}
              <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Was this helpful?
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => handleFeedback(selectedArticle.id, 'up')}
                    color={feedback[selectedArticle.id] === 'up' ? 'primary' : 'default'}
                    aria-label="Thumbs up"
                  >
                    <ThumbUpOutlinedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleFeedback(selectedArticle.id, 'down')}
                    color={feedback[selectedArticle.id] === 'down' ? 'primary' : 'default'}
                    aria-label="Thumbs down"
                  >
                    <ThumbDownOutlinedIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Box>
            </DialogContent>
          </>
        )}
      </Dialog>
    </Box>
  );
}
