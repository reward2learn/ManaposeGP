import { NextRequest, NextResponse } from 'next/server';
import { requirePin } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import { getFeatureFlags, updateFeatureFlags, ensureAdminTables } from '@/domain/admin/admin-config-service';
import { logActivity } from '@/domain/admin/activity-log-service';

export const dynamic = 'force-dynamic';
function jsonError(e: string, s = 400) { return NextResponse.json({ success: false, error: e }, { status: s }); }

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;
  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
  try {
    await ensureAdminTables(db);
    return NextResponse.json({ success: true, flags: await getFeatureFlags(db) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    console.error('[feature-flags] GET error:', msg);
    return jsonError(msg, 500);
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;
  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
  try {
    await ensureAdminTables(db);
    const body = await request.json() as Record<string, boolean>;
    const flags = await updateFeatureFlags(db, body);
    await logActivity(db, guard.session.sub, 'UPDATE_FEATURE_FLAGS', undefined, flags as unknown as Record<string, unknown>);
    return NextResponse.json({ success: true, flags });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    console.error('[feature-flags] PATCH error:', msg);
    return jsonError(msg, 500);
  }
}
