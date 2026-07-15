import type { DbClient } from '@/lib/db';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CreateInvoiceInput {
  healthProfileId: string;
  gpId: string;
  consultationId?: string;
  items: InvoiceItem[];
  notes?: string;
  dueDays?: number; // days from today for due date
}

export interface InvoiceItem {
  description: string;
  mbsItem?: string;
  feeCents: number; // in cents (AUD)
  gstCents?: number;
}

export interface Invoice {
  id: string;
  healthProfileId: string;
  gpId: string;
  consultationId: string | null;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  items: InvoiceItem[];
  subtotalCents: number;
  gstCents: number;
  totalCents: number;
  status: string;
  notes: string | null;
  paidAmountCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentInput {
  invoiceId: string;
  amountCents: number;
  method: string;
  reference?: string;
  notes?: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amountCents: number;
  method: string;
  reference: string | null;
  paidAt: string;
  notes: string | null;
  createdAt: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const VALID_INVOICE_STATUSES = new Set(['DRAFT', 'ISSUED', 'PAID', 'PARTIALLY_PAID', 'VOID', 'WRITTEN_OFF']);
const VALID_PAYMENT_METHODS = new Set(['CASH', 'EFTPOS', 'CREDIT_CARD', 'BANK_TRANSFER', 'MEDICARE', 'PRIVATE_HEALTH', 'BULK_BILL']);

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function generateInvoiceNumber(dbCounter: number): string {
  const year = new Date().getFullYear();
  return `INV-${year}-${String(dbCounter).padStart(5, '0')}`;
}

function mapInvoice(row: Record<string, unknown>, paidAmountCents = 0): Invoice {
  return {
    id: row.id as string,
    healthProfileId: row.healthProfileId as string,
    gpId: row.gpId as string,
    consultationId: (row.consultationId as string) ?? null,
    invoiceNumber: row.invoiceNumber as string,
    issueDate: formatDate(row.issueDate as Date),
    dueDate: formatDate(row.dueDate as Date),
    items: (row.items as InvoiceItem[]) ?? [],
    subtotalCents: row.subtotalCents as number,
    gstCents: (row.gstCents as number) ?? 0,
    totalCents: row.totalCents as number,
    status: row.status as string,
    notes: (row.notes as string) ?? null,
    paidAmountCents,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

function mapPayment(row: Record<string, unknown>): Payment {
  return {
    id: row.id as string,
    invoiceId: row.invoiceId as string,
    amountCents: row.amountCents as number,
    method: row.method as string,
    reference: (row.reference as string) ?? null,
    paidAt: (row.paidAt as Date).toISOString(),
    notes: (row.notes as string) ?? null,
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

// ── Computations ───────────────────────────────────────────────────────────

function computeTotals(items: InvoiceItem[]) {
  const subtotalCents = items.reduce((sum, item) => sum + item.feeCents, 0);
  const gstCents = items.reduce((sum, item) => sum + (item.gstCents ?? 0), 0);
  return { subtotalCents, gstCents, totalCents: subtotalCents + gstCents };
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function createInvoice(
  db: DbClient,
  data: CreateInvoiceInput,
): Promise<Invoice> {
  if (!data.healthProfileId) throw new Error('healthProfileId is required');
  if (!data.gpId) throw new Error('gpId is required');
  if (!data.items || data.items.length === 0) throw new Error('At least one invoice item is required');

  const { subtotalCents, gstCents, totalCents } = computeTotals(data.items);

  // Generate sequential invoice number
  const count = await db.invoice.count();
  const invoiceNumber = generateInvoiceNumber(count + 1);

  const dueDays = data.dueDays ?? 14;
  const issueDate = new Date();
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + dueDays);

  const record = await db.invoice.create({
    data: {
      healthProfileId: data.healthProfileId,
      gpId: data.gpId,
      consultationId: data.consultationId ?? null,
      invoiceNumber,
      issueDate,
      dueDate,
      items: data.items as unknown as Parameters<typeof db.invoice.create>[0]['data']['items'],
      subtotalCents,
      gstCents,
      totalCents,
      status: 'ISSUED',
      notes: data.notes?.trim() ?? null,
    },
  });

  return mapInvoice(record as unknown as Record<string, unknown>, 0);
}

export async function getInvoices(
  db: DbClient,
  params: {
    healthProfileId?: string;
    gpId?: string;
    consultationId?: string;
    status?: string;
  },
): Promise<Invoice[]> {
  const where: Record<string, unknown> = {};

  if (params.healthProfileId) where.healthProfileId = params.healthProfileId;
  if (params.gpId) where.gpId = params.gpId;
  if (params.consultationId) where.consultationId = params.consultationId;
  if (params.status && VALID_INVOICE_STATUSES.has(params.status.toUpperCase())) {
    where.status = params.status.toUpperCase();
  }

  const records = await db.invoice.findMany({
    where,
    include: { payments: true },
    orderBy: { issueDate: 'desc' },
  });

  return records.map((r: Record<string, unknown> & { payments?: Array<Record<string, unknown>> }) => {
    const payments = r.payments ?? [];
    const paidAmountCents = payments.reduce(
      (sum: number, p: Record<string, unknown>) => sum + ((p.amountCents as number) ?? 0),
      0,
    );
    return mapInvoice(r, paidAmountCents);
  });
}

export async function getInvoice(
  db: DbClient,
  invoiceId: string,
): Promise<Invoice | null> {
  if (!invoiceId) throw new Error('invoiceId is required');

  const record = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true },
  });

  if (!record) return null;

  const r = record as Record<string, unknown> & { payments?: Array<Record<string, unknown>> };
  const payments = r.payments ?? [];
  const paidAmountCents = payments.reduce(
    (sum: number, p: Record<string, unknown>) => sum + ((p.amountCents as number) ?? 0),
    0,
  );

  return mapInvoice(r, paidAmountCents);
}

export async function createPayment(
  db: DbClient,
  data: CreatePaymentInput,
): Promise<Payment> {
  if (!data.invoiceId) throw new Error('invoiceId is required');
  if (!data.amountCents || data.amountCents <= 0) throw new Error('amountCents must be positive');

  const method = data.method?.trim().toUpperCase() || '';
  if (!method || !VALID_PAYMENT_METHODS.has(method)) {
    throw new Error(`Invalid payment method: "${data.method}". Valid: ${[...VALID_PAYMENT_METHODS].join(', ')}`);
  }

  const record = await db.payment.create({
    data: {
      invoiceId: data.invoiceId,
      amountCents: data.amountCents,
      method,
      reference: data.reference?.trim() ?? null,
      notes: data.notes?.trim() ?? null,
    },
  });

  // Update invoice status based on payments
  const invoice = await getInvoice(db, data.invoiceId);
  if (invoice) {
    if (invoice.paidAmountCents >= invoice.totalCents) {
      await db.invoice.update({
        where: { id: data.invoiceId },
        data: { status: 'PAID' },
      });
    } else if (invoice.paidAmountCents > 0) {
      await db.invoice.update({
        where: { id: data.invoiceId },
        data: { status: 'PARTIALLY_PAID' },
      });
    }
  }

  return mapPayment(record as unknown as Record<string, unknown>);
}

export async function getPayments(
  db: DbClient,
  invoiceId: string,
): Promise<Payment[]> {
  if (!invoiceId) throw new Error('invoiceId is required');

  const records = await db.payment.findMany({
    where: { invoiceId },
    orderBy: { paidAt: 'desc' },
  });

  return records.map((r) => mapPayment(r as unknown as Record<string, unknown>));
}
