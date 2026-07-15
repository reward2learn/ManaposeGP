import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { requireWriteAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';

const verifySchema = z.object({
  consultationId: z.string().min(1, 'consultationId is required'),
});

function jsonError(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

/**
 * POST /api/gp/consultations/verify
 *
 * Marks an AI-generated consultation as verified by a GP.
 * Records the verification timestamp and verifying user ID.
 * This is the GP audit trail required by RACGP Standards and Australian healthcare
 * regulations — all AI-assisted clinical outputs must be reviewed and signed off
 * by a registered medical practitioner.
 */
export async function POST(request: NextRequest) {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
  const gpUserId = guard.session.sub;

  try {
    const body = await request.json();
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues.map(i => i.message).join('; '));
    }

    // Verify the consultation exists and belongs to this GP
    const existing = await db.$queryRawUnsafe<Array<{ id: string; ai_generated: boolean; ai_verified_at: string | null }>>(
      `SELECT id, ai_generated, ai_verified_at::text FROM gp_consultations WHERE id = $1 AND gp_id = $2`,
      parsed.data.consultationId,
      gpUserId,
    );

    if (existing.length === 0) {
      return jsonError('Consultation not found or not authorized', 404);
    }

    if (!existing[0].ai_generated) {
      return jsonError('Only AI-generated consultations can be verified', 400);
    }

    if (existing[0].ai_verified_at) {
      return NextResponse.json({
        success: true,
        message: 'Already verified',
        verifiedAt: existing[0].ai_verified_at,
      });
    }

    await db.$queryRawUnsafe(
      `UPDATE gp_consultations SET ai_verified_at = NOW(), ai_verified_by = $1, updated_at = NOW() WHERE id = $2`,
      gpUserId,
      parsed.data.consultationId,
    );

    return NextResponse.json({
      success: true,
      message: 'AI output verified — GP audit trail recorded',
      verifiedAt: new Date().toISOString(),
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed to verify', 500);
  }
}

/**
 * GET /api/gp/consultations/verify?consultationId=xxx
 *
 * Returns the verification status of an AI-generated consultation.
 */
export async function GET(request: NextRequest) {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
  const { searchParams } = new URL(request.url);
  const consultationId = searchParams.get('consultationId');

  if (!consultationId) return jsonError('consultationId query param required');

  try {
    const rows = await db.$queryRawUnsafe<Array<{
      id: string;
      ai_generated: boolean;
      ai_verified_at: string | null;
      ai_verified_by: string | null;
    }>>(
      `SELECT id, ai_generated, ai_verified_at::text, ai_verified_by FROM gp_consultations WHERE id = $1`,
      consultationId,
    );

    if (rows.length === 0) return jsonError('Consultation not found', 404);

    return NextResponse.json({
      success: true,
      consultation: rows[0],
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed', 500);
  }
}
