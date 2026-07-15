import { NextRequest, NextResponse } from 'next/server';
import { requirePin } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import { getFeeSchedule, upsertFeeScheduleItem, deleteFeeScheduleItem, ensureAdminTables } from '@/domain/admin/admin-config-service';
import { logActivity } from '@/domain/admin/activity-log-service';

export const dynamic = 'force-dynamic';

function jsonError(e: string, s = 400) { return NextResponse.json({ success: false, error: e }, { status: s }); }

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;
  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
  try {
    await ensureAdminTables(db);
    return NextResponse.json({ success: true, items: await getFeeSchedule(db) }); }
  catch (err) { return jsonError(err instanceof Error ? err.message : 'Failed', 500); }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;
  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
  try {
    await ensureAdminTables(db);
    const body = await request.json() as Record<string, unknown>;
    const item = await upsertFeeScheduleItem(db, {
      mbsItemNumber: body.mbsItemNumber as string,
      description: body.description as string,
      category: (body.category as string) ?? 'CONSULTATION',
      scheduleFee: (body.scheduleFee as number) ?? 0,
      practiceFee: (body.practiceFee as number) ?? 0,
      isActive: (body.isActive as boolean) ?? true,
    });
    await logActivity(db, guard.session.sub, 'UPSERT_FEE_ITEM', item.id!, { mbs: item.mbsItemNumber });
    return NextResponse.json({ success: true, item });
  } catch (err) { return jsonError(err instanceof Error ? err.message : 'Failed', 500); }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;
  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return jsonError('id required');
    await deleteFeeScheduleItem(db, id);
    await logActivity(db, guard.session.sub, 'DELETE_FEE_ITEM', id);
    return NextResponse.json({ success: true });
  } catch (err) { return jsonError(err instanceof Error ? err.message : 'Failed', 500); }
}
