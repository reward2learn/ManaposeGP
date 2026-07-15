'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  Paper,
  Skeleton,
  Typography,
} from '@mui/material';
import { useSession } from '@/hooks/use-session';
import {
  useGetMetricsQuery,
  type DailyAverage,
  type MetricData,
} from '@/store/apis/health-api';

// ── Metric card configuration ──────────────────────────────────────────────

interface MetricCardConfig {
  type: 'cardiovascular' | 'sleep' | 'temperature' | 'activity' | 'hrv';
  emoji: string;
  label: string;
  color: string;
  unitLabel: string;
  queryKey: string;
}

const METRIC_CARDS: MetricCardConfig[] = [
  {
    type: 'cardiovascular',
    emoji: '\u{1FAC0}',
    label: 'Resting Heart Rate',
    color: '#ef4444',
    unitLabel: 'bpm',
    queryKey: 'resting_heart_rate',
  },
  {
    type: 'sleep',
    emoji: '\u{1F634}',
    label: 'Sleep Duration',
    color: '#3b82f6',
    unitLabel: 'hrs',
    queryKey: 'sleep_duration',
  },
  {
    type: 'temperature',
    emoji: '\u{1F321}\uFE0F',
    label: 'Wrist Temperature',
    color: '#f97316',
    unitLabel: '\u00B0C',
    queryKey: 'wrist_temperature',
  },
  {
    type: 'activity',
    emoji: '\u{1F463}',
    label: 'Daily Steps',
    color: '#22c55e',
    unitLabel: 'steps',
    queryKey: 'steps',
  },
  {
    type: 'hrv',
    emoji: '\u{1F4CA}',
    label: 'HRV',
    color: '#a855f7',
    unitLabel: 'ms',
    queryKey: 'hrv',
  },
] as const;

const DEFAULT_QUERY_TYPES = METRIC_CARDS.map((c) => c.queryKey).join(',');

// ── Sparkline sub-component ────────────────────────────────────────────────

const SPARKLINE_HEIGHT = 56;
const BAR_MIN_HEIGHT_PX = 4;

interface SparklineProps {
  dailyAverages: DailyAverage[];
}

function Sparkline({ dailyAverages }: SparklineProps) {
  const maxValue = useMemo(() => {
    if (dailyAverages.length === 0) return 1;
    const max = Math.max(...dailyAverages.map((d) => d.value));
    return max <= 0 ? 1 : max;
  }, [dailyAverages]);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '3px',
        height: SPARKLINE_HEIGHT,
        mt: 1.5,
      }}
    >
      {dailyAverages.map((point) => {
        const ratio = point.value / maxValue;
        const heightPx = Math.max(
          BAR_MIN_HEIGHT_PX,
          ratio * SPARKLINE_HEIGHT,
        );

        return (
          <Box
            key={point.date}
            sx={{
              flex: 1,
              height: heightPx,
              minWidth: 6,
              bgcolor: 'primary.main',
              borderRadius: 0.5,
              opacity: 0.78,
              transition: 'opacity 0.2s ease',
              '&:hover': { opacity: 1 },
            }}
          />
        );
      })}
    </Box>
  );
}

// ── Single metric card sub-component ───────────────────────────────────────

interface MetricCardItemProps {
  config: MetricCardConfig;
  data: MetricData | undefined;
}

