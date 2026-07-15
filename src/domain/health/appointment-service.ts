import type { DbClient } from '@/lib/db';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CreateAppointmentInput {
  healthProfileId: string;
  gpId: string;
  date: string; // YYYY-MM-DD
  timeSlot: string; // "09:00", "09:30"
  durationMinutes?: number;
  type?: string;
  reason?: string;
  notes?: string;
}

export interface Appointment {
  id: string;
  healthProfileId: string;
  gpId: string;
  date: string;
  timeSlot: string;
  durationMinutes: number;
  type: string;
  status: string;
  reason: string | null;
  notes: string | null;
  consultationId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const VALID_TYPES = new Set(['IN_PERSON', 'TELEHEALTH', 'PHONE']);
const VALID_STATUSES = new Set(['BOOKED', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']);

// ── Helpers ────────────────────────────────────────────────────────────────

function parseDate(value: string): Date {
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: "${value}"`);
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mapAppointment(row: Record<string, unknown>): Appointment {
  return {
    id: row.id as string,
    healthProfileId: row.healthProfileId as string,
    gpId: row.gpId as string,
    date: formatDate(row.date as Date),
    timeSlot: row.timeSlot as string,
    durationMinutes: (row.durationMinutes as number) ?? 15,
    type: row.type as string,
    status: row.status as string,
    reason: (row.reason as string) ?? null,
    notes: (row.notes as string) ?? null,
    consultationId: (row.consultationId as string) ?? null,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function createAppointment(
  db: DbClient,
  data: CreateAppointmentInput,
): Promise<Appointment> {
  if (!data.healthProfileId) throw new Error('healthProfileId is required');
  if (!data.gpId) throw new Error('gpId is required');
  if (!data.date) throw new Error('date is required');
  if (!data.timeSlot?.trim()) throw new Error('timeSlot is required');

  const type = data.type?.trim().toUpperCase() || 'IN_PERSON';
  if (!VALID_TYPES.has(type)) {
    throw new Error(`Invalid type: "${data.type}". Valid: ${[...VALID_TYPES].join(', ')}`);
  }

  const record = await db.appointment.create({
    data: {
      healthProfileId: data.healthProfileId,
      gpId: data.gpId,
      date: parseDate(data.date),
      timeSlot: data.timeSlot.trim(),
      durationMinutes: data.durationMinutes ?? 15,
      type,
      reason: data.reason?.trim() ?? null,
      notes: data.notes?.trim() ?? null,
      status: 'BOOKED',
    },
  });

  return mapAppointment(record as unknown as Record<string, unknown>);
}

export async function getAppointments(
  db: DbClient,
  params: {
    gpId?: string;
    healthProfileId?: string;
    fromDate?: string;
    toDate?: string;
    status?: string;
  },
): Promise<Appointment[]> {
  const where: Record<string, unknown> = {};

  if (params.gpId) where.gpId = params.gpId;
  if (params.healthProfileId) where.healthProfileId = params.healthProfileId;

  if (params.fromDate || params.toDate) {
    const dateFilter: Record<string, Date> = {};
    if (params.fromDate) dateFilter.gte = parseDate(params.fromDate);
    if (params.toDate) dateFilter.lte = parseDate(params.toDate);
    where.date = dateFilter;
  }

  if (params.status && VALID_STATUSES.has(params.status.toUpperCase())) {
    where.status = params.status.toUpperCase();
  }

  const records = await db.appointment.findMany({
    where,
    orderBy: [{ date: 'asc' }, { timeSlot: 'asc' }],
  });

  return records.map((r) => mapAppointment(r as unknown as Record<string, unknown>));
}

export async function updateAppointmentStatus(
  db: DbClient,
  appointmentId: string,
  status: string,
  consultationId?: string,
): Promise<Appointment> {
  if (!appointmentId) throw new Error('appointmentId is required');
  const upperStatus = status.toUpperCase();
  if (!VALID_STATUSES.has(upperStatus)) {
    throw new Error(`Invalid status: "${status}". Valid: ${[...VALID_STATUSES].join(', ')}`);
  }

  const updateData: Record<string, unknown> = { status: upperStatus };
  if (consultationId) updateData.consultationId = consultationId;

  const record = await db.appointment.update({
    where: { id: appointmentId },
    data: updateData,
  });

  return mapAppointment(record as unknown as Record<string, unknown>);
}
