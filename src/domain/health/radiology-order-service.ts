import type { DbClient } from '@/lib/db';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CreateRadiologyOrderInput {
  healthProfileId: string;
  gpId: string;
  consultationId?: string;
  imagingType: string;
  bodyRegion: string;
  clinicalNotes?: string;
  urgency?: string;
  contrastRequired?: boolean;
  imagingCenter?: string;
}

export interface RadiologyOrder {
  id: string;
  healthProfileId: string;
  gpId: string;
  consultationId: string | null;
  imagingType: string;
  bodyRegion: string;
  clinicalNotes: string | null;
  urgency: string;
  contrastRequired: boolean;
  status: string;
  orderedAt: string;
  scheduledAt: string | null;
  completedAt: string | null;
  reportSummary: string | null;
  imagingCenter: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const VALID_URGENCIES = new Set(['ROUTINE', 'URGENT', 'STAT']);
const VALID_STATUSES = new Set(['ORDERED', 'SCHEDULED', 'COMPLETED', 'REPORTED', 'REVIEWED', 'CANCELLED']);
const VALID_IMAGING_TYPES = new Set([
  'XRAY', 'ULTRASOUND', 'CT', 'MRI', 'MAMMOGRAM', 'DEXA', 'NUCLEAR_MEDICINE', 'BONE_DENSITY',
]);
const VALID_BODY_REGIONS = new Set([
  'HEAD', 'CHEST', 'ABDOMEN', 'SPINE', 'PELVIS', 'UPPER_LIMB', 'LOWER_LIMB', 'BREAST', 'WHOLE_BODY',
]);

// ── Helpers ────────────────────────────────────────────────────────────────

function mapOrder(row: Record<string, unknown>): RadiologyOrder {
  return {
    id: row.id as string,
    healthProfileId: row.healthProfileId as string,
    gpId: row.gpId as string,
    consultationId: (row.consultationId as string) ?? null,
    imagingType: row.imagingType as string,
    bodyRegion: row.bodyRegion as string,
    clinicalNotes: (row.clinicalNotes as string) ?? null,
    urgency: row.urgency as string,
    contrastRequired: (row.contrastRequired as boolean) ?? false,
    status: row.status as string,
    orderedAt: (row.orderedAt as Date).toISOString(),
    scheduledAt: row.scheduledAt ? (row.scheduledAt as Date).toISOString() : null,
    completedAt: row.completedAt ? (row.completedAt as Date).toISOString() : null,
    reportSummary: (row.reportSummary as string) ?? null,
    imagingCenter: (row.imagingCenter as string) ?? null,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function createRadiologyOrder(
  db: DbClient,
  data: CreateRadiologyOrderInput,
): Promise<RadiologyOrder> {
  if (!data.healthProfileId) throw new Error('healthProfileId is required');
  if (!data.gpId) throw new Error('gpId is required');

  const imagingType = data.imagingType?.trim().toUpperCase() || '';
  if (!imagingType || !VALID_IMAGING_TYPES.has(imagingType)) {
    throw new Error(`Invalid imagingType: "${data.imagingType}". Valid: ${[...VALID_IMAGING_TYPES].join(', ')}`);
  }

  const bodyRegion = data.bodyRegion?.trim().toUpperCase() || '';
  if (!bodyRegion || !VALID_BODY_REGIONS.has(bodyRegion)) {
    throw new Error(`Invalid bodyRegion: "${data.bodyRegion}". Valid: ${[...VALID_BODY_REGIONS].join(', ')}`);
  }

  const urgency = data.urgency?.trim().toUpperCase() || 'ROUTINE';
  if (!VALID_URGENCIES.has(urgency)) {
    throw new Error(`Invalid urgency: "${data.urgency}". Valid: ${[...VALID_URGENCIES].join(', ')}`);
  }

  const record = await db.radiologyOrder.create({
    data: {
      healthProfileId: data.healthProfileId,
      gpId: data.gpId,
      consultationId: data.consultationId ?? null,
      imagingType,
      bodyRegion,
      clinicalNotes: data.clinicalNotes?.trim() ?? null,
      urgency,
      contrastRequired: data.contrastRequired ?? false,
      imagingCenter: data.imagingCenter?.trim() ?? null,
      status: 'ORDERED',
    },
  });

  return mapOrder(record as unknown as Record<string, unknown>);
}

export async function getRadiologyOrders(
  db: DbClient,
  healthProfileId: string,
  status?: string,
): Promise<RadiologyOrder[]> {
  if (!healthProfileId) throw new Error('healthProfileId is required');

  const where: Record<string, unknown> = { healthProfileId };
  if (status && VALID_STATUSES.has(status.toUpperCase())) {
    where.status = status.toUpperCase();
  }

  const records = await db.radiologyOrder.findMany({
    where,
    orderBy: { orderedAt: 'desc' },
  });

  return records.map((r) => mapOrder(r as unknown as Record<string, unknown>));
}

export async function updateRadiologyOrderStatus(
  db: DbClient,
  orderId: string,
  status: string,
  reportSummary?: string,
): Promise<RadiologyOrder> {
  if (!orderId) throw new Error('orderId is required');
  const upperStatus = status.toUpperCase();
  if (!VALID_STATUSES.has(upperStatus)) {
    throw new Error(`Invalid status: "${status}". Valid: ${[...VALID_STATUSES].join(', ')}`);
  }

  const updateData: Record<string, unknown> = { status: upperStatus };
  if (reportSummary !== undefined) updateData.reportSummary = reportSummary;
  if (upperStatus === 'COMPLETED') updateData.completedAt = new Date();
  if (upperStatus === 'SCHEDULED' && !updateData.scheduledAt) {
    // scheduledAt should be set explicitly, but default to now if transitioning
  }

  const record = await db.radiologyOrder.update({
    where: { id: orderId },
    data: updateData,
  });

  return mapOrder(record as unknown as Record<string, unknown>);
}
