import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { requirePin } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';

function jsonError(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

// ── POST: Create patient ──
export async function POST(request: NextRequest) {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;
  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
  const gpId = guard.session.sub;

  try {
    const body = await request.json();
    const { name, email, phone, dateOfBirth, notes } = body;
    if (!name) return jsonError('Name is required');

    const result = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO gp_patients (id, gp_id, name, email, phone, date_of_birth, notes)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6) RETURNING id`,
      gpId, name, email ?? null, phone ?? null, dateOfBirth ?? null, notes ?? null,
    );

    return NextResponse.json({ success: true, patient: { id: result[0].id, name, email, phone, dateOfBirth, notes } }, { status: 201 });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed', 500);
  }
}

// ── GET: List patients ──
export async function GET(request: NextRequest) {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;
  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
  const gpId = guard.session.sub;

  try {
    const patients = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, name, email, phone, date_of_birth as "dateOfBirth", notes, health_profile_id as "healthProfileId", created_at as "createdAt"
       FROM gp_patients WHERE gp_id = $1 ORDER BY created_at DESC`,
      gpId,
    );
    return NextResponse.json({ success: true, patients });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed', 500);
  }
}

// ── PATCH: Update/delete ──
export async function PATCH(request: NextRequest) {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;
  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
  const gpId = guard.session.sub;

  try {
    const body = await request.json();
    const { action, patientId, name, email, phone, dateOfBirth, notes } = body;

    if (action === 'update' && patientId) {
      await db.$queryRawUnsafe(
        `UPDATE gp_patients SET name = COALESCE($1, name), email = COALESCE($2, email), phone = COALESCE($3, phone),
         date_of_birth = COALESCE($4, date_of_birth), notes = COALESCE($5, notes), updated_at = NOW()
         WHERE id = $6 AND gp_id = $7`,
        name ?? null, email ?? null, phone ?? null, dateOfBirth ?? null, notes ?? null, patientId, gpId,
      );
      return NextResponse.json({ success: true, message: 'Updated' });
    }

    if (action === 'delete' && patientId) {
      await db.$queryRawUnsafe(`DELETE FROM gp_patients WHERE id = $1 AND gp_id = $2`, patientId, gpId);
      return NextResponse.json({ success: true, message: 'Deleted' });
    }

    return jsonError('Invalid action');
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed', 500);
  }
}
