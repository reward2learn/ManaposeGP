import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePin } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import { logActivity } from '@/domain/admin/activity-log-service';
import { ensureGpProfileColumns, listGpsForVerification } from '@/domain/health/gp-profile-service';

export const dynamic = 'force-dynamic';

const verifySchema = z.object({
  gpId: z.string().min(1),
  status: z.enum(['APPROVED', 'REJECTED']),
  notes: z.string().optional(),
});

function jsonError(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });

  try {
    // Ensure verification columns exist, then query with raw SQL
    // (avoids Prisma schema mismatch on verification_status column)
    await ensureGpProfileColumns(db);
    const gps = await listGpsForVerification(db);
    return NextResponse.json({ success: true, gps });
  } catch {
    // Fallback: if columns still don't exist, query without verification fields
    try {
      const gps = await db.$queryRawUnsafe(`
        SELECT id, name,
          practice_name as "practiceName", practice_suburb as "practiceSuburb",
          practice_state as "practiceState", ahpra_number as "ahpraNumber",
          email, verified, 'PENDING' as "verificationStatus",
          NULL as "verificationNotes", created_at as "createdAt",
          indemnity_provider as "indemnityProvider",
          indemnity_expiry_date as "indemnityExpiryDate"
        FROM gp_profiles ORDER BY created_at DESC
      `);
      return NextResponse.json({ success: true, gps });
    } catch (err2) {
      return jsonError(err2 instanceof Error ? err2.message : 'Failed', 500);
    }
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON'); }

  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) return jsonError(`Validation: ${parsed.error.issues[0]?.message}`);

  try {
    await ensureGpProfileColumns(db);

    // Use raw SQL to update verification status (avoids Prisma schema mismatch)
    const verified = parsed.data.status === 'APPROVED';
    await db.$queryRawUnsafe(
      `UPDATE gp_profiles SET verified = $1, verification_status = $2, verification_notes = $3, updated_at = NOW() WHERE id = $4`,
      verified, parsed.data.status, parsed.data.notes ?? null, parsed.data.gpId,
    );

    await logActivity(db, guard.session.sub, `VERIFY_GP_${parsed.data.status}`, parsed.data.gpId, { notes: parsed.data.notes });

    return NextResponse.json({ success: true, message: `GP ${parsed.data.status.toLowerCase()}` });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed', 500);
  }
}
