import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { requireWriteAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import { getOrCreateProfile } from '@/domain/health/health-profile-service';
import {
  syncHealthMetrics,
  VALID_METRIC_TYPES,
  type SyncMetric,
} from '@/domain/health/health-metrics-service';

// ── Constants ───────────────────────────────────────────────────────────────

const MAX_METRICS_PER_REQUEST = 100;

// ── Zod schema ──────────────────────────────────────────────────────────────

const syncMetricSchema = z.object({
  metricType: z
    .string()
    .min(1, 'metricType is required')
    .refine(
      (val) => VALID_METRIC_TYPES.has(val),
      (val) => ({
        message: `Invalid metricType "${val}". Valid types: ${[...VALID_METRIC_TYPES].join(', ')}`,
      }),
    ),
  value: z.union([
    z.number(),
    z.string(),
    z.boolean(),
    z.record(z.unknown()),
    z.array(z.unknown()),
    z.null(),
  ]),
  unit: z.string().optional(),
  source: z.string().optional(),
  sourceDevice: z.string().optional(),
  recordedAt: z
    .string()
    .min(1, 'recordedAt is required')
    .refine(
      (val) => !Number.isNaN(Date.parse(val)),
      { message: 'recordedAt must be a valid ISO 8601 datetime' },
    ),
});

const syncBodySchema = z.object({
  metrics: z
    .array(syncMetricSchema)
    .min(1, 'At least one metric is required')
    .max(MAX_METRICS_PER_REQUEST, `Maximum ${MAX_METRICS_PER_REQUEST} metrics per request`),
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function jsonError(
  error: string,
  status = 400,
): NextResponse<{ success: false; error: string }> {
  return NextResponse.json({ success: false, error }, { status });
}

// ── POST: Sync health metrics ───────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = syncBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      `Validation failed: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
    );
  }

  const userId = guard.session.sub;
  const db = createClient({
    tier: guard.session.tier,
    sub: userId,
  });

  try {
    const profile = await getOrCreateProfile(db, userId);
    const metrics = parsed.data.metrics as SyncMetric[];
    const result = await syncHealthMetrics(db, profile.id, metrics);

    return NextResponse.json({
      success: true,
      synced: result.synced,
      duplicates: result.duplicates,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to sync health metrics';
    return jsonError(message, 500);
  }
}
