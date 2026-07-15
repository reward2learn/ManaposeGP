'use client';

import { useMemo, useState, useCallback } from 'react';
import {
  Box,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import type { SymptomEntry } from '@/components/health/symptom-timeline';
import { SymptomDetailDialog } from '@/components/health/symptom-detail-dialog';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SymptomWeekViewProps {
  entries: SymptomEntry[];
  weekStart: Date; // Monday of the target week
}

interface DayColumn {
  date: string;
  dayOfMonth: number;
  dayName: string;
  isToday: boolean;
  entries: SymptomEntry[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isSameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type SeverityColor = 'success' | 'warning' | 'error';

function getSeverityColor(severity: number): SeverityColor {
  if (severity <= 3) return 'success';
  if (severity <= 6) return 'warning';
  return 'error';
}

function getSeverityLabel(severity: number): string {
  if (severity <= 3) return 'Mild';
  if (severity <= 6) return 'Moderate';
  return 'Severe';
}

const SYMPTOM_SHORT_LABEL: Record<string, string> = {
  hot_flush: '🔥 Hot Flush',
  night_sweat: '💧 Night Sweat',
  sleep_disturbance: '😴 Sleep',
  mood_change: '🎭 Mood',
  brain_fog: '☁️ Brain Fog',
  joint_pain: '🦴 Joint Pain',
  vaginal_dryness: 'Vag Dry',
  libido_change: '💕 Libido',
  fatigue: '😩 Fatigue',
  weight_change: '⚖️ Weight',
  headache: '🤕 Headache',
  palpitations: '💓 Palp',
  urinary_symptoms: '🚽 Urinary',
  skin_changes: 'Skin',
  other: 'Other',
};

function getShortSymptomLabel(type: string): string {
  return SYMPTOM_SHORT_LABEL[type] ?? type;
}

function buildDayColumns(weekStart: Date, entries: SymptomEntry[]): DayColumn[] {
  const today = new Date();
  const days: DayColumn[] = [];

  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    const dateKey = toISODate(day);
    const dayEntries = entries.filter((e) => e.date.slice(0, 10) === dateKey);

    days.push({
      date: dateKey,
      dayOfMonth: day.getDate(),
      dayName: DAY_NAMES[day.getDay()],
      isToday: isSameDate(day, today),
      entries: dayEntries,
    });
  }

  return days;
}

// ── Component ──────────────────────────────────────────────────────────────

export function SymptomWeekView({ entries, weekStart }: SymptomWeekViewProps) {
  const columns = useMemo(
    () => buildDayColumns(weekStart, entries),
    [weekStart, entries],
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DayColumn | null>(null);

  const handleDayClick = useCallback((col: DayColumn) => {
    if (col.entries.length === 0) return;
    setSelectedDay(col);
    setDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setSelectedDay(null);
  }, []);

  const totalEntries = columns.reduce((sum, col) => sum + col.entries.length, 0);

  if (totalEntries === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          No symptoms logged this week.
        </Typography>
      </Box>
    );
  }

  return (
    <Box component="section" aria-label="Symptom week view">
      {/* ── Day headers ───────────────────────────────────────────────── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, mb: 1 }}>
        {columns.map((col) => (
          <Box
            key={col.date}
            sx={{
              textAlign: 'center',
              borderRadius: 1,
              bgcolor: col.isToday ? 'primary.main' : 'action.hover',
              color: col.isToday ? 'primary.contrastText' : 'text.secondary',
              py: 0.75,
              px: 0.5,
            }}
          >
            <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.2 }}>
              {col.dayName}
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontWeight: col.isToday ? 700 : 500, lineHeight: 1.2 }}
            >
              {col.dayOfMonth}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* ── Day columns with entries ──────────────────────────────────── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {columns.map((col) => (
          <Box
            key={col.date}
            onClick={() => handleDayClick(col)}
            sx={{
              minHeight: 80,
              border: 1,
              borderColor: col.isToday ? 'primary.main' : 'divider',
              borderRadius: 1,
              bgcolor: col.isToday ? 'primary.50' : 'background.paper',
              p: 0.5,
              overflow: 'hidden',
              cursor: col.entries.length > 0 ? 'pointer' : 'default',
              transition: 'background-color 0.2s, box-shadow 0.2s',
              '&:hover': col.entries.length > 0
                ? { bgcolor: 'action.hover', boxShadow: 1 }
                : {},
            }}
          >
            {col.entries.length === 0 ? (
              <Typography
                variant="caption"
                color="text.disabled"
                sx={{ display: 'block', textAlign: 'center', mt: 2 }}
              >
                —
              </Typography>
            ) : (
              <Stack spacing={0.5}>
                {col.entries.slice(0, 5).map((entry) => (
                  <Chip
                    key={entry.id}
                    label={getShortSymptomLabel(entry.symptomType)}
                    size="small"
                    color={getSeverityColor(entry.severity)}
                    variant="outlined"
                    title={`${getSeverityLabel(entry.severity)} ${entry.severity}/10`}
                    sx={{
                      fontSize: '0.675rem',
                      height: 20,
                      '& .MuiChip-label': { px: 0.75, py: 0 },
                    }}
                  />
                ))}
                {col.entries.length > 5 && (
                  <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                    +{col.entries.length - 5} more
                  </Typography>
                )}
              </Stack>
            )}
          </Box>
        ))}
      </Box>

      {/* ── Day detail dialog ──────────────────────────────────────────── */}
      {selectedDay && (
        <SymptomDetailDialog
          open={dialogOpen}
          onClose={handleCloseDialog}
          date={selectedDay.date}
          entries={selectedDay.entries}
        />
      )}
    </Box>
  );
}
