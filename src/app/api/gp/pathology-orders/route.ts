import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePin } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import {
  createPathologyOrder,
  getPathologyOrders,
  updatePathologyOrderStatus,
} from '@/domain/health/pathology-order-service';

export const dynamic = 'force-dynamic';

// ── Zod schemas ───────────────────────────────────────────────────────────

const createPathologyOrderBodySchema = z.object({
  healthProfileId: z.string().min(1),
  gpId: z.string().min(1),
  consultationId: z.string().optional(),
  testName: z.string().min(1),
  testCategory: z.string().min(1),
  clinicalNotes: z.string().optional(),
  urgency: z.enum(['ROUTINE', 'URGENT', 'STAT']).optional(),
  fastingRequired: z.boolean().optional(),
  labName: z.string().optional(),
});

const updateStatusBodySchema = z.object({
  status: z.enum(['ORDERED', 'COLLECTED', 'PROCESSING', 'RESULTED', 'REVIEWED', 'CANCELLED']),
  resultSummary: z.string().optional(),
  isAbnormal: z.boolean().optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────

function jsonError(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

// ── POST: Create pathology order ──────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON body'); }

  const parsed = createPathologyOrderBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(`Validation: ${parsed.error.issues.map((i) => i.message).join('; ')}`);
  }

  try {
    const order = await createPathologyOrder(db, parsed.data);
    return NextResponse.json({ success: true, order });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed to create pathology order', 500);
  }
}

// ── GET: List pathology orders ────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });

  try {
    const url = new URL(request.url);
    const healthProfileId = url.searchParams.get('healthProfileId');
    const status = url.searchParams.get('status') ?? undefined;

    if (!healthProfileId) return jsonError('healthProfileId is required');

    const orders = await getPathologyOrders(db, healthProfileId, status);
    return NextResponse.json({ success: true, orders });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed to list pathology orders', 500);
  }
}

// ── PATCH: Update pathology order status ──────────────────────────────────

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

    const order = await updatePathologyOrderStatus(
      db,
      orderId,
      parsed.data.status,
      parsed.data.resultSummary,
      parsed.data.isAbnormal,
    );
    return NextResponse.json({ success: true, order });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed to update pathology order', 500);
  }
}