function MetricCardItem({ config, data }: MetricCardItemProps) {
  const hasData =
    data !== undefined &&
    data.dailyAverages !== undefined &&
    data.dailyAverages.length > 0;

  return (
    <Paper
      elevation={2}
      sx={{
        p: 2.5,
        minWidth: 200,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderTop: '3px solid',
        borderTopColor: config.color,
        bgcolor: 'rgba(255,255,255,0.03)',
        borderRadius: 2,
        transition: 'box-shadow 0.25s ease',
        '&:hover': {
          boxShadow: (theme) => theme.shadows[4],
        },
      }}
    >
      {/* ── Header row: emoji + label ─────────────────────────────── */}
      <Typography
        variant="subtitle2"
        sx={{
          fontWeight: 600,
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontSize: '0.7rem',
          mb: 0.75,
        }}
      >
        {config.emoji} {config.label}
      </Typography>

      {/* ── Value ─────────────────────────────────────────────────── */}
      {hasData ? (
        <>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mb: 0.5 }}>
            <Typography
              variant="h5"
              component="span"
              sx={{ fontWeight: 700, lineHeight: 1.2 }}
            >
              {data.current.toLocaleString()}
            </Typography>
            <Typography
              variant="caption"
              component="span"
              sx={{ color: 'text.secondary', fontWeight: 500 }}
            >
              {config.unitLabel}
            </Typography>
          </Box>

          <Box sx={{ mt: 'auto' }}>
            <Sparkline dailyAverages={data.dailyAverages} />
          </Box>
        </>
      ) : (
        <Box sx={{ mt: 1 }}>
          <Chip
            label="No data"
            size="small"
            variant="outlined"
            sx={{
              opacity: 0.5,
              borderColor: 'text.disabled',
              color: 'text.disabled',
            }}
          />
        </Box>
      )}
    </Paper>
  );
}

// ── Skeleton loading grid ──────────────────────────────────────────────────

const SKELETON_COUNT = METRIC_CARDS.length;

function LoadingSkeleton() {
  return (
    <Grid container spacing={2}>
      {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
        <Grid key={i} size={{ xs: 12, md: 4 }}>
          <Skeleton
            variant="rounded"
            height={180}
            sx={{ borderRadius: 2 }}
          />
        </Grid>
      ))}
    </Grid>
  );
}

// ── Simple "coming in phase 2" dialog ──────────────────────────────────────

interface ManualEntryDialogProps {
  open: boolean;
  onClose: () => void;
}

function ManualEntryDialog({ open, onClose }: ManualEntryDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>Manual Entry</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Manual health metric entry is coming in Phase 2. For now, connect
          Apple Health to automatically sync your metrics.
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
          <Button onClick={onClose} variant="outlined" size="small">
            OK
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

// ── Public component ───────────────────────────────────────────────────────

export interface HealthMetricsCardsProps {
  profileId?: string;
}

export function HealthMetricsCards({ profileId }: HealthMetricsCardsProps) {
  const { isAuthenticated } = useSession();
  const [manualEntryOpen, setManualEntryOpen] = useState(false);

  const {
    data: metricsData,
    isLoading,
    isError,
    refetch,
  } = useGetMetricsQuery({
    types: DEFAULT_QUERY_TYPES,
    days: 7,
    ...(profileId ? { profileId } : {}),
  });

  const handleRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  // ── Loading state ──────────────────────────────────────────────────
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // ── Error state ────────────────────────────────────────────────────
  if (isError) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={handleRetry}>
            Retry
          </Button>
        }
      >
        Failed to load health metrics. Please try again.
      </Alert>
    );
  }

  // ── Overall empty state (no metric has any data) ───────────────────
  const metrics = metricsData?.metrics ?? {};
  const hasAnyData = Object.values(metrics).some(
    (m) => m.dailyAverages !== undefined && m.dailyAverages.length > 0,
  );

  if (!hasAnyData) {
    return (
      <>
        <Paper
          variant="outlined"
          sx={{
            p: 4,
            textAlign: 'center',
            bgcolor: 'action.hover',
            borderRadius: 2,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            Connect Apple Health to see your metrics
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}
          >
            {isAuthenticated
              ? 'Sync your Apple Watch or Health data to populate your health dashboard.'
              : 'Sign in and connect Apple Health to view your metrics.'}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setManualEntryOpen(true)}
          >
            Manual Entry
          </Button>
        </Paper>

        <ManualEntryDialog
          open={manualEntryOpen}
          onClose={() => setManualEntryOpen(false)}
        />
      </>
    );
  }

  // ── Normal data state ──────────────────────────────────────────────
  return (
    <Grid container spacing={2}>
      {METRIC_CARDS.map((config) => (
        <Grid key={config.type} size={{ xs: 12, md: 4 }}>
          <MetricCardItem
            config={config}
            data={metrics[config.queryKey]}
          />
        </Grid>
      ))}
    </Grid>
  );
}
