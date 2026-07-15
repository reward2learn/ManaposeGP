import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePin } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import { getPracticeSettings, updatePracticeSettings } from '@/domain/admin/practice-settings-service';
import { logActivity } from '@/domain/admin/activity-log-service';
import { ensureAdminTables } from '@/domain/admin/admin-config-service';

export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  practiceName: z.string().nullable().optional(),
  timezone: z.string().optional(),
  openingHours: z.record(z.object({ open: z.string(), close: z.string() })).optional(),
  defaultAppointmentDuration: z.number().int().min(5).max(120).optional(),
  bulkBillDefault: z.boolean().optional(),
  defaultFeeCents: z.number().int().min(0).optional(),
  autoVerifyGps: z.boolean().optional(),
});

function jsonError(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });

  try {
    await ensureAdminTables(db);
    const settings = await getPracticeSettings(db);
    return NextResponse.json({ success: true, settings });
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

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return jsonError(`Validation: ${parsed.error.issues[0]?.message}`);

  try {
    await ensureAdminTables(db);
    const settings = await updatePracticeSettings(db, parsed.data);
    await logActivity(db, guard.session.sub, 'UPDATE_SETTINGS', 'practice_settings', parsed.data as Record<string, unknown>);
    return NextResponse.json({ success: true, settings });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed', 500);
  }
}
