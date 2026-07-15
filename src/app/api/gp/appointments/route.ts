import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePin } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import {
  createAppointment,
  getAppointments,
  updateAppointmentStatus,
} from '@/domain/health/appointment-service';

export const dynamic = 'force-dynamic';

// ── Zod schemas ───────────────────────────────────────────────────────────

const createAppointmentBodySchema = z.object({
  healthProfileId: z.string().min(1),
  gpId: z.string().min(1),
  date: z.string().min(1),
  timeSlot: z.string().min(1),
  durationMinutes: z.number().int().min(5).max(120).optional(),
  type: z.enum(['IN_PERSON', 'TELEHEALTH', 'PHONE']).optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

const updateStatusBodySchema = z.object({
  status: z.enum(['BOOKED', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']),
  consultationId: z.string().optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────

function jsonError(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

// ── POST: Create appointment ──────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON body'); }

  const parsed = createAppointmentBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(`Validation: ${parsed.error.issues.map((i) => i.message).join('; ')}`);
  }

  try {
    const appointment = await createAppointment(db, parsed.data);
    return NextResponse.json({ success: true, appointment });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed to create appointment', 500);
  }
}

// ── GET: List appointments ────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });

  try {
    const url = new URL(request.url);
    const params = {
      gpId: url.searchParams.get('gpId') ?? undefined,
      healthProfileId: url.searchParams.get('healthProfileId') ?? undefined,
      fromDate: url.searchParams.get('from') ?? undefined,
      toDate: url.searchParams.get('to') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
    };

    const appointments = await getAppointments(db, params);
    return NextResponse.json({ success: true, appointments });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed to list appointments', 500);
  }
}

// ── PATCH: Update appointment status ──────────────────────────────────────

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });

  try {
    const url = new URL(request.url);
    const appointmentId = url.searchParams.get('id');
    if (!appointmentId) return jsonError('id parameter is required');

    let body: unknown;
    try { body = await request.json(); } catch { return jsonError('Invalid JSON body'); }

    const parsed = updateStatusBodySchema.safeParse(body);
    if (!parsed.success) return jsonError(`Validation: ${parsed.error.issues[0]?.message}`);

    const appointment = await updateAppointmentStatus(
      db,
      appointmentId,
      parsed.data.status,
      parsed.data.consultationId,
    );
    return NextResponse.json({ success: true, appointment });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed to update appointment', 500);
  }
}
