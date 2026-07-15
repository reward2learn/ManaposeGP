import type { DbClient } from '@/lib/db';
import { getSymptoms } from '@/domain/health/symptom-service';
import { getMetrics, type HealthMetricEntry } from '@/domain/health/health-metrics-service';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ClinicalAlert {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  triggeredAt: string;
}

export interface AlertsResult {
  alerts: ClinicalAlert[];
  generatedAt: string;
  patientId: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns today's ISO date string (YYYY-MM-DD).
 */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Returns an ISO date string `days` ago at midnight UTC.
 */
function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/**
 * Extracts a numeric value from a metric's JSON `value` field.
 * Handles plain numbers and objects with numeric keys.
 */
function extractNumeric(value: unknown): number {
  if (typeof value === 'number') return value;

  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    const candidateKeys = ['value', 'avg', 'mean', 'qty', 'count', 'level', 'score'];
    for (const key of candidateKeys) {
      if (typeof obj[key] === 'number') return obj[key] as number;
    }
    for (const [, v] of Object.entries(obj)) {
      if (typeof v === 'number') return v;
    }
  }

  throw new Error(`Cannot extract numeric value from: ${JSON.stringify(value)}`);
}

/**
 * Computes the arithmetic mean of an array of numbers.
 * Returns 0 for an empty array.
 */
function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Computes the percentage change from `oldValue` to `newValue`.
 * Returns 0 if `oldValue` is 0 to avoid division by zero.
 */
function percentChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return 0;
  return ((newValue - oldValue) / oldValue) * 100;
}

/**
 * Groups metric entries by date (YYYY-MM-DD) and collects their numeric values.
 */
function groupMetricsByDate(metrics: HealthMetricEntry[]): Map<string, number[]> {
  const byDate = new Map<string, number[]>();

  for (const metric of metrics) {
    try {
      const num = extractNumeric(metric.value);
      const date = metric.recordedAt.slice(0, 10);
      const values = byDate.get(date) ?? [];
      values.push(num);
      byDate.set(date, values);
    } catch {
      // Skip rows whose value cannot be interpreted as numeric
    }
  }

  return byDate;
}

/**
 * Converts a date-grouped metric map into sorted daily averages.
 */
