import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePin } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import { ensurePatientGpColumn, listPatients, assignPatientToGp, unassignPatientFromGp } from '@/domain/admin/patient-service';
import { logActivity } from '@/domain/admin/activity-log-service';

export const dynamic = 'force-dynamic';

const assignSchema = z.object({
  patientId: z.string().min(1),
  gpId: z.string().optional(),
});

function jsonError(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });

  try {
    await ensurePatientGpColumn(db);
    const patients = await listPatients(db);
    return NextResponse.json({ success: true, patients });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed to list patients', 500);
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON'); }

  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) return jsonError(`Validation: ${parsed.error.issues[0]?.message}`);

  try {
    await ensurePatientGpColumn(db);

    if (parsed.data.gpId) {
      await assignPatientToGp(db, parsed.data.patientId, parsed.data.gpId);
      await logActivity(db, guard.session.sub, 'ASSIGN_PATIENT_GP', parsed.data.patientId, { gpId: parsed.data.gpId });
    } else {
      await unassignPatientFromGp(db, parsed.data.patientId);
      await logActivity(db, guard.session.sub, 'UNASSIGN_PATIENT_GP', parsed.data.patientId);
    }

    const patients = await listPatients(db);
    return NextResponse.json({ success: true, patients, message: parsed.data.gpId ? 'Patient assigned to GP' : 'Patient unassigned from GP' });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed to update patient assignment', 500);
  }
}
