import type { DbClient } from '@/lib/db';
import type { HealthProfile, SymptomJournal } from '@/generated/prisma';
import { getSymptoms } from '@/domain/health/symptom-service';
import { getMetrics, type HealthMetricEntry } from '@/domain/health/health-metrics-service';
import { resolveOpenAiKey } from '@/lib/openai';

// ── Types ────────────────────────────────────────────────────────────────────

export interface InsightItem {
  title: string;
  description: string;
  category: 'sleep' | 'activity' | 'symptoms' | 'temperature' | 'cardiovascular' | 'general';
  actionable: string;
  severity: 'info' | 'warning';
}

export interface HealthInsights {
  insights: InsightItem[];
  dataSummary: Record<string, unknown>;
  generatedAt: string;
  staleAt: string;
}

// ── Cache ────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const insightCache = new Map<string, { insights: HealthInsights; storedAt: number }>();

// ── Constants ────────────────────────────────────────────────────────────────

const LOOKBACK_DAYS = 30;

const INSIGHT_MODEL = process.env.OPENAI_INSIGHT_MODEL || 'gpt-4o';

const VALID_CATEGORIES = new Set<string>([
  'sleep',
  'activity',
  'symptoms',
  'temperature',
  'cardiovascular',
  'general',
]);

const VALID_SEVERITIES = new Set<string>(['info', 'warning']);

const SYSTEM_PROMPT = [
  "You are a health data analyst for the ManaposeGP women's health platform.",
  'Analyze the provided patient data and generate 3-5 specific, actionable insights.',
  'Do NOT diagnose. Use plain language.',
  'Identify correlations (e.g., sleep quality ↔ symptom severity, HRV trends ↔ hot flush frequency).',
  'Format response as valid JSON:',
  '{ "insights": [{"title": "...", "description": "...", "category": "sleep|activity|symptoms|temperature|cardiovascular|general", "actionable": "...", "severity": "info|warning"}] }',
].join(' ');

// ── Metric grouping config ───────────────────────────────────────────────────

interface MetricSummaryConfig {
  group: string;
  label: string;
}

const METRIC_CONFIG: Record<string, MetricSummaryConfig> = {
  sleep_duration: { group: 'sleep', label: 'avgHours' },
  sleep_quality: { group: 'sleep', label: 'avgQuality' },
  resting_heart_rate: { group: 'heartRate', label: 'avgResting' },
  heart_rate: { group: 'heartRate', label: 'avg' },
  hrv: { group: 'heartRate', label: 'avgHRV' },
  wrist_temperature: { group: 'temperature', label: 'avgWrist' },
  body_temperature: { group: 'temperature', label: 'avgBody' },
  steps: { group: 'activity', label: 'avgSteps' },
  active_energy: { group: 'activity', label: 'avgActiveEnergy' },
  blood_pressure_systolic: { group: 'bloodPressure', label: 'avgSystolic' },
  blood_pressure_diastolic: { group: 'bloodPressure', label: 'avgDiastolic' },
  oxygen_saturation: { group: 'cardiovascular', label: 'avgSpO2' },
  respiratory_rate: { group: 'cardiovascular', label: 'avgRespRate' },
  weight: { group: 'body', label: 'avgWeight' },
  bmi: { group: 'body', label: 'avgBMI' },
  blood_glucose: { group: 'body', label: 'avgGlucose' },
  menstrual_flow: { group: 'symptoms', label: 'avgFlow' },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns an ISO date string `days` days ago at midnight UTC.
 */
function lookbackFrom(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/**
 * Returns today's ISO date string.
 */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Computes age in years from a Date object.
 */
function computeAge(dateOfBirth: Date): number {
  const today = new Date();
  let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDelta = today.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < dateOfBirth.getUTCDate())) {
    age -= 1;
  }
  return age;
}

/**
 * Returns the ISO week Monday for the given date string (YYYY-MM-DD).
 */
function getWeekMonday(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Determines trend direction from a chronologically ordered array of numbers.
 * Uses linear regression on the index to detect slope direction.
 */
function computeTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
  if (values.length < 2) return 'stable';

  const n = values.length;
  // Simple linear regression slope
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i += 1) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return 'stable';

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const mean = sumY / n;

  // Use 1% of the mean as the stability threshold
  const threshold = mean === 0 ? 0.1 : Math.abs(mean * 0.01);
  if (Math.abs(slope) < threshold) return 'stable';
  return slope > 0 ? 'increasing' : 'decreasing';
}

