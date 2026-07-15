'use client';

import { useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from '@mui/material';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SymptomEntry {
  id: string;
  date: string;
  symptomType: string;
  severity: number;
  duration?: number;
  frequency?: number;
  triggers?: string[];
  notes?: string;
}

export interface SymptomTimelineProps {
  entries: SymptomEntry[];
}

// ── Symptom type → label + emoji map (mirrors DailySymptomForm) ────────────

const SYMPTOM_LABEL_MAP: Record<string, string> = {
  hot_flush: '🔥 Hot Flush',
  night_sweat: '💧 Night Sweat',
  sleep_disturbance: '😴 Sleep Disturbance',
  mood_change: '🎭 Mood Change',
  brain_fog: '☁️ Brain Fog',
  joint_pain: '🦴 Joint Pain',
  vaginal_dryness: 'Vaginal Dryness',
  libido_change: '💕 Libido Change',
  fatigue: '😩 Fatigue',
  weight_change: '⚖️ Weight Change',
  headache: '🤕 Headache',
  palpitations: '💓 Heart Palpitations',
  urinary_symptoms: '🚽 Urinary Issues',
  skin_changes: 'Skin Changes',
  other: 'Other',
};

function getSymptomLabel(type: string): string {
  return SYMPTOM_LABEL_MAP[type] ?? type;
}

// ── Severity helpers ───────────────────────────────────────────────────────

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

// ── Group entries by date ──────────────────────────────────────────────────

interface DateGroup {
  dateLabel: string;
  entries: SymptomEntry[];
}

function groupByDate(entries: SymptomEntry[]): DateGroup[] {
  const groups = new Map<string, SymptomEntry[]>();

  for (const entry of entries) {
    const dateKey = entry.date.slice(0, 10); // YYYY-MM-DD
    const existing = groups.get(dateKey);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(dateKey, [entry]);
    }
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a)) // newest first
    .map(([dateKey, groupEntries]) => ({
      dateLabel: new Date(dateKey + 'T00:00:00').toLocaleDateString('en-AU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      entries: groupEntries.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    }));
}

// ── Component ──────────────────────────────────────────────────────────────

export function SymptomTimeline({ entries }: SymptomTimelineProps) {
  const grouped = useMemo(() => groupByDate(entries), [entries]);

  if (entries.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          No symptoms logged for this period.
        </Typography>
      </Box>
    );
  }

  return (
    <Box component="section" aria-label="Symptom timeline">
      {grouped.map((group) => (
        <Box key={group.dateLabel} sx={{ mb: 3 }}>
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 600, mb: 1.5, color: 'text.secondary' }}
          >
            {group.dateLabel}
          </Typography>

          <Stack spacing={1.5}>
            {group.entries.map((entry) => (
              <SymptomCard key={entry.id} entry={entry} />
            ))}
          </Stack>

          <Divider sx={{ mt: 2.5 }} />
        </Box>
      ))}
    </Box>
  );
}

// ── Single symptom card ────────────────────────────────────────────────────

function SymptomCard({ entry }: { entry: SymptomEntry }) {
  const severityColor = getSeverityColor(entry.severity);
  const severityLabel = getSeverityLabel(entry.severity);
  const symptomLabel = getSymptomLabel(entry.symptomType);

  return (
    <Card
      variant="outlined"
      sx={{
        borderLeft: 4,
        borderLeftColor: `${severityColor}.main`,
      }}
    >
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        <Stack
          direction="row"
          sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}
        >
          <Typography variant="body1" sx={{ fontWeight: 500 }}>
            {symptomLabel}
          </Typography>

          <Chip
            label={`${severityLabel} ${entry.severity}/10`}
            color={severityColor}
            size="small"
            variant="outlined"
          />
        </Stack>

        {(entry.duration !== undefined || entry.frequency !== undefined) && (
          <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
            {entry.duration !== undefined && (
              <Typography variant="caption" color="text.secondary">
                Duration: {entry.duration} min
              </Typography>
            )}
            {entry.frequency !== undefined && (
              <Typography variant="caption" color="text.secondary">
                Frequency: {entry.frequency}x
              </Typography>
            )}
          </Stack>
        )}

        {entry.notes && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5, fontStyle: 'italic' }}
          >
            {entry.notes}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
