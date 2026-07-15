import { NextRequest, NextResponse } from 'next/server';
import { requireWriteAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import { getProfile } from '@/domain/health/health-profile-service';
import { generateInsights } from '@/domain/health/health-insight-engine';

// ── Constants ────────────────────────────────────────────────────────────────

const MIN_SYMPTOM_DAYS = 7;

// ── Helpers ──────────────────────────────────────────────────────────────────

function jsonError(
  error: string,
  status = 400,
): NextResponse<{ success: false; error: string }> {
  return NextResponse.json({ success: false, error }, { status });
}

/**
 * Counts the number of distinct dates with at least one symptom journal entry
 * for the given profile (all-time).
 */
async function countDistinctSymptomDays(
  db: ReturnType<typeof createClient>,
  profileId: string,
): Promise<number> {
  const rows = await db.symptomJournal.findMany({
    where: { healthProfileId: profileId },
    select: { date: true },
    distinct: ['date'],
  });

  return rows.length;
}

// ── GET: Generate health insights ────────────────────────────────────────────

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
      return jsonError('Health profile not found', 404);
    }

    // Require at least 7 days of symptom data
    const distinctDays = await countDistinctSymptomDays(db, profile.id);

    if (distinctDays < MIN_SYMPTOM_DAYS) {
      return NextResponse.json({
        success: true,
        insights: [],
        message: `Log symptoms for at least ${MIN_SYMPTOM_DAYS} days to unlock AI insights. You have ${distinctDays} ${distinctDays === 1 ? 'day' : 'days'} of data.`,
      });
    }

    const result = await generateInsights(db, profile.id);

    return NextResponse.json({
      success: true,
      insights: result.insights,
      dataSummary: result.dataSummary,
      generatedAt: result.generatedAt,
      staleAt: result.staleAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate health insights';
    return jsonError(message, 500);
  }
}
