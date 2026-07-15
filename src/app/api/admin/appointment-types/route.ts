import { NextRequest, NextResponse } from 'next/server';
import { requirePin } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import { getAppointmentTypes, upsertAppointmentType, deleteAppointmentType, ensureAdminTables } from '@/domain/admin/admin-config-service';
import { logActivity } from '@/domain/admin/activity-log-service';

export const dynamic = 'force-dynamic';

function jsonError(e: string, s = 400) { return NextResponse.json({ success: false, error: e }, { status: s }); }

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;
  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
  try {
    await ensureAdminTables(db);
    return NextResponse.json({ success: true, types: await getAppointmentTypes(db) }); }
  catch (err) { return jsonError(err instanceof Error ? err.message : 'Failed', 500); }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;
  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
  try {
    await ensureAdminTables(db);
    const body = await request.json() as Record<string, unknown>;
    const t = await upsertAppointmentType(db, { name: body.name as string, description: (body.description as string) ?? null, defaultDuration: (body.defaultDuration as number) ?? 15, color: (body.color as string) ?? '#2196F3', isActive: (body.isActive as boolean) ?? true });
    await logActivity(db, guard.session.sub, 'UPSERT_APPOINTMENT_TYPE', t.id!, { name: t.name });
    return NextResponse.json({ success: true, type: t });
  } catch (err) { return jsonError(err instanceof Error ? err.message : 'Failed', 500); }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;
  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
  try {
    await ensureAdminTables(db);
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return jsonError('id required');
    await deleteAppointmentType(db, id);
    await logActivity(db, guard.session.sub, 'DELETE_APPOINTMENT_TYPE', id);
    return NextResponse.json({ success: true });
  } catch (err) { return jsonError(err instanceof Error ? err.message : 'Failed', 500); }
}
