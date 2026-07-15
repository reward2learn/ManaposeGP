import { NextRequest, NextResponse } from 'next/server';
import { requireWriteAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import { checkConsent } from '@/domain/health/consent-service';
// TODO: Create `src/domain/health/gp-prep-service.ts` with `generateGpSummary` export.
import { generateGpSummary, type GpSummary } from '@/domain/health/gp-prep-service';

// ── Types ────────────────────────────────────────────────────────────────────

interface SummaryResponse {
  success: true;
  summary: GpSummary;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function jsonError(
  error: string,
  status = 400,
): NextResponse<{ success: false; error: string }> {
  return NextResponse.json({ success: false, error }, { status });
}

// ── GET: AI-generated pre-consultation summary for a GP ──────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const { id: patientId } = await params;
  const gpId = guard.session.sub;

  const db = createClient({
    tier: guard.session.tier,
    sub: gpId,
  });

  try {
    // ── Verify consent ───────────────────────────────────────────────────
    const hasConsent = await checkConsent(db, patientId, gpId);
    if (!hasConsent) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No active consent for this patient. The patient must grant consent before you can view their pre-consultation summary.',
        },
        { status: 403 },
      );
    }

    // ── Verify profile exists ─────────────────────────────────────────────
    const profile = await db.healthProfile.findUnique({
      where: { id: patientId },
      select: { id: true },
    });

    if (!profile) {
      return jsonError('Health profile not found for the given patient', 404);
    }

    // ── Generate GP summary ──────────────────────────────────────────────
    const summary = await generateGpSummary(db, patientId);

    const response: SummaryResponse = { success: true, summary };

    return NextResponse.json(response);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'Failed to generate pre-consultation summary';
    return jsonError(message, 500);
  }
}
