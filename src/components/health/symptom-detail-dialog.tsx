'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Divider,
  Stack,
  Paper,
  Card,
  CardActionArea,
  CardContent,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { SymptomEntry } from '@/components/health/symptom-timeline';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SymptomDetailDialogProps {
  open: boolean;
  onClose: () => void;
  date: string;
  entries: SymptomEntry[];
}

// ── Label / severity helpers ───────────────────────────────────────────────

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

function getSymptomLabel(type: string): string {
  return SYMPTOM_LABEL_MAP[type] ?? type;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ── Entry detail modal ─────────────────────────────────────────────────────

function EntryDetailModal({
  entry,
  open,
  onClose,
}: {
  entry: SymptomEntry | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!entry) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">{getSymptomLabel(entry.symptomType)}</Typography>
        <Chip
          label={`${getSeverityLabel(entry.severity)} ${entry.severity}/10`}
          color={getSeverityColor(entry.severity)}
          size="small"
        />
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Box>
            <Typography variant="caption" color="text.secondary">Date</Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {formatDateLabel(entry.date)}
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary">Symptom Type</Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {getSymptomLabel(entry.symptomType)}
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary">Severity</Typography>
            <Box sx={{ mt: 0.5 }}>
              <Chip
                label={`${getSeverityLabel(entry.severity)} — ${entry.severity}/10`}
                color={getSeverityColor(entry.severity)}
                size="small"
              />
            </Box>
          </Box>

          {entry.duration !== undefined && (
            <Box>
              <Typography variant="caption" color="text.secondary">Duration</Typography>
              <Typography variant="body2">{entry.duration} minutes</Typography>
            </Box>
          )}

          {entry.frequency !== undefined && (
            <Box>
              <Typography variant="caption" color="text.secondary">Frequency</Typography>
              <Typography variant="body2">{entry.frequency}x today</Typography>
            </Box>
          )}

          {entry.triggers && entry.triggers.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary">Triggers</Typography>
              <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                {entry.triggers.map((t) => (
                  <Chip key={t} label={t} size="small" variant="outlined" />
                ))}
              </Stack>
            </Box>
          )}

          {entry.notes && (
            <Box>
              <Typography variant="caption" color="text.secondary">Notes</Typography>
              <Paper variant="outlined" sx={{ p: 1.5, mt: 0.5, bgcolor: 'grey.50' }}>
                <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                  {entry.notes}
                </Typography>
              </Paper>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main dialog: day summary with clickable entries ────────────────────────

export function SymptomDetailDialog({
  open,
  onClose,
  date,
  entries,
}: SymptomDetailDialogProps) {
  const [selectedEntry, setSelectedEntry] = useState<SymptomEntry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const handleEntryClick = (entry: SymptomEntry) => {
    setSelectedEntry(entry);
    setDetailOpen(true);
  };

  const entriesBySeverity = [...entries].sort((a, b) => b.severity - a.severity);

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6">{formatDateLabel(date)}</Typography>
            <Typography variant="body2" color="text.secondary">
              {entries.length} symptom{entries.length !== 1 ? 's' : ''} logged
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {entriesBySeverity.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              No symptoms logged for this date.
            </Typography>
          ) : (
            <Stack spacing={1.5}>
              {entriesBySeverity.map((entry) => (
                <Card
                  key={entry.id}
                  variant="outlined"
                  sx={{
                    borderLeft: 4,
                    borderLeftColor: `${getSeverityColor(entry.severity)}.main`,
                  }}
                >
                  <CardActionArea onClick={() => handleEntryClick(entry)}>
                    <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                      <Stack
                        direction="row"
                        sx={{
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 1,
                        }}
                      >
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {getSymptomLabel(entry.symptomType)}
                        </Typography>
                        <Chip
                          label={`${getSeverityLabel(entry.severity)} ${entry.severity}/10`}
                          color={getSeverityColor(entry.severity)}
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
                          {entry.notes.slice(0, 80)}{entry.notes.length > 80 ? '...' : ''}
                        </Typography>
                      )}
                    </CardContent>
                  </CardActionArea>
                </Card>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* ── Entry detail sub-modal ──────────────────────────────────────── */}
      <EntryDetailModal
        entry={selectedEntry}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </>
  );
}
