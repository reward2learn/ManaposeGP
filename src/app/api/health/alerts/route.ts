import { NextRequest, NextResponse } from 'next/server';
import { requireGoogle } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import { getProfile } from '@/domain/health/health-profile-service';
import { generateAlerts } from '@/domain/health/clinical-alert-service';

// ── Helpers ──────────────────────────────────────────────────────────────────

function jsonError(
  error: string,
  status = 400,
): NextResponse<{ success: false; error: string }> {
  return NextResponse.json({ success: false, error }, { status });
}

// ── GET: Patient clinical alerts ─────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requireGoogle(request);
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

    const alerts = await generateAlerts(db, profile.id);

    return NextResponse.json({
      success: true,
      alerts,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to generate clinical alerts';
    return jsonError(message, 500);
  }
}
