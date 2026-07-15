/**
 * Patient Service — manages patient listings and GP assignments.
 * Uses raw SQL since gp_id column is added via DDL, not ZenStack schema.
 */
import type { DbClient } from '@/lib/db';

export interface PatientRow {
  id: string;
  userId: string;
  dateOfBirth: string | null;
  sexAtBirth: string | null;
  menopauseStatus: string | null;
  gpId: string | null;
  gpName: string | null;
  userEmail: string | null;
  createdAt: string;
}

export async function ensurePatientGpColumn(db: DbClient): Promise<void> {
  await db.$executeRawUnsafe(`ALTER TABLE health_profiles ADD COLUMN IF NOT EXISTS gp_id TEXT`);
}

export async function listPatients(db: DbClient): Promise<PatientRow[]> {
  return db.$queryRawUnsafe<PatientRow[]>(`
    SELECT
      hp.id,
      hp.user_id as "userId",
      hp.date_of_birth as "dateOfBirth",
      hp.sex_at_birth as "sexAtBirth",
      hp.menopause_status as "menopauseStatus",
      hp.gp_id as "gpId",
      gp.name as "gpName",
      pu.email as "userEmail",
      hp.created_at as "createdAt"
    FROM health_profiles hp
    LEFT JOIN gp_profiles gp ON hp.gp_id = gp.id
    LEFT JOIN platform_users pu ON hp.user_id = pu.id
    ORDER BY hp.created_at DESC
  `);
}

export async function assignPatientToGp(
  db: DbClient,
  patientId: string,
  gpId: string,
): Promise<void> {
  await db.$queryRawUnsafe(
    `UPDATE health_profiles SET gp_id = $1, updated_at = NOW() WHERE id = $2`,
    gpId, patientId,
  );
}

export async function unassignPatientFromGp(
  db: DbClient,
  patientId: string,
): Promise<void> {
  await db.$queryRawUnsafe(
    `UPDATE health_profiles SET gp_id = NULL, updated_at = NOW() WHERE id = $1`,
    patientId,
  );
}
