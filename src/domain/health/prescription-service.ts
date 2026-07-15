import type { DbClient } from '@/lib/db';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CreatePrescriptionInput {
  healthProfileId: string;
  gpId: string;
  consultationId?: string;
  medicationName: string;
  activeIngredient?: string;
  strength?: string;
  form?: string;
  dosage: string;
  frequency: string;
  route?: string;
  quantity?: string;
  repeats?: number;
  authorityRequired?: boolean;
  authorityNumber?: string;
  instructions?: string;
  clinicalNotes?: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string;
}

export interface Prescription {
  id: string;
  healthProfileId: string;
  gpId: string;
  consultationId: string | null;
  medicationName: string;
  activeIngredient: string | null;
  strength: string | null;
  form: string | null;
  dosage: string;
  frequency: string;
  route: string | null;
  quantity: string | null;
  repeats: number;
  authorityRequired: boolean;
  authorityNumber: string | null;
  instructions: string | null;
  clinicalNotes: string | null;
  startDate: string;
  endDate: string | null;
  status: string;
  dispensedCount: number;
  createdAt: string;
  updatedAt: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const VALID_STATUSES = new Set(['ACTIVE', 'DISCONTINUED', 'COMPLETED', 'EXPIRED']);

// ── Helpers ────────────────────────────────────────────────────────────────

function parseDate(value: string): Date {
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: "${value}"`);
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mapPrescription(row: Record<string, unknown>): Prescription {
  return {
    id: row.id as string,
    healthProfileId: row.healthProfileId as string,
    gpId: row.gpId as string,
    consultationId: (row.consultationId as string) ?? null,
    medicationName: row.medicationName as string,
    activeIngredient: (row.activeIngredient as string) ?? null,
    strength: (row.strength as string) ?? null,
    form: (row.form as string) ?? null,
    dosage: row.dosage as string,
    frequency: row.frequency as string,
    route: (row.route as string) ?? null,
    quantity: (row.quantity as string) ?? null,
    repeats: (row.repeats as number) ?? 0,
    authorityRequired: (row.authorityRequired as boolean) ?? false,
    authorityNumber: (row.authorityNumber as string) ?? null,
    instructions: (row.instructions as string) ?? null,
    clinicalNotes: (row.clinicalNotes as string) ?? null,
    startDate: formatDate(row.startDate as Date),
    endDate: row.endDate ? formatDate(row.endDate as Date) : null,
    status: row.status as string,
    dispensedCount: (row.dispensedCount as number) ?? 0,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function createPrescription(
  db: DbClient,
  data: CreatePrescriptionInput,
): Promise<Prescription> {
  if (!data.healthProfileId) throw new Error('healthProfileId is required');
  if (!data.gpId) throw new Error('gpId is required');
  if (!data.medicationName?.trim()) throw new Error('medicationName is required');
  if (!data.dosage?.trim()) throw new Error('dosage is required');
  if (!data.frequency?.trim()) throw new Error('frequency is required');
  if (!data.startDate) throw new Error('startDate is required');

  const record = await db.prescription.create({
    data: {
      healthProfileId: data.healthProfileId,
      gpId: data.gpId,
      consultationId: data.consultationId ?? null,
      medicationName: data.medicationName.trim(),
      activeIngredient: data.activeIngredient?.trim() ?? null,
      strength: data.strength?.trim() ?? null,
      form: data.form?.trim() ?? null,
      dosage: data.dosage.trim(),
      frequency: data.frequency.trim(),
      route: data.route?.trim() ?? null,
      quantity: data.quantity?.trim() ?? null,
      repeats: data.repeats ?? 0,
      authorityRequired: data.authorityRequired ?? false,
      authorityNumber: data.authorityNumber?.trim() ?? null,
      instructions: data.instructions?.trim() ?? null,
      clinicalNotes: data.clinicalNotes?.trim() ?? null,
      startDate: parseDate(data.startDate),
      endDate: data.endDate ? parseDate(data.endDate) : null,
      status: 'ACTIVE',
    },
  });

  return mapPrescription(record as unknown as Record<string, unknown>);
}

export async function getPrescriptions(
  db: DbClient,
  healthProfileId: string,
  status?: string,
): Promise<Prescription[]> {
  if (!healthProfileId) throw new Error('healthProfileId is required');

  const where: Record<string, unknown> = { healthProfileId };
  if (status && VALID_STATUSES.has(status)) {
    where.status = status;
  }

  const records = await db.prescription.findMany({
    where,
    orderBy: { startDate: 'desc' },
  });

  return records.map((r) => mapPrescription(r as unknown as Record<string, unknown>));
}

export async function getPrescriptionsByConsultation(
  db: DbClient,
  consultationId: string,
): Promise<Prescription[]> {
  if (!consultationId) throw new Error('consultationId is required');

  const records = await db.prescription.findMany({
    where: { consultationId },
    orderBy: { medicationName: 'asc' },
  });

  return records.map((r) => mapPrescription(r as unknown as Record<string, unknown>));
}

export async function updatePrescriptionStatus(
  db: DbClient,
  prescriptionId: string,
  status: string,
): Promise<Prescription> {
  if (!prescriptionId) throw new Error('prescriptionId is required');
  const upperStatus = status.toUpperCase();
  if (!VALID_STATUSES.has(upperStatus)) {
    throw new Error(`Invalid status: "${status}". Valid: ${[...VALID_STATUSES].join(', ')}`);
  }

  const record = await db.prescription.update({
    where: { id: prescriptionId },
    data: { status: upperStatus },
  });

  return mapPrescription(record as unknown as Record<string, unknown>);
}
