import { NextRequest, NextResponse } from 'next/server';
import { requirePin } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import { getDashboardStats } from '@/domain/admin/activity-log-service';
import { ensureGpProfileColumns } from '@/domain/health/gp-profile-service';
import { ensureAdminTables } from '@/domain/admin/admin-config-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });

  try {
    await ensureAdminTables(db);
    await ensureGpProfileColumns(db);
    const stats = await getDashboardStats(db);
    return NextResponse.json({ success: true, stats });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 },
    );
  }
}
