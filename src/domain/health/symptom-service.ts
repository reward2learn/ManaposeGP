import type { DbClient } from '@/lib/db';
import type { SymptomJournal } from '@/generated/prisma';
import { SymptomType } from '@/generated/prisma';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SymptomEntry {
  date: string;
  symptomType: string;
  severity: number;
  duration?: number;
  frequency?: number;
  triggers?: string[];
  reliefFactors?: string[];
  impactOnDaily?: number;
  notes?: string;
}

export interface SymptomTrend {
  symptomType: string;
  weeklyAverages: { week: string; avgSeverity: number }[];
  trendDirection: 'improving' | 'worsening' | 'stable';
  totalEntries: number;
}

export interface SymptomTrends {
  trends: SymptomTrend[];
  mostFrequentTriggers: { trigger: string; count: number }[];
  overallAvgSeverity: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const VALID_SYMPTOM_TYPES = new Set<string>(Object.values(SymptomType));

const TREND_STABLE_THRESHOLD = 0.5;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the ISO week's Monday date for the given date (YYYY-MM-DD).
 */
function getWeekMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  // Days since Monday: Sunday=0 → 6, Monday=1 → 0, ... Saturday=6 → 5
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Validates that `severity` is an integer in [0, 10].
 */
function validateSeverity(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 10) {
    throw new Error(`Severity must be an integer between 0 and 10, got: ${value}`);
  }
}

/**
 * Validates and casts a symptom type string to the Prisma SymptomType enum.
 */
function toSymptomTypeEnum(value: string): SymptomType {
  if (!value || typeof value !== 'string') {
    throw new Error('symptomType is required and must be a string');
  }
  const trimmed = value.trim();
  if (!VALID_SYMPTOM_TYPES.has(trimmed)) {
    throw new Error(
      `Invalid symptomType "${trimmed}". Valid values: ${[...VALID_SYMPTOM_TYPES].join(', ')}`,
    );
  }
  return trimmed as SymptomType;
}

/**
 * Parses a date string to a Date object for Prisma.
 */