/**
 * Extracts a numeric value from a metric's JSON value field.
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

// ── Data summary builders ────────────────────────────────────────────────────

interface ProfileSummary {
  age: number | null;
  sexAtBirth: string | null;
  menopauseStatus: string | null;
  heightCm: number | null;
  weightKg: number | null;
  chronicConditions: string[];
  currentMedications: string[];
  smokingStatus: string | null;
  alcoholUnitsPerWeek: number | null;
  exerciseMinutesPerWeek: number | null;
}

function buildProfileSummary(profile: HealthProfile): ProfileSummary {
  return {
    age: profile.dateOfBirth ? computeAge(profile.dateOfBirth) : null,
    sexAtBirth: profile.sexAtBirth ?? null,
    menopauseStatus: profile.menopauseStatus ?? null,
    heightCm: profile.heightCm ?? null,
    weightKg: profile.weightKg ?? null,
    chronicConditions: profile.chronicConditions,
    currentMedications: profile.currentMedications,
    smokingStatus: profile.smokingStatus ?? null,
    alcoholUnitsPerWeek: profile.alcoholUnitsPerWeek ?? null,
    exerciseMinutesPerWeek: profile.exerciseMinutesPerWeek ?? null,
  };
}

interface SymptomSummary {
  totalEntries: number;
  topSymptoms: { type: string; count: number; avgSeverity: number }[];
  avgSeverity: number;
  trendByWeek: { week: string; avgSeverity: number; count: number }[];
}

function buildSymptomSummary(symptoms: SymptomJournal[]): SymptomSummary {
  if (symptoms.length === 0) {
    return {
      totalEntries: 0,
      topSymptoms: [],
      avgSeverity: 0,
      trendByWeek: [],
    };
  }

  // Count by symptom type
  const byType = new Map<string, { count: number; totalSeverity: number }>();
  let totalSeverity = 0;

  for (const entry of symptoms) {
    const existing = byType.get(entry.symptomType);
    if (existing) {
      existing.count += 1;
      existing.totalSeverity += entry.severity;
    } else {
      byType.set(entry.symptomType, { count: 1, totalSeverity: entry.severity });
    }
    totalSeverity += entry.severity;
  }

  const topSymptoms = [...byType.entries()]
    .map(([type, { count, totalSeverity: ts }]) => ({
      type,
      count,
      avgSeverity: Math.round((ts / count) * 10) / 10,
    }))
    .sort((a, b) => b.count - a.count);

  // Weekly trends
  const weeklyMap = new Map<string, { total: number; count: number }>();
  for (const entry of symptoms) {
    const week = getWeekMonday(entry.date.toISOString().slice(0, 10));
    const existing = weeklyMap.get(week) ?? { total: 0, count: 0 };
    existing.total += entry.severity;
    existing.count += 1;
    weeklyMap.set(week, existing);
  }

  const trendByWeek = [...weeklyMap.entries()]
    .map(([week, { total, count }]) => ({
      week,
      avgSeverity: Math.round((total / count) * 10) / 10,
      count,
    }))
    .sort((a, b) => a.week.localeCompare(b.week));

  return {
    totalEntries: symptoms.length,
    topSymptoms,
    avgSeverity: Math.round((totalSeverity / symptoms.length) * 10) / 10,
    trendByWeek,
  };
}

interface MetricsSummary {
  [groupKey: string]: Record<string, number | string>;
}

function buildMetricsSummary(metrics: HealthMetricEntry[]): MetricsSummary {
  // Group metrics by type and collect daily numeric values
  const byTypeChrono = new Map<string, { dates: string[]; values: number[] }>();

  for (const metric of metrics) {
    const date = metric.recordedAt.slice(0, 10);
    let numeric: number;
    try {
      numeric = extractNumeric(metric.value);
    } catch {
      continue;
    }

    const record = byTypeChrono.get(metric.metricType);
    if (record) {
      record.dates.push(date);
      record.values.push(numeric);
    } else {
      byTypeChrono.set(metric.metricType, { dates: [date], values: [numeric] });
    }
  }

  const summary: MetricsSummary = {};

  for (const [metricType, { values }] of byTypeChrono) {
    const config = METRIC_CONFIG[metricType];
    if (!config) continue;

    const avg = values.length > 0
      ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10
      : 0;
    const trend = computeTrend(values);

    const group = config.group;
    if (!summary[group]) {
      summary[group] = {};
    }
    summary[group][config.label] = avg;
    summary[group].trend = trend;
  }

  return summary;
}

// ── OpenAI call ──────────────────────────────────────────────────────────────

interface RawInsightItem {
  title: string;
  description: string;
  category: string;
  actionable: string;
  severity: string;
}

function validateInsightItem(item: unknown): item is InsightItem {
  if (typeof item !== 'object' || item === null) return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.title === 'string' &&
    typeof obj.description === 'string' &&
    typeof obj.category === 'string' &&
    VALID_CATEGORIES.has(obj.category) &&
    typeof obj.actionable === 'string' &&
    typeof obj.severity === 'string' &&
    VALID_SEVERITIES.has(obj.severity)
  );
}

function sanitiseInsight(item: RawInsightItem): InsightItem {
  return {
    title: item.title,
    description: item.description,
    category: (VALID_CATEGORIES.has(item.category) ? item.category : 'general') as InsightItem['category'],
    actionable: item.actionable,
    severity: (VALID_SEVERITIES.has(item.severity) ? item.severity : 'info') as InsightItem['severity'],
  };
}

async function callOpenAiInsights(dataSummary: Record<string, unknown>): Promise<InsightItem[]> {
  const apiKey = await resolveOpenAiKey();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: INSIGHT_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Analyze this patient health data and return insights as JSON:\n${JSON.stringify(dataSummary)}`,
        },
      ],
      temperature: 0.4,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    let detail = 'OpenAI API error';
    try {
      const errBody = await response.json() as { error?: { message?: string } };
      if (errBody.error?.message) detail = errBody.error.message;
    } catch {
      // ignore parse failure
    }
    throw new Error(`OpenAI API returned ${response.status}: ${detail}`);
  }

  const data = await response.json() as {
    choices?: { message?: { content?: string } }[];
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI returned an empty response');
  }

  let parsed: { insights?: RawInsightItem[] };
  try {
    parsed = JSON.parse(content) as { insights?: RawInsightItem[] };
  } catch {
    throw new Error('Failed to parse OpenAI insight response as JSON');
  }

  if (!Array.isArray(parsed.insights)) {
    throw new Error('OpenAI response missing insights array');
  }

  return parsed.insights
    .filter(validateInsightItem)
    .map(sanitiseInsight);
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates AI-powered health insights for a patient profile.
 *
 * Fetches the last 30 days of symptom journal entries and health metrics,
 * builds a structured data summary, and calls GPT-4o to generate 3-5
 * actionable insights. Results are cached for 24 hours.
 *
 * @param db        Database client
 * @param profileId The `health_profiles.id`
 */
