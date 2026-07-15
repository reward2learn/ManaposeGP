'use client';

import { useCallback, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import BedtimeIcon from '@mui/icons-material/Bedtime';
import FavoriteIcon from '@mui/icons-material/Favorite';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';
import { SymptomTimeline } from '@/components/health/symptom-timeline';
import type { SymptomEntry } from '@/components/health/symptom-timeline';
import { useGetSymptomsQuery, type SymptomJournalEntry } from '@/store/apis/health-api';

// ── Metric card definitions ────────────────────────────────────────────────

interface HealthMetricCard {
  label: string;
  icon: ReactNode;
  unit: string;
}

const HEALTH_METRICS: HealthMetricCard[] = [
  { label: 'Sleep', icon: <BedtimeIcon sx={{ fontSize: 32 }} />, unit: 'hours' },
  { label: 'Heart Rate', icon: <FavoriteIcon sx={{ fontSize: 32 }} />, unit: 'bpm' },
  { label: 'Steps', icon: <DirectionsWalkIcon sx={{ fontSize: 32 }} />, unit: 'steps' },
  { label: 'Temperature', icon: <ThermostatIcon sx={{ fontSize: 32 }} />, unit: '°C' },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function mapApiEntries(entries: SymptomJournalEntry[]): SymptomEntry[] {
  return entries.map((e) => ({
    id: e.id,
    date: e.date,
    symptomType: e.symptomType,
    severity: e.severity,
    duration: e.duration ?? undefined,
    frequency: e.frequency ?? undefined,
    triggers: e.triggers.length > 0 ? e.triggers : undefined,
    notes: e.notes ?? undefined,
  }));
}

// ── Loading skeleton ───────────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <Box sx={{ mb: 4 }}>
      <Skeleton variant="text" width="40%" height={32} sx={{ mb: 2 }} />
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} variant="outlined" sx={{ mb: 1.5 }}>
          <CardContent sx={{ py: 1.5, px: 2 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Skeleton variant="text" width="40%" height={24} />
              <Skeleton variant="rounded" width={80} height={24} />
            </Stack>
            <Skeleton variant="text" width="60%" height={20} sx={{ mt: 0.5 }} />
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

// ── Metric card ─────────────────────────────────────────────────────────────

function MetricPlaceholderCard({ label, icon, unit }: HealthMetricCard) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ color: 'text.secondary', mb: 1 }}>{icon}</Box>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Connect Apple Health to populate
        </Typography>
        <Chip
          label={`0 ${unit}`}
          size="small"
          variant="outlined"
          sx={{ mt: 1.5, opacity: 0.5 }}
        />
      </CardContent>
    </Card>
  );
}

// ── Start Tracking CTA ─────────────────────────────────────────────────────

function StartTrackingCta() {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 4,
        mt: 3,
        textAlign: 'center',
        bgcolor: 'action.hover',
        borderRadius: 2,
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
        No symptoms logged yet
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
        You haven&apos;t logged any symptoms yet. Start tracking to unlock AI insights.
      </Typography>
      <Button variant="contained" size="large" href="/symptom-journal">
        Start Tracking
      </Button>
    </Paper>
  );
}

// ── Content (rendered behind auth gate) ────────────────────────────────────

function HealthDashboardContent() {
  const today = new Date().toISOString().slice(0, 10);

  const {
    data: symptomsData,
    isLoading: symptomsLoading,
    isError: symptomsError,
    refetch,
  } = useGetSymptomsQuery({ to: today });

  const handleRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  const entries: SymptomEntry[] = symptomsData ? mapApiEntries(symptomsData.entries) : [];
  const hasSymptoms = entries.length > 0;

  return (
    <Box sx={{ maxWidth: 'stretch', mx: 'auto', px: 2, py: 4 }}>
      {/* ── Page heading ─────────────────────────────────────────── */}
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 4 }}>
        My Health Dashboard
      </Typography>

      {/* ── Section 1: Health Metrics Cards ──────────────────────── */}
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
        Health Metrics
      </Typography>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        {HEALTH_METRICS.map((metric) => (
          <Grid key={metric.label} size={{ xs: 12, sm: 6, md: 3 }}>
            <MetricPlaceholderCard {...metric} />
          </Grid>
        ))}
      </Grid>

      {/* ── Section 2: Symptom Timeline ─────────────────────────── */}
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
        Recent Symptoms
      </Typography>

      {symptomsLoading ? (
        <TimelineSkeleton />
      ) : symptomsError ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={handleRetry}>
              Retry
            </Button>
          }
          sx={{ mb: 3 }}
        >
          Failed to load symptoms. Please try again.
        </Alert>
      ) : (
        <SymptomTimeline entries={entries} />
      )}

      {/* ── Section 3: Start Tracking CTA ───────────────────────── */}
      {!symptomsLoading && !symptomsError && !hasSymptoms && <StartTrackingCta />}
    </Box>
  );
}

// ── Page (auth-gated) ──────────────────────────────────────────────────────

export default function HealthDashboardPage() {
  return (
    <AuthGate requiredTier="google" fallback={<SignInPanelGate requiredTier="google" />}>
      <HealthDashboardContent />
    </AuthGate>
  );
}
