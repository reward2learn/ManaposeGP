import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { requireWriteAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import { getProfile } from '@/domain/health/health-profile-service';
import {
  getMetrics,
  getMetricAverages,
  VALID_METRIC_TYPES,
  type DailyAverage,
} from '@/domain/health/health-metrics-service';

// ── Zod schemas ─────────────────────────────────────────────────────────────

const metricQuerySchema = z.object({
  types: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  days: z
    .string()
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      const n = Number(val);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    }),
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function jsonError(
  error: string,
  status = 400,
): NextResponse<{ success: false; error: string }> {
  return NextResponse.json({ success: false, error }, { status });
}

/**
 * Picks the "primary" type from a comma-separated list for daily-averages.
 * The first valid type wins; falls back to `heart_rate`.
 */
function resolvePrimaryType(typesParam?: string): string | undefined {
  if (!typesParam) return undefined;

  const types = typesParam
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  if (types.length === 0) return undefined;

  // Return the first type that matches a known metric type
  const primary = types.find((t) => VALID_METRIC_TYPES.has(t));
  return primary ?? undefined;
}

// ── GET: Query health metrics with optional daily averages ──────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const userId = guard.session.sub;
  const db = createClient({
    tier: guard.session.tier,
    sub: userId,
  });

  try {
    const profile = await getProfile(db, userId);
    if (!profile) {
      return NextResponse.json({
        success: true,
        metrics: [],
        dailyAverages: {},
      });
    }

    const url = new URL(request.url);
    const rawQuery = {
      types: url.searchParams.get('types') ?? undefined,
      from: url.searchParams.get('from') ?? undefined,
      to: url.searchParams.get('to') ?? undefined,
      days: url.searchParams.get('days') ?? undefined,
    };

    const query = metricQuerySchema.safeParse(rawQuery);
    const from = query.success ? query.data.from : undefined;
    const to = query.success ? query.data.to : undefined;
    const typesParam = query.success ? query.data.types : undefined;
    const days = query.success ? query.data.days : undefined;

    const metrics = await getMetrics(db, profile.id, {
      types: typesParam,
      from,
      to,
    });

    // Compute daily averages for the primary type (if requested)
    const dailyAverages: Record<string, DailyAverage[]> = {};
    const primaryType = resolvePrimaryType(typesParam);

    if (primaryType) {
      dailyAverages[primaryType] = await getMetricAverages(
        db,
        profile.id,
        primaryType,
        days ?? 7,
      );
    }

    return NextResponse.json({
      success: true,
      metrics,
      dailyAverages,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve health metrics';
    return jsonError(message, 500);
  }
}
