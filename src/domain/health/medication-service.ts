import type { DbClient } from '@/lib/db';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AddMedicationInput {
  name: string;
  type: string;
  dosage: string;
  frequency: string;
  route?: string;
  startDate: string;
  endDate?: string;
  prescribedBy?: string;
  notes?: string;
}

export interface Medication {
  id: string;
  name: string;
  type: string;
  dosage: string;
  frequency: string;
  route?: string;
  startDate: string;
  endDate?: string;
  status: string;
  prescribedBy?: string;
  notes?: string;
  adherenceLog: AdherenceEntry[];
}

export interface AdherenceEntry {
  date: string;
  taken: boolean;
  timestamp: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const VALID_TYPES = new Set(['mht', 'supplement', 'prescription', 'otc']);

const VALID_STATUSES = new Set([
  'ACTIVE',
  'DISCONTINUED',
  'PAUSED',
  'COMPLETED',
]);

const VALID_ROUTES = new Set([
  'oral',
  'transdermal',
  'vaginal',
  'injection',
  'implant',
]);

const DEFAULT_ACTIVE_STATUSES = ['ACTIVE', 'PAUSED'];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Parses a YYYY-MM-DD string to a Date. Throws on invalid input. */
function parseDateString(value: string): Date {
  if (!value || typeof value !== 'string') {
    throw new Error(`Invalid date: "${value}"`);
  }

  const trimmed = value.trim();
  const date = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: "${trimmed}"`);
  }

  return date;
}

/** Formats a Date as YYYY-MM-DD. */
function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Returns today's date as YYYY-MM-DD. */
function todayString(): string {
  return formatDate(new Date());
}

/**
 * Maps a raw medication row from the database (with `Date` fields) to the
 * domain `Medication` interface (with `string` dates and typed `adherenceLog`).
 */
function mapMedication(row: {
  id: string;
  name: string;
  type: string;
  dosage: string;
  frequency: string;
  route: string | null;
  startDate: Date;
  endDate: Date | null;
  status: string;
  prescribedBy: string | null;
  notes: string | null;
  adherenceLog: unknown;
}): Medication {
  const log = Array.isArray(row.adherenceLog) ? row.adherenceLog : [];

  return {
    id: row.id,
    name: row.name,
    type: row.type,
    dosage: row.dosage,
    frequency: row.frequency,
    route: row.route ?? undefined,
    startDate: formatDate(row.startDate),
    endDate: row.endDate ? formatDate(row.endDate) : undefined,
    status: row.status,
    prescribedBy: row.prescribedBy ?? undefined,
    notes: row.notes ?? undefined,
    adherenceLog: log as AdherenceEntry[],
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Adds a new medication to the health profile's medication list.
 *
 * Validates required fields and enumerated values before creating the record.
 *
 * @param db         Database client
 * @param profileId  The `health_profiles.id`
 * @param data       Medication input data
 * @returns          The created medication (domain representation)
 */
export async function addMedication(
  db: DbClient,
  profileId: string,
  data: AddMedicationInput,
): Promise<Medication> {
  if (!profileId || typeof profileId !== 'string') {
    throw new Error('profileId is required');
  }

  // ── Validate required fields ─────────────────────────────────────────
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    throw new Error('name is required');
  }

  if (!data.dosage || typeof data.dosage !== 'string' || !data.dosage.trim()) {
    throw new Error('dosage is required');
  }

  if (
    !data.frequency ||
    typeof data.frequency !== 'string' ||
    !data.frequency.trim()
  ) {
    throw new Error('frequency is required');
  }

  if (!data.startDate) {
    throw new Error('startDate is required');
  }

  // ── Validate enumerated values ───────────────────────────────────────
  const type = data.type?.trim().toLowerCase();
  if (!type || !VALID_TYPES.has(type)) {
    throw new Error(
      `Invalid type "${data.type}". Valid values: ${[...VALID_TYPES].join(', ')}`,
    );
  }

  if (data.route !== undefined && data.route !== null) {
    const route = data.route.trim().toLowerCase();
    if (route && !VALID_ROUTES.has(route)) {
      throw new Error(
        `Invalid route "${data.route}". Valid values: ${[...VALID_ROUTES].join(', ')}`,
      );
    }
  }

  // ── Build create payload ─────────────────────────────────────────────
  const createData: Record<string, unknown> = {
    healthProfileId: profileId,
    name: data.name.trim(),
    type,
    dosage: data.dosage.trim(),
    frequency: data.frequency.trim(),
    startDate: parseDateString(data.startDate),
    status: 'ACTIVE',
  };

  if (data.route?.trim()) {
    createData.route = data.route.trim().toLowerCase();
  }

  if (data.endDate) {
    createData.endDate = parseDateString(data.endDate);
  }

  if (data.prescribedBy?.trim()) {
    createData.prescribedBy = data.prescribedBy.trim();
  }

  if (data.notes?.trim()) {
    createData.notes = data.notes.trim();
  }

  const record = await db.medication.create({
    data: createData as Parameters<typeof db.medication.create>[0]['data'],
  });

  return mapMedication(record as Parameters<typeof mapMedication>[0]);
}

/**
 * Returns medications for a health profile, optionally filtered by status.
 *
 * By default, returns medications with status ACTIVE or PAUSED, ordered by
 * `startDate` descending (newest first).
 *
 * @param db         Database client
 * @param profileId  The `health_profiles.id`
 * @param status     Optional status to filter by (overrides the default)
 * @returns          Array of medications (domain representation)
 */
export async function getMedications(
  db: DbClient,
  profileId: string,
  status?: string,
): Promise<Medication[]> {
  if (!profileId || typeof profileId !== 'string') {
    throw new Error('profileId is required');
  }

  const where: Record<string, unknown> = {
    healthProfileId: profileId,
  };

  if (status) {
    if (!VALID_STATUSES.has(status)) {
      throw new Error(
        `Invalid status "${status}". Valid values: ${[...VALID_STATUSES].join(', ')}`,
      );
    }
    where.status = status;
  } else {
    where.status = { in: DEFAULT_ACTIVE_STATUSES };
  }

  const records = await db.medication.findMany({
    where,
    orderBy: { startDate: 'desc' },
  });

  return records.map((r) =>
    mapMedication(r as Parameters<typeof mapMedication>[0]),
  );
}

/**
 * Updates the status of a medication.
 *
 * If the new status is DISCONTINUED, the `endDate` is automatically set
 * to today's date.
 *
 * @param db            Database client
 * @param medicationId  The medication's ID
 * @param status        New status (ACTIVE / DISCONTINUED / PAUSED / COMPLETED)
 * @returns             The updated medication (domain representation)
 */
export async function updateMedicationStatus(
  db: DbClient,
  medicationId: string,
  status: string,
): Promise<Medication> {
  if (!medicationId || typeof medicationId !== 'string') {
    throw new Error('medicationId is required');
  }

  if (!status || !VALID_STATUSES.has(status)) {
    throw new Error(
      `Invalid status "${status}". Valid values: ${[...VALID_STATUSES].join(', ')}`,
    );
  }

  const updateData: Record<string, unknown> = {
    status,
  };

  // When discontinuing, set endDate to today
  if (status === 'DISCONTINUED') {
    updateData.endDate = parseDateString(todayString());
  }

  const record = await db.medication.update({
    where: { id: medicationId },
    data: updateData as Parameters<typeof db.medication.update>[0]['data'],
  });

  return mapMedication(record as Parameters<typeof mapMedication>[0]);
}

/**
 * Logs an adherence event for a medication.
 *
 * Appends `{ date, taken, timestamp }` to the `adherenceLog` JSONB column.
 *
 * @param db            Database client
 * @param medicationId  The medication's ID
 * @param date          The date of the dose (YYYY-MM-DD)
 * @param taken         Whether the dose was taken
 * @returns             The updated medication (domain representation)
 */
export async function logAdherence(
  db: DbClient,
  medicationId: string,
  date: string,
  taken: boolean,
): Promise<Medication> {
  if (!medicationId || typeof medicationId !== 'string') {
    throw new Error('medicationId is required');
  }

  if (!date || typeof date !== 'string') {
    throw new Error('date is required');
  }

  // Validate the date format (don't store, just validate)
  parseDateString(date);

  // Fetch the current medication to read its existing adherenceLog
  const existing = await db.medication.findUniqueOrThrow({
    where: { id: medicationId },
  });

  const currentLog: unknown[] = Array.isArray(existing.adherenceLog)
    ? (existing.adherenceLog as unknown[])
    : [];

  const newEntry: AdherenceEntry = {
    date,
    taken,
    timestamp: new Date().toISOString(),
  };

  const updatedLog = [...currentLog, newEntry];

  const record = await db.medication.update({
    where: { id: medicationId },
    data: {
      adherenceLog: updatedLog as Parameters<typeof db.medication.update>[0]['data']['adherenceLog'],
    },
  });

  return mapMedication(record as Parameters<typeof mapMedication>[0]);
}
