import { NextRequest, NextResponse } from 'next/server';
import { requirePin } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import { getPlatformUsers, updateUser } from '@/domain/admin/admin-config-service';
import { logActivity } from '@/domain/admin/activity-log-service';

export const dynamic = 'force-dynamic';
function jsonError(e: string, s = 400) { return NextResponse.json({ success: false, error: e }, { status: s }); }

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;
  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
  try { return NextResponse.json({ success: true, users: await getPlatformUsers(db) }); }
  catch (err) { return jsonError(err instanceof Error ? err.message : 'Failed', 500); }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;
  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
  try {
    const body = await request.json() as { id: string; role?: string; tier?: string; status?: string };
    const user = await updateUser(db, body.id, { role: body.role, tier: body.tier, status: body.status });
    await logActivity(db, guard.session.sub, 'UPDATE_USER', body.id);
    return NextResponse.json({ success: true, user });
  } catch (err) { return jsonError(err instanceof Error ? err.message : 'Failed', 500); }
}