function dailyAveragesFromGroup(
  byDate: Map<string, number[]>,
): { date: string; avg: number }[] {
  return [...byDate.entries()]
    .map(([date, values]) => ({ date, avg: avg(values) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── Detection rules ───────────────────────────────────────────────────────────

/**
 * Rule 1: Sleep decline — average sleep duration dropped >20%
 * over the last 7 days compared to the previous 7 days.
 */
async function detectSleepDecline(
  db: DbClient,
  profileId: string,
): Promise<ClinicalAlert | null> {
  const end = todayIso();
  const start = daysAgoIso(14);

  const metrics = await getMetrics(db, profileId, {
    types: 'sleep_duration',
    from: start,
    to: end,
  });

  const byDate = groupMetricsByDate(metrics);
  const dailyAvgs = dailyAveragesFromGroup(byDate);

  if (dailyAvgs.length < 4) return null;

  const mid = Math.floor(dailyAvgs.length / 2);
  const older = dailyAvgs.slice(0, mid).map((d) => d.avg);
  const newer = dailyAvgs.slice(mid).map((d) => d.avg);

  const olderAvg = avg(older);
  const newerAvg = avg(newer);

  const decline = percentChange(olderAvg, newerAvg);

  if (decline < -20) {
    return {
      type: 'sleep_decline',
      severity: 'warning',
      title: 'Sleep Duration Declining',
      message: `Average sleep duration dropped by ${Math.abs(decline).toFixed(1)}% (from ${olderAvg.toFixed(1)}h to ${newerAvg.toFixed(1)}h) over the last 7 days compared to the previous week.`,
      triggeredAt: new Date().toISOString(),
    };
  }

  return null;
}

/**
 * Rule 2: HRV decline — average HRV dropped >15% over the last 14 days
 * (comparing the earlier half to the later half).
 */
async function detectHrvDecline(
  db: DbClient,
  profileId: string,
): Promise<ClinicalAlert | null> {
  const end = todayIso();
  const start = daysAgoIso(14);

  const metrics = await getMetrics(db, profileId, {
    types: 'hrv',
    from: start,
    to: end,
  });

  const byDate = groupMetricsByDate(metrics);
  const dailyAvgs = dailyAveragesFromGroup(byDate);

  if (dailyAvgs.length < 4) return null;

  const mid = Math.floor(dailyAvgs.length / 2);
  const older = dailyAvgs.slice(0, mid).map((d) => d.avg);
  const newer = dailyAvgs.slice(mid).map((d) => d.avg);

  const olderAvg = avg(older);
  const newerAvg = avg(newer);

  const decline = percentChange(olderAvg, newerAvg);

  if (decline < -15) {
    return {
      type: 'hrv_decline',
      severity: 'warning',
      title: 'Heart Rate Variability Declining',
      message: `Average HRV dropped by ${Math.abs(decline).toFixed(1)}% (from ${olderAvg.toFixed(1)}ms to ${newerAvg.toFixed(1)}ms) over the last 14 days.`,
      triggeredAt: new Date().toISOString(),
    };
  }

  return null;
}

/**
 * Rule 3: Symptom escalation — average daily symptom severity increased
 * >3 points (last 7 days vs previous 7 days). Critical if >5, warning if >3.
 */
async function detectSymptomEscalation(
  db: DbClient,
  profileId: string,
): Promise<ClinicalAlert | null> {
  const end = todayIso();
  const start = daysAgoIso(14);

  const symptoms = await getSymptoms(db, profileId, { from: start, to: end });

  // Group by date and collect severity values
  const byDate = new Map<string, number[]>();
  for (const entry of symptoms) {
    const date = entry.date.toISOString().slice(0, 10);
    const severities = byDate.get(date) ?? [];
    severities.push(entry.severity);
    byDate.set(date, severities);
  }

  const dailyAvgs = dailyAveragesFromGroup(byDate);

  if (dailyAvgs.length < 4) return null;

  const mid = Math.floor(dailyAvgs.length / 2);
  const older = dailyAvgs.slice(0, mid).map((d) => d.avg);
  const newer = dailyAvgs.slice(mid).map((d) => d.avg);

  const olderAvg = avg(older);
  const newerAvg = avg(newer);

  const increase = newerAvg - olderAvg;

  if (increase > 3) {
    const severity: ClinicalAlert['severity'] = increase > 5 ? 'critical' : 'warning';
    return {
      type: 'symptom_escalation',
      severity,
      title: 'Symptom Severity Increasing',
      message: `Average daily symptom severity increased by ${increase.toFixed(1)} points (from ${olderAvg.toFixed(1)} to ${newerAvg.toFixed(1)}) over the last 7 days compared to the previous week.`,
      triggeredAt: new Date().toISOString(),
    };
  }

  return null;
}

/**
 * Rule 4: Temperature sustained elevation — wrist temperature elevated
 * >0.5°C above baseline for 5+ consecutive days.
 */
async function detectTemperatureElevation(
  db: DbClient,
  profileId: string,
): Promise<ClinicalAlert | null> {
  // Query 21 days: first ~14 for baseline calculation, last 7 for detection
  const end = todayIso();
  const start = daysAgoIso(21);

  const metrics = await getMetrics(db, profileId, {
    types: 'wrist_temperature',
    from: start,
    to: end,
  });

  const byDate = groupMetricsByDate(metrics);
  const dailyAvgs = dailyAveragesFromGroup(byDate);

  if (dailyAvgs.length < 8) return null;

  // Use the earlier portion as baseline, the last 7 entries as the check window
  const splitPoint = Math.max(0, dailyAvgs.length - 7);
  const baselineDays = dailyAvgs.slice(0, splitPoint);
  const checkDays = dailyAvgs.slice(splitPoint);

  const baselineAvg = avg(baselineDays.map((d) => d.avg));
  if (baselineAvg === 0) return null;

  // Count consecutive days above baseline + 0.5°C
  let maxConsecutive = 0;
  let currentStreak = 0;

  for (const day of checkDays) {
    if (day.avg > baselineAvg + 0.5) {
      currentStreak += 1;
      if (currentStreak > maxConsecutive) {
        maxConsecutive = currentStreak;
      }
    } else {
      currentStreak = 0;
    }
  }

  if (maxConsecutive >= 5) {
    return {
      type: 'temperature_sustained_elevation',
      severity: 'warning',
      title: 'Sustained Temperature Elevation',
      message: `Wrist temperature has been elevated more than 0.5°C above your baseline (${baselineAvg.toFixed(1)}°C) for ${maxConsecutive} consecutive days.`,
      triggeredAt: new Date().toISOString(),
    };
  }

  return null;
}

/**
 * Rule 5: Disengagement — no symptom journal entries for 10+ days.
 */
async function detectDisengagement(
  db: DbClient,
  profileId: string,
): Promise<ClinicalAlert | null> {
  const latest = await db.symptomJournal.findMany({
    where: { healthProfileId: profileId },
    orderBy: { date: 'desc' },
    take: 1,
    select: { date: true },
  });

  if (latest.length === 0) return null;

  const lastEntryDate = latest[0].date;
  const now = new Date();
  const daysSince = Math.floor(
    (now.getTime() - lastEntryDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysSince >= 10) {
    return {
      type: 'disengagement',
      severity: 'info',
      title: 'Symptom Tracking Gap',
      message: "It's been a while since you logged symptoms. Regular tracking helps identify patterns.",
      triggeredAt: new Date().toISOString(),
    };
  }

  return null;
}

/**
 * Rule 6: High severity cluster — 3+ consecutive days with any symptom
 * severity ≥ 8.
 */
async function detectHighSeverityCluster(
  db: DbClient,
  profileId: string,
): Promise<ClinicalAlert | null> {
  const end = todayIso();
  const start = daysAgoIso(30);

  const symptoms = await getSymptoms(db, profileId, { from: start, to: end });

  // Build a map of (date → max severity for that date)
  const dailyMaxSeverity = new Map<string, number>();
  for (const entry of symptoms) {
    const date = entry.date.toISOString().slice(0, 10);
    const currentMax = dailyMaxSeverity.get(date) ?? 0;
    if (entry.severity > currentMax) {
      dailyMaxSeverity.set(date, entry.severity);
    }
  }

  // Walk dates chronologically to detect consecutive high-severity days
  const sortedDates = [...dailyMaxSeverity.keys()].sort();

  let consecutiveHigh = 0;

  for (const date of sortedDates) {
    const maxSev = dailyMaxSeverity.get(date) ?? 0;
    if (maxSev >= 8) {
      consecutiveHigh += 1;
      if (consecutiveHigh >= 3) {
        return {
          type: 'high_severity_cluster',
          severity: 'critical',
          title: 'High Severity Symptom Cluster',
          message: `${consecutiveHigh} consecutive days with symptom severity rated 8 or above detected. This may indicate a significant flare-up requiring clinical attention.`,
          triggeredAt: new Date().toISOString(),
        };
      }
    } else {
      consecutiveHigh = 0;
    }
  }

  return null;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Runs all detection rules on the patient's health data and returns
 * any triggered clinical alerts.
 *
 * Alerts are not persisted — they are computed on-demand each call.
 * Returns an empty array if no rules are triggered.
 *
 * @param db        Database client
 * @param profileId The `health_profiles.id`
 */
export async function generateAlerts(
  db: DbClient,
  profileId: string,
): Promise<ClinicalAlert[]> {
  if (!profileId || typeof profileId !== 'string') {
    throw new Error('profileId is required');
  }

  const results = await Promise.all([
    detectSleepDecline(db, profileId),
    detectHrvDecline(db, profileId),
    detectSymptomEscalation(db, profileId),
    detectTemperatureElevation(db, profileId),
    detectDisengagement(db, profileId),
    detectHighSeverityCluster(db, profileId),
  ]);

  return results.filter((a): a is ClinicalAlert => a !== null);
}
