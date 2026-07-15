import type { DbClient } from '@/lib/db';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CreatePathologyOrderInput {
  healthProfileId: string;
  gpId: string;
  consultationId?: string;
  testName: string;
  testCategory: string;
  clinicalNotes?: string;
  urgency?: string;
  fastingRequired?: boolean;
  labName?: string;
}

export interface PathologyOrder {
  id: string;
  healthProfileId: string;
  gpId: string;
  consultationId: string | null;
  testName: string;
  testCategory: string;
  clinicalNotes: string | null;
  urgency: string;
  fastingRequired: boolean;
  status: string;
  orderedAt: string;
  collectedAt: string | null;
  resultedAt: string | null;
  resultSummary: string | null;
  isAbnormal: boolean | null;
  labName: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const VALID_URGENCIES = new Set(['ROUTINE', 'URGENT', 'STAT']);
const VALID_STATUSES = new Set(['ORDERED', 'COLLECTED', 'PROCESSING', 'RESULTED', 'REVIEWED', 'CANCELLED']);
const VALID_CATEGORIES = new Set([
  'HAEMATOLOGY', 'BIOCHEMISTRY', 'MICROBIOLOGY', 'HISTOPATHOLOGY',
  'IMMUNOLOGY', 'HORMONES', 'GENETICS', 'SEROLOGY',
]);

// ── Helpers ────────────────────────────────────────────────────────────────

function mapOrder(row: Record<string, unknown>): PathologyOrder {
  return {
    id: row.id as string,
    healthProfileId: row.healthProfileId as string,
    gpId: row.gpId as string,
    consultationId: (row.consultationId as string) ?? null,
    testName: row.testName as string,
    testCategory: row.testCategory as string,
    clinicalNotes: (row.clinicalNotes as string) ?? null,
    urgency: row.urgency as string,
    fastingRequired: (row.fastingRequired as boolean) ?? false,
    status: row.status as string,
    orderedAt: (row.orderedAt as Date).toISOString(),
    collectedAt: row.collectedAt ? (row.collectedAt as Date).toISOString() : null,
    resultedAt: row.resultedAt ? (row.resultedAt as Date).toISOString() : null,
    resultSummary: (row.resultSummary as string) ?? null,
    isAbnormal: (row.isAbnormal as boolean | null) ?? null,
    labName: (row.labName as string) ?? null,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function createPathologyOrder(
  db: DbClient,
  data: CreatePathologyOrderInput,
): Promise<PathologyOrder> {
  if (!data.healthProfileId) throw new Error('healthProfileId is required');
  if (!data.gpId) throw new Error('gpId is required');
  if (!data.testName?.trim()) throw new Error('testName is required');

  const category = data.testCategory?.trim().toUpperCase() || 'BIOCHEMISTRY';
  if (!VALID_CATEGORIES.has(category)) {
    throw new Error(`Invalid testCategory: "${data.testCategory}". Valid: ${[...VALID_CATEGORIES].join(', ')}`);
  }

  const urgency = data.urgency?.trim().toUpperCase() || 'ROUTINE';
  if (!VALID_URGENCIES.has(urgency)) {
    throw new Error(`Invalid urgency: "${data.urgency}". Valid: ${[...VALID_URGENCIES].join(', ')}`);
  }

  const record = await db.pathologyOrder.create({
    data: {
      healthProfileId: data.healthProfileId,
      gpId: data.gpId,
      consultationId: data.consultationId ?? null,
      testName: data.testName.trim(),
      testCategory: category,
      clinicalNotes: data.clinicalNotes?.trim() ?? null,
      urgency,
      fastingRequired: data.fastingRequired ?? false,
      labName: data.labName?.trim() ?? null,
      status: 'ORDERED',
    },
  });

  return mapOrder(record as unknown as Record<string, unknown>);
}

export async function getPathologyOrders(
  db: DbClient,
  healthProfileId: string,
  status?: string,
): Promise<PathologyOrder[]> {
  if (!healthProfileId) throw new Error('healthProfileId is required');

  const where: Record<string, unknown> = { healthProfileId };
  if (status && VALID_STATUSES.has(status.toUpperCase())) {
    where.status = status.toUpperCase();
  }

  const records = await db.pathologyOrder.findMany({
    where,
    orderBy: { orderedAt: 'desc' },
  });

  return records.map((r) => mapOrder(r as unknown as Record<string, unknown>));
}

export async function updatePathologyOrderStatus(
  db: DbClient,
  orderId: string,
  status: string,
  resultSummary?: string,
  isAbnormal?: boolean,
): Promise<PathologyOrder> {
  if (!orderId) throw new Error('orderId is required');
  const upperStatus = status.toUpperCase();
  if (!VALID_STATUSES.has(upperStatus)) {
    throw new Error(`Invalid status: "${status}". Valid: ${[...VALID_STATUSES].join(', ')}`);
  }

  const updateData: Record<string, unknown> = { status: upperStatus };
  if (resultSummary !== undefined) updateData.resultSummary = resultSummary;
  if (isAbnormal !== undefined) updateData.isAbnormal = isAbnormal;
  if (upperStatus === 'RESULTED') updateData.resultedAt = new Date();
  if (upperStatus === 'COLLECTED') updateData.collectedAt = new Date();

  const record = await db.pathologyOrder.update({
    where: { id: orderId },
    data: updateData,
  });

  return mapOrder(record as unknown as Record<string, unknown>);
}
