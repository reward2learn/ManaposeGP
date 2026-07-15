'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Alert,
  Box,
  Button,
  Grid,
  Paper,
  Skeleton,
  Typography,
} from '@mui/material';
import type { PopulationAnalytics } from '@/domain/health/population-analytics';

// ── Types ────────────────────────────────────────────────────────────────────

interface AnalyticsState {
  data: PopulationAnalytics | null;
  isLoading: boolean;
  error: string | null;
  isEmpty: boolean;
  message: string | null;
}

interface StatCardProps {
  label: string;
  value: string;
  sublabel?: string;
}

// ── Stat card sub-component ──────────────────────────────────────────────────

function StatCard({ label, value, sublabel }: StatCardProps) {
  return (
    <Paper
      elevation={2}
      sx={{
        p: 2.5,
        textAlign: 'center',
        borderTop: '3px solid',
        borderTopColor: 'primary.main',
        bgcolor: 'rgba(255,255,255,0.03)',
        borderRadius: 2,
        transition: 'box-shadow 0.25s ease',
        '&:hover': {
          boxShadow: (theme) => theme.shadows[4],
        },
      }}
    >
      <Typography
        variant="h5"
        component="p"
        sx={{
          fontWeight: 800,
          color: 'primary.main',
          lineHeight: 1.2,
          mb: 0.5,
        }}
      >
        {value}
      </Typography>
      <Typography
        variant="caption"
        component="p"
        sx={{
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: 'text.secondary',
          fontWeight: 600,
          fontSize: '0.7rem',
        }}
      >
        {label}
      </Typography>
      {sublabel ? (
        <Typography
          variant="caption"
          component="p"
          sx={{
            display: 'block',
            mt: 0.5,
            fontSize: '0.65rem',
            color: 'text.disabled',
          }}
        >
          {sublabel}
        </Typography>
      ) : null}
    </Paper>
  );
}

// ── Skeleton loading grid ────────────────────────────────────────────────────

const SKELETON_COUNT = 6;

function LoadingSkeleton() {
  return (
    <Grid container spacing={2}>
      {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
        <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
          <Skeleton
            variant="rounded"
            height={130}
            sx={{ borderRadius: 2 }}
          />
        </Grid>
      ))}
    </Grid>
  );
}

// ── Public component ─────────────────────────────────────────────────────────

export interface PopulationHealthPanelProps {
  /** Optional refresh trigger — component re-fetches when this changes. */
  refreshKey?: number;
}

export function PopulationHealthPanel({ refreshKey = 0 }: PopulationHealthPanelProps) {
  const [state, setState] = useState<AnalyticsState>({
    data: null,
    isLoading: true,
    error: null,
    isEmpty: false,
    message: null,
  });

  const fetchAnalytics = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/gp/population-analytics', {
        credentials: 'include',
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          body.error ?? `Request failed with status ${response.status}`,
        );
      }

      const body = (await response.json()) as {
        success: boolean;
        analytics: PopulationAnalytics | null;
        message?: string;
      };

      if (!body.analytics) {
        setState({
          data: null,
          isLoading: false,
          error: null,
          isEmpty: true,
          message: body.message ?? 'No consented patients in your panel yet.',
        });
        return;
      }

      setState({
        data: body.analytics,
        isLoading: false,
        error: null,
        isEmpty: false,
        message: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load analytics';
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
    }
  }, []);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics, refreshKey]);

  const handleRetry = useCallback(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  // ── Extract values from data ──────────────────────────────────────────
  const stats = useMemo(() => {
    const data = state.data;
    if (!data) return null;

    // Determine screening rate (average of K10 and PHQ-9)
    const k10Pct = parseFloat(data.screening.k10CompletionRate);
    const phq9Pct = parseFloat(data.screening.phq9CompletionRate);
    const screeningRatePct = ((k10Pct + phq9Pct) / 2).toFixed(1);

    return {
      panelSize: String(data.panelSize),
      activePatients: String(data.activePatients),
      mhtRate: data.treatments.mhtPrescriptionRate,
      screeningRate: `${screeningRatePct}%`,
      avgEngagement: `${data.engagement.averageEntriesPerWeek} / week`,
      riskCvd: data.riskProfile.highCvdRiskPct,
      averageAge: String(data.demographics.averageAge),
      topSymptom: data.symptoms.topSymptoms[0]?.type.replace(/_/g, ' ') ?? 'N/A',
    };
  }, [state.data]);

  // ── Loading state ────────────────────────────────────────────────────
  if (state.isLoading) {
    return <LoadingSkeleton />;
  }

  // ── Error state ──────────────────────────────────────────────────────
  if (state.error) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={handleRetry}>
            Retry
          </Button>
        }
      >
        {state.error}
      </Alert>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────
  if (state.isEmpty || !stats) {
    return (
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
          No Panel Data Yet
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, mx: 'auto' }}>
          {state.message ?? 'No consented patients in your panel yet. Share your panel link with patients to start collecting data.'}
        </Typography>
      </Paper>
    );
  }

  // ── Normal data state ────────────────────────────────────────────────
  return (
    <Box>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            label="Panel Size"
            value={stats.panelSize}
            sublabel="Consented patients"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            label="Active Patients"
            value={stats.activePatients}
            sublabel={`${stats.activePatients} of ${stats.panelSize} logged recently`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            label="MHT Prescription Rate"
            value={stats.mhtRate}
            sublabel="Patients on menopausal hormone therapy"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            label="Screening Rate"
            value={stats.screeningRate}
            sublabel="Avg K10 / PHQ-9 completion"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            label="Avg Engagement"
            value={stats.avgEngagement}
            sublabel="Symptom log entries / week"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            label="High CVD Risk"
            value={stats.riskCvd}
            sublabel={`Top symptom: ${stats.topSymptom}`}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
