'use client';

import { useMemo, useState, useCallback } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import type { SymptomEntry } from '@/components/health/symptom-timeline';
import { SymptomDetailDialog } from '@/components/health/symptom-detail-dialog';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SymptomMonthViewProps {
  entries: SymptomEntry[];
  monthStart: Date; // 1st of the target month
}

interface CalendarDay {
  date: string | null;
  dayOfMonth: number | null;
  isToday: boolean;
  isCurrentMonth: boolean;
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

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

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

function buildCalendarGrid(monthStart: Date, entries: SymptomEntry[]): CalendarDay[] {
  const today = new Date();
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const startDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: CalendarDay[] = [];

  for (let i = 0; i < startDayOfWeek; i++) {
    cells.push({ date: null, dayOfMonth: null, isToday: false, isCurrentMonth: false, entries: [] });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dayDate = new Date(year, month, d);
    const dateKey = toISODate(dayDate);
    cells.push({
      date: dateKey,
      dayOfMonth: d,
      isToday: isSameDate(dayDate, today),
      isCurrentMonth: true,
      entries: entries.filter((e) => e.date.slice(0, 10) === dateKey),
    });
  }

  const trailingCells = (7 - (cells.length % 7)) % 7;
  for (let i = 0; i < trailingCells; i++) {
    cells.push({ date: null, dayOfMonth: null, isToday: false, isCurrentMonth: false, entries: [] });
  }

  return cells;
}

function getDayStyle(day: CalendarDay) {
  if (!day.isCurrentMonth) {
    return { bgcolor: 'action.hover', color: 'text.disabled', borderColor: 'divider' };
  }
  if (day.entries.length > 0) {
    const maxSeverity = Math.max(...day.entries.map((e) => e.severity));
    const sc = getSeverityColor(maxSeverity);
    return { bgcolor: `${sc}.50`, color: 'text.primary', borderColor: `${sc}.main`, borderWidth: 2 };
  }
  if (day.isToday) {
    return { bgcolor: 'primary.50', color: 'text.primary', borderColor: 'primary.main', borderWidth: 2 };
  }
  return { bgcolor: 'background.paper', color: 'text.primary', borderColor: 'divider' };
}

// ── Component ──────────────────────────────────────────────────────────────

export function SymptomMonthView({ entries, monthStart }: SymptomMonthViewProps) {
  const cells = useMemo(
    () => buildCalendarGrid(monthStart, entries),
    [monthStart, entries],
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<{ date: string; entries: SymptomEntry[] } | null>(null);

  const handleDayClick = useCallback((day: CalendarDay) => {
    if (!day.isCurrentMonth || !day.date || day.entries.length === 0) return;
    setSelectedDay({ date: day.date, entries: day.entries });
    setDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setSelectedDay(null);
  }, []);

  const totalEntries = cells.reduce((sum, cell) => sum + cell.entries.length, 0);

  if (totalEntries === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          No symptoms logged this month.
        </Typography>
      </Box>
    );
  }

  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return (
    <Box component="section" aria-label="Symptom month view">
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 0.5 }}>
        {DAY_HEADERS.map((day) => (
          <Typography key={day} variant="caption" sx={{ textAlign: 'center', fontWeight: 600, color: 'text.secondary', py: 0.5 }}>
            {day}
          </Typography>
        ))}
      </Box>

      {weeks.map((week, weekIdx) => (
        <Box key={weekIdx} sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {week.map((day, dayIdx) => {
            const style = getDayStyle(day);
            const hasEntries = day.isCurrentMonth && !!day.date && day.entries.length > 0;

            return (
              <Box
                key={`${weekIdx}-${dayIdx}`}
                onClick={() => handleDayClick(day)}
                sx={{
                  aspectRatio: '1 / 1',
                  border: 1,
                  borderColor: style.borderColor,
                  borderWidth: style.borderWidth ?? 1,
                  bgcolor: style.bgcolor,
                  color: style.color,
                  m: 0.25,
                  borderRadius: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  pt: 0.5,
                  cursor: hasEntries ? 'pointer' : 'default',
                  transition: 'background-color 0.2s, box-shadow 0.2s',
                  '&:hover': hasEntries ? { bgcolor: 'action.hover', boxShadow: 1 } : {},
                  position: 'relative',
                }}
              >
                {day.dayOfMonth !== null && (
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: day.isToday ? 700 : 400, fontSize: '0.75rem', lineHeight: 1.2 }}
                  >
                    {day.dayOfMonth}
                  </Typography>
                )}

                {day.entries.length > 0 && day.entries.length <= 4 && (
                  <Box sx={{ display: 'flex', gap: 0.15, flexWrap: 'wrap', justifyContent: 'center', mt: 0.25 }}>
                    {day.entries.map((entry) => (
                      <Box
                        key={entry.id}
                        sx={{
                          width: 6, height: 6, borderRadius: '50%',
                          bgcolor: `${getSeverityColor(entry.severity)}.main`,
                        }}
                      />
                    ))}
                  </Box>
                )}

                {day.entries.length > 4 && (
                  <Typography variant="caption" sx={{ fontSize: '0.6rem', fontWeight: 600, mt: 0.25 }}>
                    {day.entries.length} symptoms
                  </Typography>
                )}
              </Box>
            );
          })}
        </Box>
      ))}

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
