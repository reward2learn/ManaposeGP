import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePin } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import {
  createRadiologyOrder,
  getRadiologyOrders,
  updateRadiologyOrderStatus,
} from '@/domain/health/radiology-order-service';

export const dynamic = 'force-dynamic';

// ── Zod schemas ───────────────────────────────────────────────────────────

const createRadiologyOrderBodySchema = z.object({
  healthProfileId: z.string().min(1),
  gpId: z.string().min(1),
  consultationId: z.string().optional(),
  imagingType: z.enum(['XRAY', 'ULTRASOUND', 'CT', 'MRI', 'MAMMOGRAM', 'DEXA', 'NUCLEAR_MEDICINE', 'BONE_DENSITY']),
  bodyRegion: z.enum(['HEAD', 'CHEST', 'ABDOMEN', 'SPINE', 'PELVIS', 'UPPER_LIMB', 'LOWER_LIMB', 'BREAST', 'WHOLE_BODY']),
  clinicalNotes: z.string().optional(),
  urgency: z.enum(['ROUTINE', 'URGENT', 'STAT']).optional(),
  contrastRequired: z.boolean().optional(),
  imagingCenter: z.string().optional(),
});

const updateStatusBodySchema = z.object({
  status: z.enum(['ORDERED', 'SCHEDULED', 'COMPLETED', 'REPORTED', 'REVIEWED', 'CANCELLED']),
  reportSummary: z.string().optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────

function jsonError(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

// ── POST: Create radiology order ──────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON body'); }

  const parsed = createRadiologyOrderBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(`Validation: ${parsed.error.issues.map((i) => i.message).join('; ')}`);
  }

  try {
    const order = await createRadiologyOrder(db, parsed.data);
    return NextResponse.json({ success: true, order });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed to create radiology order', 500);
  }
}

// ── GET: List radiology orders ────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });

  try {
    const url = new URL(request.url);
    const healthProfileId = url.searchParams.get('healthProfileId');
    const status = url.searchParams.get('status') ?? undefined;

    if (!healthProfileId) return jsonError('healthProfileId is required');

    const orders = await getRadiologyOrders(db, healthProfileId, status);
    return NextResponse.json({ success: true, orders });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed to list radiology orders', 500);
  }
}

// ── PATCH: Update radiology order status ──────────────────────────────────

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });

  try {
    const url = new URL(request.url);
    const orderId = url.searchParams.get('id');
    if (!orderId) return jsonError('id parameter is required');

    let body: unknown;
    try { body = await request.json(); } catch { return jsonError('Invalid JSON body'); }

    const parsed = updateStatusBodySchema.safeParse(body);
    if (!parsed.success) return jsonError(`Validation: ${parsed.error.issues[0]?.message}`);

    const order = await updateRadiologyOrderStatus(db, orderId, parsed.data.status, parsed.data.reportSummary);
    return NextResponse.json({ success: true, order });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed to update radiology order', 500);
  }
}
