'use client';

import { useState, useMemo, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewWeekIcon from '@mui/icons-material/ViewWeek';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';
import { DailySymptomForm } from '@/components/health/daily-symptom-form';
import { SymptomTimeline } from '@/components/health/symptom-timeline';
import { SymptomWeekView } from '@/components/health/symptom-week-view';
import { SymptomMonthView } from '@/components/health/symptom-month-view';
import { useGetSymptomsQuery } from '@/store/apis/health-api';

// ── Types ─────────────────────────────────────────────────────────────────

type SymptomViewMode = 'list' | 'week' | 'month';

// ── Date helpers ───────────────────────────────────────────────────────────

function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonday(d: Date): Date {
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getWeekRange(date: Date) {
  const monday = getMonday(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: toISODate(monday), to: toISODate(sunday), monday };
}

function getMonthRange(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { from: toISODate(start), to: toISODate(end), monthStart: start };
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function SymptomJournalPage() {
  const today = new Date();
  const todayISO = toISODate(today);

  const [viewMode, setViewMode] = useState<SymptomViewMode>('list');

  // Compute date ranges per view mode
  const queryParams = useMemo(() => {
    switch (viewMode) {
      case 'week': {
        const { from, to } = getWeekRange(today);
        return { from, to };
      }
      case 'month': {
        const { from, to } = getMonthRange(today);
        return { from, to };
      }
      case 'list':
      default:
        return { to: todayISO };
    }
  }, [viewMode, todayISO]);

  const { data, isLoading } = useGetSymptomsQuery(queryParams);

  // Pre-computed date anchors for week/month views
  const weekMonday = useMemo(() => getMonday(today), []);
  const monthFirst = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth(), 1);
    return d;
  }, []);

  const entries = (data?.entries ?? []) as unknown as Array<{
    id: string;
    date: string;
    symptomType: string;
    severity: number;
    duration?: number;
    frequency?: number;
    triggers?: string[];
    notes?: string;
  }>;

  const handleViewChange = useCallback(
    (_: unknown, newMode: SymptomViewMode | null) => {
      if (newMode !== null) setViewMode(newMode);
    },
    [],
  );

  return (
    <AuthGate requiredTier="google" fallback={<SignInPanelGate requiredTier="google" />}>
      <Box sx={{ maxWidth: 'stretch', mx: 'auto', px: 3, py: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }}>
          Symptom Journal
        </Typography>
        <Stack spacing={3}>
          <DailySymptomForm />
          <Paper sx={{ p: 3 }}>
            <Stack
              direction="row"
              sx={{
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 2,
                flexWrap: 'wrap',
                gap: 1,
              }}
            >
              <Typography variant="h6">Recent Entries</Typography>
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={handleViewChange}
                size="small"
                aria-label="View mode"
              >
                <ToggleButton value="list" aria-label="List view">
                  <ViewListIcon fontSize="small" />
                </ToggleButton>
                <ToggleButton value="week" aria-label="Week view">
                  <ViewWeekIcon fontSize="small" />
                </ToggleButton>
                <ToggleButton value="month" aria-label="Month view">
                  <CalendarMonthIcon fontSize="small" />
                </ToggleButton>
              </ToggleButtonGroup>
            </Stack>

            {isLoading ? (
              <Stack spacing={2}>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} variant="rounded" height={80} />
                ))}
              </Stack>
            ) : viewMode === 'week' ? (
              <SymptomWeekView entries={entries} weekStart={weekMonday} />
            ) : viewMode === 'month' ? (
              <SymptomMonthView entries={entries} monthStart={monthFirst} />
            ) : (
              <SymptomTimeline entries={entries} />
            )}
          </Paper>
        </Stack>
      </Box>
    </AuthGate>
  );
}