function parseDate(value: string): Date {
  if (!value || typeof value !== 'string') {
    throw new Error('date is required and must be a string');
  }
  const trimmed = value.trim();
  const date = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: "${trimmed}"`);
  }
  return date;
}

/**
 * Computes the default "from" date: `days` days ago.
 */
function defaultFromDate(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Determines the trend direction of a series of numeric values.
 * Compares the mean of the first half to the mean of the second half.
 */
function computeTrendDirection(values: number[]): 'improving' | 'worsening' | 'stable' {
  if (values.length < 2) return 'stable';

  const mid = Math.ceil(values.length / 2);
  const firstHalf = values.slice(0, mid);
  const secondHalf = values.slice(mid);

  const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;

  const delta = firstAvg - secondAvg; // positive = improving (severity went down)

  if (Math.abs(delta) < TREND_STABLE_THRESHOLD) return 'stable';
  return delta > 0 ? 'improving' : 'worsening';
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates a new symptom journal entry linked to the given health profile.
 *
 * @param db         Database client
 * @param profileId  The `health_profiles.id` (not user_id)
 * @param data       Symptom entry to create
 */
export async function logSymptom(
  db: DbClient,
  profileId: string,
  data: SymptomEntry,
): Promise<SymptomJournal> {
  if (!profileId || typeof profileId !== 'string') {
    throw new Error('profileId is required');
  }

  validateSeverity(data.severity);

  const date = parseDate(data.date);
  const symptomType = toSymptomTypeEnum(data.symptomType);

  return db.symptomJournal.create({
    data: {
      healthProfileId: profileId,
      date,
      symptomType,
      severity: data.severity,
      ...(data.duration !== undefined ? { duration: data.duration } : {}),
      ...(data.frequency !== undefined ? { frequency: data.frequency } : {}),
      ...(data.triggers !== undefined ? { triggers: data.triggers } : {}),
      ...(data.reliefFactors !== undefined ? { reliefFactors: data.reliefFactors } : {}),
      ...(data.impactOnDaily !== undefined ? { impactOnDaily: data.impactOnDaily } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
    },
  });
}

/**
 * Returns symptom journal entries for a health profile within a date range.
 * Defaults to the last 90 days. Ordered by date descending.
 *
 * @param db         Database client
 * @param profileId  The `health_profiles.id`
 * @param options    Optional date range (`from`, `to` as ISO date strings)
 */
export async function getSymptoms(
  db: DbClient,
  profileId: string,
  options?: { from?: string; to?: string },
): Promise<SymptomJournal[]> {
  if (!profileId || typeof profileId !== 'string') {
    throw new Error('profileId is required');
  }

  const from = options?.from ? parseDate(options.from) : defaultFromDate(90);
  const to = options?.to ? parseDate(options.to) : undefined;

  const dateFilter: Record<string, Date> = { gte: from };
  if (to) {
    dateFilter.lte = to;
  }

  return db.symptomJournal.findMany({
    where: {
      healthProfileId: profileId,
      date: dateFilter,
    },
    orderBy: { date: 'desc' },
  });
}

/**
 * Returns aggregated symptom trends for a health profile.
 *
 * Computes weekly average severity per symptom type, detects overall trend
 * direction for each type, and tallies the most frequently reported triggers.
 *
 * @param db         Database client
 * @param profileId  The `health_profiles.id`
 * @param days       Lookback window in days (default: 30)
 */
export async function getSymptomTrends(
  db: DbClient,
  profileId: string,
  days = 30,
): Promise<SymptomTrends> {
  if (!profileId || typeof profileId !== 'string') {
    throw new Error('profileId is required');
  }

  const from = defaultFromDate(days);

  const entries = await db.symptomJournal.findMany({
    where: {
      healthProfileId: profileId,
      date: { gte: from },
    },
    orderBy: { date: 'asc' },
  });

  // ── Group entries by symptom type ──────────────────────────────────────
  const byType = new Map<string, SymptomJournal[]>();
  let totalSeverity = 0;
  const triggerCounts = new Map<string, number>();

  for (const entry of entries) {
    const type = entry.symptomType;
    const group = byType.get(type) ?? [];
    group.push(entry);
    byType.set(type, group);

    totalSeverity += entry.severity;

    for (const trigger of entry.triggers ?? []) {
      if (trigger) {
        triggerCounts.set(trigger, (triggerCounts.get(trigger) ?? 0) + 1);
      }
    }
  }

  const overallAvgSeverity = entries.length > 0
    ? Math.round((totalSeverity / entries.length) * 100) / 100
    : 0;

  // ── Build trends per symptom type ──────────────────────────────────────
  const trends: SymptomTrend[] = [];

  for (const [symptomType, group] of byType) {
    // Group by ISO week
    const weeklyMap = new Map<string, number[]>();

    for (const entry of group) {
      const week = getWeekMonday(entry.date);
      const severities = weeklyMap.get(week) ?? [];
      severities.push(entry.severity);
      weeklyMap.set(week, severities);
    }

    // Compute weekly averages (sorted by week)
    const weeklyAverages = [...weeklyMap.entries()]
      .map(([week, severities]) => ({
        week,
        avgSeverity: Math.round(
          (severities.reduce((s, v) => s + v, 0) / severities.length) * 100,
        ) / 100,
      }))
      .sort((a, b) => a.week.localeCompare(b.week));

    const trendDirection = computeTrendDirection(
      weeklyAverages.map((w) => w.avgSeverity),
    );

    trends.push({
      symptomType,
      weeklyAverages,
      trendDirection,
      totalEntries: group.length,
    });
  }

  // Sort trends by total entries descending (most prominent first)
  trends.sort((a, b) => b.totalEntries - a.totalEntries);

  // ── Most frequent triggers ─────────────────────────────────────────────
  const mostFrequentTriggers = [...triggerCounts.entries()]
    .map(([trigger, count]) => ({ trigger, count }))
    .sort((a, b) => b.count - a.count);

  return {
    trends,
    mostFrequentTriggers,
    overallAvgSeverity,
  };
}
