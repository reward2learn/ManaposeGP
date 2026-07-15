import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePin } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import { logActivity } from '@/domain/admin/activity-log-service';

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
    const gps = await db.gPProfile.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, practiceName: true, practiceSuburb: true, practiceState: true,
        ahpraNumber: true, email: true, verified: true, verificationStatus: true,
        verificationNotes: true, createdAt: true,
        indemnityProvider: true, indemnityExpiryDate: true,
      },
    });

    return NextResponse.json({ success: true, gps });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed', 500);
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
    const updateData: Record<string, unknown> = {
      verificationStatus: parsed.data.status,
      verificationNotes: parsed.data.notes ?? null,
    };
    if (parsed.data.status === 'APPROVED') {
      updateData.verified = true;
    }
    if (parsed.data.status === 'REJECTED') {
      updateData.verified = false;
    }

    await db.gPProfile.update({ where: { id: parsed.data.gpId }, data: updateData });
    await logActivity(db, guard.session.sub, `VERIFY_GP_${parsed.data.status}`, parsed.data.gpId, { notes: parsed.data.notes });

    return NextResponse.json({ success: true, message: `GP ${parsed.data.status.toLowerCase()}` });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed', 500);
  }
}
