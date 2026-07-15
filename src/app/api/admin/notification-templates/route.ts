import { NextRequest, NextResponse } from 'next/server';
import { requirePin } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import { getNotificationTemplates, upsertNotificationTemplate, ensureAdminTables } from '@/domain/admin/admin-config-service';
import { logActivity } from '@/domain/admin/activity-log-service';

export const dynamic = 'force-dynamic';
function jsonError(e: string, s = 400) { return NextResponse.json({ success: false, error: e }, { status: s }); }

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;
  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
  try {
    await ensureAdminTables(db);
    return NextResponse.json({ success: true, templates: await getNotificationTemplates(db) }); }
  catch (err) { return jsonError(err instanceof Error ? err.message : 'Failed', 500); }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;
  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
  try {
    await ensureAdminTables(db);
    const body = await request.json() as Record<string, unknown>;
    const t = await upsertNotificationTemplate(db, {
      templateType: body.templateType as string, subject: body.subject as string,
      bodyTemplate: body.bodyTemplate as string, channel: (body.channel as string) ?? 'EMAIL',
      isActive: (body.isActive as boolean) ?? true,
    });
    await logActivity(db, guard.session.sub, 'UPSERT_NOTIFICATION_TEMPLATE', t.id!);
    return NextResponse.json({ success: true, template: t });
  } catch (err) { return jsonError(err instanceof Error ? err.message : 'Failed', 500); }
}
