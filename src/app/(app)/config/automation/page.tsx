'use client';

import { useEffect, useState, useCallback, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Divider,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import LinkIcon from '@mui/icons-material/Link';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';

interface Config {
  enabled: boolean;
  instagramUsername: string;
  maxPostsPerRun: number;
  scheduleTime: string;
  scheduleTimezone: string;
  lastRunAt: string | null;
  totalPostsCreated: number;
}

interface LogEntry {
  id: string;
  runAt: string;
  status: string;
  postsFound: number;
  postsCreated: number;
  errorMessage?: string;
  details?: { durationMs?: number; created?: Array<{ title: string; slug: string }>; message?: string };
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AutomationConfigPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [enabled, setEnabled] = useState(false);
  const [username, setUsername] = useState('menopause_doctor');
  const [maxPosts, setMaxPosts] = useState(5);
  const [scheduleTime, setScheduleTime] = useState('23:00');
  const [scheduleTimezone, setScheduleTimezone] = useState('Australia/Sydney');

  // Single URL scrape state (Instagram)
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<{ title: string; slug: string } | null>(null);
  const [scrapeError, setScrapeError] = useState<string | null>(null);

  // Article URL scrape state
  const [articleUrl, setArticleUrl] = useState('');
  const [articleScraping, setArticleScraping] = useState(false);
  const [articleResult, setArticleResult] = useState<{ title: string; slug: string } | null>(null);
  const [articleError, setArticleError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/config/automation', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        setLogs(data.logs || []);
        setEnabled(data.config.enabled);
        setUsername(data.config.instagramUsername);
        setMaxPosts(data.config.maxPostsPerRun);
        setScheduleTime(data.config.scheduleTime || '23:00');
        setScheduleTimezone(data.config.scheduleTimezone || 'Australia/Sydney');
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/config/automation', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, instagramUsername: username, maxPostsPerRun: maxPosts, scheduleTime, scheduleTimezone }),
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        setSuccess('Configuration saved.');
      } else {
        setError(data.error);
      }
    } catch { setError('Failed to save'); }
    finally { setSaving(false); }
  };

  const handleRunNow = async () => {
    setRunning(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/cron/instagram', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(`Run complete: ${data.postsCreated} posts created from ${data.postsFound} found.`);
        fetchConfig();
      } else {
        setError(data.error || 'Run failed');
      }
    } catch { setError('Run failed'); }
    finally { setRunning(false); }
  };

  const handleScrapeUrl = async () => {
    if (!scrapeUrl.trim()) return;
    setScraping(true);
    setScrapeResult(null);
    setScrapeError(null);
    try {
      const res = await fetch('/api/config/automation?action=scrape-url', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scrapeUrl }),
      });
      const data = await res.json();
      if (data.success) {
        setScrapeResult(data.post);
        setScrapeUrl('');
        setSuccess(`Post created: ${data.post.title}`);
        fetchConfig(); // Refresh logs
      } else {
        setScrapeError(data.error || 'Failed to extract post');
      }
    } catch {
      setScrapeError('Network error');
    }
    finally { setScraping(false); }
  };

  const handleScrapeArticle = async () => {
    if (!articleUrl.trim()) return;
    setArticleScraping(true);
    setArticleResult(null);
    setArticleError(null);
    try {
      const res = await fetch('/api/config/automation?action=scrape-url', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: articleUrl, type: 'article' }),
      });
      const data = await res.json();
      if (data.success) {
        setArticleResult(data.post);
        setArticleUrl('');
        setSuccess(`Article created: ${data.post.title}`);
        fetchConfig();
      } else {
        setArticleError(data.error || 'Failed to scrape article');
      }
    } catch {
      setArticleError('Network error');
    }
    finally { setArticleScraping(false); }
  };

  return (
    <AuthGate requiredTier="pin" fallback={<SignInPanelGate requiredTier="pin" />}>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
          Instagram Automation
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          Automatically create blog posts from Instagram content. Vercel Cron fires daily at 13:00 UTC — configure your schedule time to match your timezone equivalent of 13:00 UTC.
        </Typography>

        {/* Config form */}
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent component="form" onSubmit={handleSave}>
            <Stack spacing={3}>
              <FormControlLabel
                control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
                label={
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      Enable nightly automation
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      When enabled, new Instagram posts will be automatically converted to blog posts at 11pm AEST daily.
                    </Typography>
                  </Box>
                }
              />

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Instagram Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    helperText="Without @ symbol (e.g., menopause_doctor)"
                    size="small"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Max Posts Per Run"
                    type="number"
                    value={maxPosts}
                    onChange={(e) => setMaxPosts(Number(e.target.value))}
                    helperText="Limits how many posts to process each night (1-10)"
                    size="small"
                    slotProps={{ htmlInput: { min: 1, max: 10 } }}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField
                    fullWidth
                    label="Schedule Time"
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    helperText="Time to run daily"
                    size="small"
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Timezone</InputLabel>
                    <Select value={scheduleTimezone} label="Timezone" onChange={(e) => setScheduleTimezone(e.target.value)}>
                      <MenuItem value="Australia/Sydney">Sydney (AEST)</MenuItem>
                      <MenuItem value="Australia/Melbourne">Melbourne (AEST)</MenuItem>
                      <MenuItem value="Australia/Brisbane">Brisbane (AEST)</MenuItem>
                      <MenuItem value="Australia/Perth">Perth (AWST)</MenuItem>
                      <MenuItem value="Pacific/Auckland">Auckland (NZST)</MenuItem>
                      <MenuItem value="Asia/Singapore">Singapore (SGT)</MenuItem>
                      <MenuItem value="Asia/Jakarta">Jakarta (WIB)</MenuItem>
                      <MenuItem value="UTC">UTC</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
              {success && <Alert severity="success" onClose={() => setSuccess(null)}>{success}</Alert>}

              <Stack direction="row" spacing={2}>
                <Button type="submit" variant="contained" disabled={saving}>
                  {saving ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
                  Save Configuration
                </Button>
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={running ? <CircularProgress size={16} /> : <PlayArrowIcon />}
                  onClick={handleRunNow}
                  disabled={running}
                >
                  {running ? 'Running…' : 'Run Now'}
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {/* Scrape Single Post URL — like /blog/create */}
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              Extract Single Instagram Post
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Paste an Instagram post URL to extract it immediately — bypasses the profile scraper and schedule.
              Duplicate posts (same URL) are skipped automatically.
            </Typography>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
              <TextField
                fullWidth
                label="Instagram Post URL"
                placeholder="https://www.instagram.com/p/ABC123xyz/"
                value={scrapeUrl}
                onChange={(e) => setScrapeUrl(e.target.value)}
                size="small"
                disabled={scraping}
                helperText="Works with /p/ and /reel/ URLs"
              />
              <Button
                variant="contained"
                onClick={handleScrapeUrl}
                disabled={scraping || !scrapeUrl.trim()}
                startIcon={scraping ? <CircularProgress size={16} /> : <LinkIcon />}
                sx={{ minWidth: 140, mt: 0.5 }}
              >
                {scraping ? 'Extracting…' : 'Extract Post'}
              </Button>
            </Stack>
            {scrapeResult && (
              <Alert severity="success" sx={{ mt: 2 }} onClose={() => setScrapeResult(null)}>
                Post created: <strong>{scrapeResult.title}</strong> —{' '}
                <a href={`/blog/${scrapeResult.slug}`} target="_blank" rel="noopener" style={{ fontWeight: 600 }}>View post</a>
              </Alert>
            )}
            {scrapeError && (
              <Alert severity="error" sx={{ mt: 2 }} onClose={() => setScrapeError(null)}>{scrapeError}</Alert>
            )}
          </CardContent>
        </Card>

        {/* Status card */}
        {config && (
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Status
                </Typography>
                <Button size="small" startIcon={<RefreshIcon />} onClick={fetchConfig} disabled={loading}>
                  Refresh
                </Button>
              </Stack>

              <Grid container spacing={2}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Typography variant="caption" color="text.secondary">Status</Typography>
                  <Chip
                    label={config.enabled ? 'Active' : 'Paused'}
                    size="small"
                    color={config.enabled ? 'success' : 'default'}
                    sx={{ mt: 0.5 }}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Typography variant="caption" color="text.secondary">Last Run</Typography>
                  <Typography variant="body2">{formatDate(config.lastRunAt)}</Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Typography variant="caption" color="text.secondary">Total Posts Created</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{config.totalPostsCreated}</Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Typography variant="caption" color="text.secondary">Schedule</Typography>
                  <Typography variant="body2">{config.scheduleTime || '23:00'} {config.scheduleTimezone || 'AEST'}</Typography>
                  <Typography variant="caption" color="text.disabled">Vercel Cron fires at 13:00 UTC daily</Typography>
                </Grid>
              </Grid>
          </CardContent>
        </Card>
        )}

        {/* Scrape Any Health Article URL */}
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              Extract Health Article from URL
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Paste any health article URL (Jean Hailes, RACGP, HealthDirect, AMS, or other trusted sources).
              The article will be scraped, enhanced with AI, and published to the blog — then indexed for the AI assistant.
            </Typography>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
              <TextField
                fullWidth
                label="Article URL"
                placeholder="https://www.jeanhailes.org.au/health-a-z/menopause/understanding-menopause"
                value={articleUrl}
                onChange={(e) => setArticleUrl(e.target.value)}
                size="small"
                disabled={articleScraping}
                helperText="Health articles, medical journals, or trusted health sources work best"
              />
              <Button
                variant="contained"
                color="secondary"
                onClick={handleScrapeArticle}
                disabled={articleScraping || !articleUrl.trim()}
                startIcon={articleScraping ? <CircularProgress size={16} /> : <LinkIcon />}
                sx={{ minWidth: 140, mt: 0.5 }}
              >
                {articleScraping ? 'Scraping…' : 'Scrape & Publish'}
              </Button>
            </Stack>
            {articleResult && (
              <Alert severity="success" sx={{ mt: 2 }} onClose={() => setArticleResult(null)}>
                Article created: <strong>{articleResult.title}</strong> —{' '}
                <a href={`/blog/${articleResult.slug}`} target="_blank" rel="noopener" style={{ fontWeight: 600 }}>View post</a>
              </Alert>
            )}
            {articleError && (
              <Alert severity="error" sx={{ mt: 2 }} onClose={() => setArticleError(null)}>{articleError}</Alert>
            )}
          </CardContent>
        </Card>

        {/* Run history */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            Run History
          </Typography>

          {logs.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No runs yet. Enable automation or click "Run Now" to test.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Time</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Found</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Details</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(log.runAt)}</TableCell>
                      <TableCell>
                        <Chip
                          label={log.status}
                          size="small"
                          color={log.status === 'success' ? 'success' : log.status === 'partial' ? 'warning' : log.status === 'disabled' ? 'default' : 'error'}
                        />
                      </TableCell>
                      <TableCell>{log.postsFound}</TableCell>
                      <TableCell>{log.postsCreated}</TableCell>
                      <TableCell>
                        {log.errorMessage ? (
                          <Typography variant="caption" color="error.main">{log.errorMessage.slice(0, 100)}</Typography>
                        ) : log.details?.message ? (
                          <Typography variant="caption" color="text.secondary">{log.details.message}</Typography>
                        ) : log.details?.created ? (
                          <Typography variant="caption" color="text.secondary">
                            {log.details.created.map((c: { title: string }) => c.title.slice(0, 60)).join(', ')}
                          </Typography>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Container>
    </AuthGate>
  );
}
