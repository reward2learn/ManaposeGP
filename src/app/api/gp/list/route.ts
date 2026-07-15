import { NextRequest, NextResponse } from 'next/server';
import { requireWriteAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET: List verified GPs (public info only — name, practice, id)
export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });

  try {
    const gps = await db.gPProfile.findMany({
      where: { verified: true },
      select: {
        id: true,
        name: true,
        practiceName: true,
        practiceAddress: true,
        practiceSuburb: true,
        practiceState: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, gps });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to list GPs' },
      { status: 500 },
    );
  }
}
