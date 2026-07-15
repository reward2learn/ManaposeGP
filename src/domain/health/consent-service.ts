import type { DbClient } from '@/lib/db';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PatientConsent {
  id: string;
  healthProfileId: string;
  gpId: string;
  consentType: string;
  status: string;
  grantedAt?: string;
  expiresAt?: string;
  revokedAt?: string;
}

export interface ConsentedPatient {
  profileId: string;
  consentType: string;
  grantedAt: string;
  expiresAt?: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const VALID_CONSENT_TYPES = new Set([
  'full_access',
  'summary_only',
  'symptom_data',
  'metrics_data',
  'medication_data',
]);

/** Default consent duration: 12 months in milliseconds. */
const TWELVE_MONTHS_MS = 12 * 30 * 24 * 60 * 60 * 1000;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Formats a Date as ISO 8601 string. */
function toIso(date: Date): string {
  return date.toISOString();
}

/** Returns a Date 12 months from now. */
function defaultExpiry(): Date {
  return new Date(Date.now() + TWELVE_MONTHS_MS);
}

/** Parses an ISO string to a Date. Throws on invalid input. */
function parseIsoDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: "${value}"`);
  }
  return date;
}

/**
 * Maps a raw Prisma PatientConsent row (with `Date` / nullable fields)
 * to the domain `PatientConsent` interface (with ISO strings).
 */
function mapConsent(row: {
  id: string;
  healthProfileId: string;
  gpId: string;
  consentType: string;
  status: string;
  grantedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
}): PatientConsent {
  return {
    id: row.id,
    healthProfileId: row.healthProfileId,
    gpId: row.gpId,
    consentType: row.consentType,
    status: row.status,
    grantedAt: row.grantedAt ? toIso(row.grantedAt) : undefined,
    expiresAt: row.expiresAt ? toIso(row.expiresAt) : undefined,
    revokedAt: row.revokedAt ? toIso(row.revokedAt) : undefined,
  };
}

/**
 * Logs a consent audit event to consent_audit_logs.
 *
 * @param db         Database client
 * @param consentId  The consent record ID
 * @param action     The action performed (e.g., GRANT, ACCEPT, REVOKE, EXPIRE)
 * @param actorType  Who performed the action (e.g., PATIENT, GP, SYSTEM)
 * @param actorId    Identifier of the actor (userId)
 * @param prevStatus Previous consent status before change
 * @param newStatus  New consent status after change
 * @param metadata   Optional JSON metadata
 */
async function logAuditEvent(
  db: DbClient,
  params: {
    consentId: string;
    action: string;
    actorType: string;
    actorId: string;
    previousStatus?: string;
    newStatus?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await db.$queryRawUnsafe(
      `INSERT INTO consent_audit_logs (id, consent_id, action, actor_type, actor_id, previous_status, new_status, metadata)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7::jsonb)`,
      params.consentId,
      params.action,
      params.actorType,
      params.actorId,
      params.previousStatus ?? null,
      params.newStatus ?? null,
      JSON.stringify(params.metadata ?? {}),
    );
  } catch (err) {
    // Audit logging is best-effort — don't fail the main operation
    console.error('[consent] Failed to write audit log:', err);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates a new consent record with status PENDING.
 *
 * Validates `consentType` against the allowed set. If `expiresAt` is not
 * provided, defaults to 12 months from now.
 *
 * @param db           Database client
 * @param profileId    The `health_profiles.id` for the patient
 * @param gpId         The GP identifier the patient is consenting to
 * @param consentType  One of: full_access, summary_only, symptom_data, metrics_data, medication_data
 * @param actorId      The ID of the user performing the action (patient userId)
 * @param expiresAt    Optional ISO expiry date (defaults to 12 months from now)
 * @returns            The created consent (domain representation)
 */
export async function grantConsent(
  db: DbClient,
  profileId: string,
  gpId: string,
  consentType: string,
  actorId: string,
  expiresAt?: string,
): Promise<PatientConsent> {
  if (!profileId || typeof profileId !== 'string') {
    throw new Error('profileId is required');
  }

  if (!gpId || typeof gpId !== 'string') {
    throw new Error('gpId is required');
  }

  if (!consentType || !VALID_CONSENT_TYPES.has(consentType)) {
    throw new Error(
      `Invalid consentType "${consentType}". Valid values: ${[...VALID_CONSENT_TYPES].join(', ')}`,
    );
  }

  const expiresDate = expiresAt ? parseIsoDate(expiresAt) : defaultExpiry();

  if (expiresDate.getTime() <= Date.now()) {
    throw new Error('expiresAt must be in the future');
  }

  const record = await db.patientConsent.create({
    data: {
      healthProfileId: profileId,
      gpId,
      consentType,
      status: 'PENDING',
      expiresAt: expiresDate,
    },
  });

  await logAuditEvent(db, {
    consentId: record.id,
    action: 'GRANT',
    actorType: 'PATIENT',
    actorId,
    newStatus: 'PENDING',
    metadata: { consentType },
  });

  return mapConsent(record);
}

/**
 * GP accepts a pending consent — sets status to ACTIVE and records `grantedAt`.
 *
 * @param db         Database client
 * @param consentId  The consent record ID
 * @param actorId    The ID of the GP performing the accept action
 * @returns          The updated consent (domain representation)
 */
export async function acceptConsent(
  db: DbClient,
  consentId: string,
  actorId: string,
): Promise<PatientConsent> {
  if (!consentId || typeof consentId !== 'string') {
    throw new Error('consentId is required');
  }

  const existing = await db.patientConsent.findUniqueOrThrow({
    where: { id: consentId },
  });

  if (existing.status !== 'PENDING') {
    throw new Error(
      `Cannot accept consent with status "${existing.status}". Only PENDING consents can be accepted.`,
    );
  }

  const record = await db.patientConsent.update({
    where: { id: consentId },
    data: {
      status: 'ACTIVE',
      grantedAt: new Date(),
    },
  });

  await logAuditEvent(db, {
    consentId,
    action: 'ACCEPT',
    actorType: 'GP',
    actorId,
    previousStatus: 'PENDING',
    newStatus: 'ACTIVE',
  });

  return mapConsent(record);
}

/**
 * Revokes a consent — sets status to REVOKED and records `revokedAt`.
 *
 * Can be called by either the patient or the GP.
 *
 * @param db         Database client
 * @param consentId  The consent record ID
 * @param actorType  Who is revoking — PATIENT or GP
 * @param actorId    The ID of the user performing the revoke
 * @returns          The updated consent (domain representation)
 */
export async function revokeConsent(
  db: DbClient,
  consentId: string,
  actorType: string = 'PATIENT',
  actorId: string,
): Promise<PatientConsent> {
  if (!consentId || typeof consentId !== 'string') {
    throw new Error('consentId is required');
  }

  const existing = await db.patientConsent.findUniqueOrThrow({
    where: { id: consentId },
  });

  if (existing.status === 'REVOKED') {
    throw new Error('Consent is already revoked');
  }

  const record = await db.patientConsent.update({
    where: { id: consentId },
    data: {
      status: 'REVOKED',
      revokedAt: new Date(),
    },
  });

  await logAuditEvent(db, {
    consentId,
    action: 'REVOKE',
    actorType,
    actorId,
    previousStatus: existing.status,
    newStatus: 'REVOKED',
  });

  return mapConsent(record);
}

/**
 * Returns all consents for a patient, ordered by `createdAt` descending.
 *
 * @param db         Database client
 * @param profileId  The `health_profiles.id`
 * @returns          Array of consents (domain representation)
 */
export async function getActiveConsents(
  db: DbClient,
  profileId: string,
): Promise<PatientConsent[]> {
  if (!profileId || typeof profileId !== 'string') {
    throw new Error('profileId is required');
  }

  const records = await db.patientConsent.findMany({
    where: { healthProfileId: profileId },
    orderBy: { createdAt: 'desc' },
  });

  return records.map((r) =>
    mapConsent(r as Parameters<typeof mapConsent>[0]),
  );
}

/**
 * Checks whether there is an active consent between a patient and a GP.
 *
 * A consent is considered "active" if its status is ACTIVE and either it has
 * no expiry (`expiresAt` is null) or the expiry date is still in the future.
 *
 * If `requiredType` is specified, the consent type must match exactly, OR the
 * consent must be `full_access` (which grants access to everything).
 *
 * @param db            Database client
 * @param profileId     The `health_profiles.id`
 * @param gpId          The GP identifier
 * @param requiredType  Optional specific consent type to check
 * @returns             `true` if an active consent exists
 */
export async function checkConsent(
  db: DbClient,
  profileId: string,
  gpId: string,
  requiredType?: string,
): Promise<boolean> {
  if (!profileId || typeof profileId !== 'string') {
    throw new Error('profileId is required');
  }

  if (!gpId || typeof gpId !== 'string') {
    throw new Error('gpId is required');
  }

  const consents = await db.patientConsent.findMany({
    where: {
      healthProfileId: profileId,
      gpId,
      status: 'ACTIVE',
    },
  });

  const now = Date.now();

  const active = consents.find((consent) => {
    // Must be ACTIVE (already filtered by where) and not expired
    if (consent.expiresAt && consent.expiresAt.getTime() <= now) {
      return false;
    }

    // If a specific type is required, check match or full_access override
    if (requiredType) {
      if (consent.consentType === 'full_access') {
        return true;
      }
      if (consent.consentType !== requiredType) {
        return false;
      }
    }

    return true;
  });

  return !!active;
}

/**
 * Returns a list of patients who have active consents with the given GP.
 *
 * Each entry includes the patient's profile ID, consent type, grant date, and
 * optional expiry date.
 *
 * @param db    Database client
 * @param gpId  The GP identifier
 * @returns     Array of consented patients
 */
export async function getConsentedPatients(
  db: DbClient,
  gpId: string,
): Promise<ConsentedPatient[]> {
  if (!gpId || typeof gpId !== 'string') {
    throw new Error('gpId is required');
  }

  const now = new Date();

  const records = await db.patientConsent.findMany({
    where: {
      gpId,
      status: 'ACTIVE',
    },
  });

  return records
    .filter((r) => !r.expiresAt || r.expiresAt.getTime() > now.getTime())
    .map((r) => ({
      profileId: r.healthProfileId,
      consentType: r.consentType,
      grantedAt: r.grantedAt ? toIso(r.grantedAt) : toIso(r.createdAt),
      expiresAt: r.expiresAt ? toIso(r.expiresAt) : undefined,
    }));
}
