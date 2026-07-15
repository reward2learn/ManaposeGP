import { NextRequest, NextResponse } from 'next/server';
import { requirePin } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import { getFeatureFlags, updateFeatureFlags } from '@/domain/admin/admin-config-service';
import { logActivity } from '@/domain/admin/activity-log-service';

export const dynamic = 'force-dynamic';
function jsonError(e: string, s = 400) { return NextResponse.json({ success: false, error: e }, { status: s }); }

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;
  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
  try { return NextResponse.json({ success: true, flags: await getFeatureFlags(db) }); }
  catch (err) { return jsonError(err instanceof Error ? err.message : 'Failed', 500); }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;
  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
  try {
    const body = await request.json() as Record<string, boolean>;
    const flags = await updateFeatureFlags(db, body);
    await logActivity(db, guard.session.sub, 'UPDATE_FEATURE_FLAGS', undefined, flags as unknown as Record<string, unknown>);
    return NextResponse.json({ success: true, flags });
  } catch (err) { return jsonError(err instanceof Error ? err.message : 'Failed', 500); }
}
