import { NextRequest, NextResponse } from 'next/server';
import { requirePin } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import { getActivityLogs } from '@/domain/admin/activity-log-service';
import { ensureAdminTables } from '@/domain/admin/admin-config-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });

  try {
    await ensureAdminTables(db);
    const url = new URL(request.url);
    const action = url.searchParams.get('action') ?? undefined;
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);

    const logs = await getActivityLogs(db, limit, action);
    return NextResponse.json({ success: true, logs });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 },
    );
  }
}
