import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePin } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import {
  createPrescription,
  getPrescriptions,
  updatePrescriptionStatus,
} from '@/domain/health/prescription-service';

export const dynamic = 'force-dynamic';

// ── Zod schemas ───────────────────────────────────────────────────────────

const createPrescriptionBodySchema = z.object({
  healthProfileId: z.string().min(1),
  gpId: z.string().min(1),
  consultationId: z.string().optional(),
  medicationName: z.string().min(1),
  activeIngredient: z.string().optional(),
  strength: z.string().optional(),
  form: z.string().optional(),
  dosage: z.string().min(1),
  frequency: z.string().min(1),
  route: z.string().optional(),
  quantity: z.string().optional(),
  repeats: z.number().int().min(0).optional(),
  authorityRequired: z.boolean().optional(),
  authorityNumber: z.string().optional(),
  instructions: z.string().optional(),
  clinicalNotes: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
});

const updateStatusBodySchema = z.object({
  status: z.enum(['ACTIVE', 'DISCONTINUED', 'COMPLETED', 'EXPIRED']),
});

// ── Helpers ───────────────────────────────────────────────────────────────

function jsonError(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

// ── POST: Create prescription ─────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON body'); }

  const parsed = createPrescriptionBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(`Validation: ${parsed.error.issues.map((i) => i.message).join('; ')}`);
  }

  try {
    const prescription = await createPrescription(db, parsed.data);
    return NextResponse.json({ success: true, prescription });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed to create prescription', 500);
  }
}

// ── GET: List prescriptions ───────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });

  try {
    const url = new URL(request.url);
    const healthProfileId = url.searchParams.get('healthProfileId');
    const status = url.searchParams.get('status') ?? undefined;

    if (!healthProfileId) return jsonError('healthProfileId is required');

    const prescriptions = await getPrescriptions(db, healthProfileId, status);
    return NextResponse.json({ success: true, prescriptions });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed to list prescriptions', 500);
  }
}

// ── PATCH: Update prescription status ─────────────────────────────────────

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });

  try {
    const url = new URL(request.url);
    const prescriptionId = url.searchParams.get('id');
    if (!prescriptionId) return jsonError('id parameter is required');

    let body: unknown;
    try { body = await request.json(); } catch { return jsonError('Invalid JSON body'); }

    const parsed = updateStatusBodySchema.safeParse(body);
    if (!parsed.success) return jsonError(`Invalid status: ${parsed.error.issues[0]?.message}`);

    const prescription = await updatePrescriptionStatus(db, prescriptionId, parsed.data.status);
    return NextResponse.json({ success: true, prescription });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed to update prescription', 500);
  }
}
