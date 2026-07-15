import type { DbClient } from '@/lib/db';
import type { HealthMetric, Prisma } from '@/generated/prisma';
import { MetricSource } from '@/generated/prisma';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SyncMetric {
  metricType: string;
  value: Prisma.InputJsonValue;
  unit?: string;
  source?: string;
  sourceDevice?: string;
  recordedAt: string; // ISO datetime
}

export interface HealthMetricEntry {
  id: string;
  metricType: string;
  value: unknown;
  unit?: string | null;
  source: string;
  sourceDevice?: string | null;
  recordedAt: string;
}

export interface DailyAverage {
  date: string;
  avgValue: number;
  minValue?: number;
  maxValue?: number;
  count: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

export const VALID_METRIC_TYPES = new Set([
  'heart_rate',
  'resting_heart_rate',
  'hrv',
  'sleep_duration',
  'sleep_quality',
  'wrist_temperature',
  'body_temperature',
  'steps',
  'active_energy',
  'blood_pressure_systolic',
  'blood_pressure_diastolic',
  'weight',
  'bmi',
  'blood_glucose',
  'oxygen_saturation',
  'respiratory_rate',
  'menstrual_flow',
  'ovulation_test',
]);

const VALID_SOURCES = new Set<string>(Object.values(MetricSource));

const DEFAULT_LOOKBACK_DAYS = 30;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converts a source string to the MetricSource enum.
 * Falls back to `apple_health` for unrecognized or missing values.
 */
function toMetricSource(source?: string): MetricSource {
  if (source && VALID_SOURCES.has(source)) {
    return source as MetricSource;
  }
  return MetricSource.apple_health;
}

/**
 * Parses an ISO date string to a Date. Throws on invalid input.
 */
function parseRecordedAt(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ISO datetime for recordedAt: "${value}"`);
  }
  return date;
}

/**
 * Extracts a numeric value from the JSONB `value` column.
 *
 * Handles:
 * - Plain numbers (e.g. `heart_rate: 72`)
 * - Objects with a numeric key (e.g. `{ value: 72 }`, `{ avg: 7.5 }`)
 * - Objects where the first numeric entry is used as fallback
 */
function extractNumericValue(value: unknown): number {
  if (typeof value === 'number') return value;

  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;

    // Try common named keys first
    const candidateKeys = ['value', 'avg', 'mean', 'qty', 'count', 'level', 'score'];
    for (const key of candidateKeys) {
      if (typeof obj[key] === 'number') return obj[key] as number;
    }

    // Fallback: first numeric entry
    for (const [, v] of Object.entries(obj)) {
      if (typeof v === 'number') return v;
    }
  }

  throw new Error(`Cannot extract numeric value from: ${JSON.stringify(value)}`);
}

/**
 * Formats a Date as YYYY-MM-DD.
 */
function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Maps a Prisma HealthMetric row to the API-safe HealthMetricEntry.
 */
function mapEntry(metric: HealthMetric): HealthMetricEntry {
  return {
    id: metric.id,
    metricType: metric.metricType,
    value: metric.value,
    unit: metric.unit,
    source: metric.source,
    sourceDevice: metric.sourceDevice,
    recordedAt: metric.recordedAt.toISOString(),
  };
}

/**
 * Returns a Date representing `days` days ago at midnight UTC.
 */
function daysAgo(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Builds a deduplication key for matching (healthProfileId, metricType, recordedAt).
 */
function dedupKey(metricType: string, recordedAt: string): string {
  return `${metricType}|${recordedAt}`;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Syncs an array of health metrics for a health profile.
 *
 * Each metric is deduplicated by (healthProfileId, metricType, recordedAt).
 * Metrics that already exist are skipped and counted as duplicates.
 *
 * @param db        Database client
 * @param profileId The `health_profiles.id`
 * @param metrics   Array of metrics to sync
 * @returns         Count of newly created metrics and skipped duplicates
 */
export async function syncHealthMetrics(
  db: DbClient,
  profileId: string,
  metrics: SyncMetric[],
): Promise<{ synced: number; duplicates: number }> {
  if (!profileId || typeof profileId !== 'string') {
    throw new Error('profileId is required');
  }

  if (metrics.length === 0) {
    return { synced: 0, duplicates: 0 };
  }

  // Build a dedup set from the input — collapse duplicates within the batch
  const deduped = new Map<string, SyncMetric>();
  for (const metric of metrics) {
    const key = dedupKey(metric.metricType, metric.recordedAt);
    // Last write wins for duplicate keys within the same batch
    deduped.set(key, metric);
  }

  const uniqueMetrics = [...deduped.values()];

  // Query existing metrics in bulk using OR
  const existingMetrics = await db.healthMetric.findMany({
    where: {
      healthProfileId: profileId,
      OR: uniqueMetrics.map((m) => ({
        metricType: m.metricType,
        recordedAt: parseRecordedAt(m.recordedAt),
      })),
    },
    select: {
      metricType: true,
      recordedAt: true,
    },
  });

  const existingKeys = new Set(
    existingMetrics.map((m) => dedupKey(m.metricType, m.recordedAt.toISOString())),
  );

  // Separate new vs duplicate
  const toCreate: SyncMetric[] = [];
  let duplicates = 0;

  for (const metric of uniqueMetrics) {
    const key = dedupKey(metric.metricType, metric.recordedAt);
    if (existingKeys.has(key)) {
      duplicates++;
    } else {
      toCreate.push(metric);
    }
  }

  // Batch-create new metrics
  if (toCreate.length > 0) {
    await db.healthMetric.createMany({
      data: toCreate.map((m) => ({
        healthProfileId: profileId,
        metricType: m.metricType,
        value: m.value,
        unit: m.unit,
        source: toMetricSource(m.source),
        sourceDevice: m.sourceDevice,
        recordedAt: parseRecordedAt(m.recordedAt),
      })),
    });
  }

  return { synced: toCreate.length, duplicates };
}

/**
 * Returns health metrics for a profile, optionally filtered by type and date range.
 *
 * @param db        Database client
 * @param profileId The `health_profiles.id`
 * @param options   Filtering options (types, from, to)
 * @returns         Array of matching HealthMetricEntry, ordered by recordedAt DESC
 */
export async function getMetrics(
  db: DbClient,
  profileId: string,
  options?: { types?: string[] | string; from?: string; to?: string },
): Promise<HealthMetricEntry[]> {
  if (!profileId || typeof profileId !== 'string') {
    throw new Error('profileId is required');
  }

  // Resolve types — accept array or comma-separated string
  const typeList = resolveTypeList(options?.types);

  const from = options?.from ? new Date(`${options.from}T00:00:00.000Z`) : daysAgo(DEFAULT_LOOKBACK_DAYS);
  const to = options?.to ? new Date(`${options.to}T23:59:59.999Z`) : undefined;

  const where: Record<string, unknown> = {
    healthProfileId: profileId,
    recordedAt: { gte: from, ...(to ? { lte: to } : {}) },
  };

  if (typeList.length > 0) {
    where.metricType = { in: typeList };
  }

  const rows = await db.healthMetric.findMany({
    where,
    orderBy: { recordedAt: 'desc' },
  });

  return rows.map(mapEntry);
}

/**
 * Returns daily averages for a specific metric type over the given number of days.
 *
 * @param db         Database client
 * @param profileId  The `health_profiles.id`
 * @param metricType The metric type to aggregate
 * @param days       Lookback window in days (default: 7)
 * @returns          Array of DailyAverage, one per day
 */
export async function getMetricAverages(
  db: DbClient,
  profileId: string,
  metricType: string,
  days = 7,
): Promise<DailyAverage[]> {
  if (!profileId || typeof profileId !== 'string') {
    throw new Error('profileId is required');
  }

  if (!metricType || typeof metricType !== 'string') {
    throw new Error('metricType is required');
  }

  const from = daysAgo(days);

  const rows = await db.healthMetric.findMany({
    where: {
      healthProfileId: profileId,
      metricType,
      recordedAt: { gte: from },
    },
    orderBy: { recordedAt: 'asc' },
    select: {
      id: true,
      value: true,
      recordedAt: true,
    },
  });

  // Group by date and collect numeric values
  const byDate = new Map<string, number[]>();

  for (const row of rows) {
    try {
      const num = extractNumericValue(row.value);
      const date = formatDate(row.recordedAt);
      const values = byDate.get(date) ?? [];
      values.push(num);
      byDate.set(date, values);
    } catch {
      // Skip rows whose value cannot be interpreted as numeric
    }
  }

  // Compute averages per day
  const dailyAverages: DailyAverage[] = [];

  for (const [date, values] of byDate) {
    if (values.length === 0) continue;

    let sum = 0;
    let min = values[0];
    let max = values[0];

    for (const v of values) {
      sum += v;
      if (v < min) min = v;
      if (v > max) max = v;
    }

    dailyAverages.push({
      date,
      avgValue: Math.round((sum / values.length) * 100) / 100,
      minValue: Math.round(min * 100) / 100,
      maxValue: Math.round(max * 100) / 100,
      count: values.length,
    });
  }

  // Sort by date ascending
  dailyAverages.sort((a, b) => a.date.localeCompare(b.date));

  return dailyAverages;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Normalises the `types` parameter — accepts a comma-separated string or an array.
 */
function resolveTypeList(types?: string[] | string): string[] {
  if (!types) return [];

  if (Array.isArray(types)) return types.filter(Boolean);

  return types
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}
