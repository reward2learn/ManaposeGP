import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePin } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import {
  createInvoice,
  getInvoices,
  getInvoice,
  createPayment,
  getPayments,
} from '@/domain/health/billing-service';

export const dynamic = 'force-dynamic';

// ── Zod schemas ───────────────────────────────────────────────────────────

const invoiceItemSchema = z.object({
  description: z.string().min(1),
  mbsItem: z.string().optional(),
  feeCents: z.number().int().min(0),
  gstCents: z.number().int().min(0).optional(),
});

const createInvoiceBodySchema = z.object({
  healthProfileId: z.string().min(1),
  gpId: z.string().min(1),
  consultationId: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1),
  notes: z.string().optional(),
  dueDays: z.number().int().min(1).max(90).optional(),
});

const createPaymentBodySchema = z.object({
  invoiceId: z.string().min(1),
  amountCents: z.number().int().min(1),
  method: z.enum(['CASH', 'EFTPOS', 'CREDIT_CARD', 'BANK_TRANSFER', 'MEDICARE', 'PRIVATE_HEALTH', 'BULK_BILL']),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────

function jsonError(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

// ── POST: Create invoice ──────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON body'); }

  // Check if this is a payment creation (has invoiceId + amountCents + method)
  if (typeof body === 'object' && body !== null && 'amountCents' in body && 'method' in body && 'invoiceId' in body) {
    const parsed = createPaymentBodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(`Payment validation: ${parsed.error.issues.map((i) => i.message).join('; ')}`);
    }

    try {
      const payment = await createPayment(db, parsed.data);
      return NextResponse.json({ success: true, payment });
    } catch (err) {
      return jsonError(err instanceof Error ? err.message : 'Failed to create payment', 500);
    }
  }

  // Otherwise, treat as invoice creation
  const parsed = createInvoiceBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(`Invoice validation: ${parsed.error.issues.map((i) => i.message).join('; ')}`);
  }

  try {
    const invoice = await createInvoice(db, parsed.data);
    return NextResponse.json({ success: true, invoice });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed to create invoice', 500);
  }
}

// ── GET: List invoices ────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });

  try {
    const url = new URL(request.url);
    const invoiceId = url.searchParams.get('id');

    // If an invoice ID is provided, return a single invoice with payments
    if (invoiceId) {
      const invoice = await getInvoice(db, invoiceId);
      if (!invoice) return jsonError('Invoice not found', 404);
      return NextResponse.json({ success: true, invoice });
    }

    // Otherwise, list invoices
    const params = {
      healthProfileId: url.searchParams.get('healthProfileId') ?? undefined,
      gpId: url.searchParams.get('gpId') ?? undefined,
      consultationId: url.searchParams.get('consultationId') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
    };

    const invoices = await getInvoices(db, params);
    return NextResponse.json({ success: true, invoices });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed to list invoices', 500);
  }
}