export async function generateInsights(
  db: DbClient,
  profileId: string,
): Promise<HealthInsights> {
  if (!profileId || typeof profileId !== 'string') {
    throw new Error('profileId is required');
  }

  // ── Check cache ───────────────────────────────────────────────────────
  const cached = insightCache.get(profileId);
  if (cached && Date.now() - cached.storedAt < CACHE_TTL_MS) {
    return cached.insights;
  }

  // ── Fetch profile ─────────────────────────────────────────────────────
  const profile = await db.healthProfile.findUnique({
    where: { id: profileId },
  });

  if (!profile) {
    throw new Error(`Health profile not found: ${profileId}`);
  }

  // ── Fetch data ────────────────────────────────────────────────────────
  const from = lookbackFrom(LOOKBACK_DAYS);
  const to = todayIso();

  const [symptoms, metrics] = await Promise.all([
    getSymptoms(db, profileId, { from, to }),
    getMetrics(db, profileId, { from, to }),
  ]);

  // ── Build data summary ────────────────────────────────────────────────
  const profileSummary = buildProfileSummary(profile);
  const symptomSummary = buildSymptomSummary(symptoms);
  const metricsSummary = buildMetricsSummary(metrics);

  const dataSummary: Record<string, unknown> = {
    profile: profileSummary,
    symptoms: symptomSummary,
    metrics: metricsSummary,
  };

  // ── Call OpenAI ───────────────────────────────────────────────────────
  const insights = await callOpenAiInsights(dataSummary);

  // ── Build result ──────────────────────────────────────────────────────
  const now = new Date();
  const staleAt = new Date(now.getTime() + CACHE_TTL_MS);

  const result: HealthInsights = {
    insights,
    dataSummary,
    generatedAt: now.toISOString(),
    staleAt: staleAt.toISOString(),
  };

  // ── Store in cache ────────────────────────────────────────────────────
  insightCache.set(profileId, { insights: result, storedAt: Date.now() });

  return result;
}
