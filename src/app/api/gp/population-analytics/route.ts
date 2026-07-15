import { NextRequest, NextResponse } from 'next/server';
import { requirePin } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import { getPopulationAnalytics } from '@/domain/health/population-analytics';

// ── Helpers ──────────────────────────────────────────────────────────────────

function jsonError(
  error: string,
  status = 400,
): NextResponse<{ success: false; error: string }> {
  return NextResponse.json({ success: false, error }, { status });
}

// ── GET: Population health analytics for the GP's consented panel ────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  const gpId = guard.session.sub;
  const db = createClient({
    tier: guard.session.tier,
    sub: gpId,
  });

  try {
    const analytics = await getPopulationAnalytics(db, gpId);

    if (analytics.panelSize === 0) {
      return NextResponse.json({
        success: true,
        analytics: null,
        message: 'No consented patients in your panel yet.',
      });
    }

    return NextResponse.json({ success: true, analytics });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to retrieve population analytics';
    return jsonError(message, 500);
  }
}
