/**
 * GP Profile Service — manages GP registration and verification.
 */
import type { DbClient } from '@/lib/db';

export async function ensureGpProfileColumns(db: DbClient): Promise<void> {
  await db.$executeRawUnsafe(`ALTER TABLE gp_profiles ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'PENDING'`);
  await db.$executeRawUnsafe(`ALTER TABLE gp_profiles ADD COLUMN IF NOT EXISTS verification_notes TEXT`);
  await db.$executeRawUnsafe(`ALTER TABLE gp_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
}

export interface GpProfile {
  id: string;
  userId: string;
  name: string;
  practiceName?: string;
  practiceAddress?: string;
  practiceSuburb?: string;
  practiceState?: string;
  practicePostcode?: string;
  practicePhone?: string;
  ahpraNumber?: string;
  email?: string;
  verified: boolean;
  indemnityProvider?: string;
  indemnityPolicyNumber?: string;
  indemnityExpiryDate?: string;
  createdAt: string;
}

export interface RegisterGpInput {
  name: string;
  practiceName?: string;
  practiceAddress?: string;
  practiceSuburb?: string;
  practiceState?: string;
  practicePostcode?: string;
  practicePhone?: string;
  ahpraNumber?: string;
  email?: string;
  indemnityProvider?: string;
  indemnityPolicyNumber?: string;
  indemnityExpiryDate?: string;
}

export async function registerGp(
  db: DbClient,
  userId: string,
  data: RegisterGpInput,
): Promise<GpProfile> {
  const existing = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM gp_profiles WHERE user_id = $1`,
    userId,
  );
  if (existing.length > 0) {
    throw new Error('GP profile already exists for this user');
  }

  const result = await db.$queryRawUnsafe<Array<GpProfile>>(
    `INSERT INTO gp_profiles (id, user_id, name, practice_name, practice_address, practice_suburb, practice_state, practice_postcode, practice_phone, ahpra_number, email, indemnity_provider, indemnity_policy_number, indemnity_expiry_date, verified)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, false)
     RETURNING id, user_id as "userId", name, practice_name as "practiceName", practice_address as "practiceAddress", practice_suburb as "practiceSuburb", practice_state as "practiceState", practice_postcode as "practicePostcode", practice_phone as "practicePhone", ahpra_number as "ahpraNumber", email, indemnity_provider as "indemnityProvider", indemnity_policy_number as "indemnityPolicyNumber", indemnity_expiry_date as "indemnityExpiryDate", verified, created_at as "createdAt"`,
    userId,
    data.name,
    data.practiceName ?? null,
    data.practiceAddress ?? null,
    data.practiceSuburb ?? null,
    data.practiceState ?? null,
    data.practicePostcode ?? null,
    data.practicePhone ?? null,
    data.ahpraNumber ?? null,
    data.email ?? null,
    data.indemnityProvider ?? null,
    data.indemnityPolicyNumber ?? null,
    data.indemnityExpiryDate ?? null,
  );
  return result[0];
}

export async function getGpProfile(db: DbClient, userId: string): Promise<GpProfile | null> {
  const result = await db.$queryRawUnsafe<Array<GpProfile>>(
    `SELECT id, user_id as "userId", name, practice_name as "practiceName",
            ahpra_number as "ahpraNumber", email, verified,
            indemnity_provider as "indemnityProvider",
            indemnity_policy_number as "indemnityPolicyNumber",
            indemnity_expiry_date as "indemnityExpiryDate",
            created_at as "createdAt"
     FROM gp_profiles WHERE user_id = $1`,
    userId,
  );
  return result[0] ?? null;
}

export async function isVerifiedGp(db: DbClient, userId: string): Promise<boolean> {
  const result = await db.$queryRawUnsafe<Array<{ verified: boolean }>>(
    `SELECT verified FROM gp_profiles WHERE user_id = $1 AND verified = true`,
    userId,
  );
  return result.length > 0;
}

export async function verifyGp(db: DbClient, gpId: string): Promise<void> {
  await db.$queryRawUnsafe(
    `UPDATE gp_profiles SET verified = true, updated_at = NOW() WHERE id = $1`,
    gpId,
  );
}

export async function listGps(db: DbClient): Promise<GpProfile[]> {
  return db.$queryRawUnsafe<Array<GpProfile>>(
    `SELECT id, user_id as "userId", name, practice_name as "practiceName",
            ahpra_number as "ahpraNumber", email, verified,
            indemnity_provider as "indemnityProvider",
            indemnity_policy_number as "indemnityPolicyNumber",
            indemnity_expiry_date as "indemnityExpiryDate",
            created_at as "createdAt"
     FROM gp_profiles ORDER BY created_at DESC`,
  );
}

export async function updateGp(
  db: DbClient,
  gpId: string,
  data: Partial<RegisterGpInput>,
): Promise<void> {
  const setClauses: string[] = [];
  const values: string[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) { setClauses.push(`name = $${paramIndex++}`); values.push(data.name); }
  if (data.practiceName !== undefined) { setClauses.push(`practice_name = $${paramIndex++}`); values.push(data.practiceName); }
  if (data.practiceAddress !== undefined) { setClauses.push(`practice_address = $${paramIndex++}`); values.push(data.practiceAddress); }
  if (data.practiceSuburb !== undefined) { setClauses.push(`practice_suburb = $${paramIndex++}`); values.push(data.practiceSuburb); }
  if (data.practiceState !== undefined) { setClauses.push(`practice_state = $${paramIndex++}`); values.push(data.practiceState); }
  if (data.practicePostcode !== undefined) { setClauses.push(`practice_postcode = $${paramIndex++}`); values.push(data.practicePostcode); }
  if (data.practicePhone !== undefined) { setClauses.push(`practice_phone = $${paramIndex++}`); values.push(data.practicePhone); }
  if (data.ahpraNumber !== undefined) { setClauses.push(`ahpra_number = $${paramIndex++}`); values.push(data.ahpraNumber); }
  if (data.email !== undefined) { setClauses.push(`email = $${paramIndex++}`); values.push(data.email); }
  if (data.indemnityProvider !== undefined) { setClauses.push(`indemnity_provider = $${paramIndex++}`); values.push(data.indemnityProvider); }
  if (data.indemnityPolicyNumber !== undefined) { setClauses.push(`indemnity_policy_number = $${paramIndex++}`); values.push(data.indemnityPolicyNumber); }
  if (data.indemnityExpiryDate !== undefined) { setClauses.push(`indemnity_expiry_date = $${paramIndex++}`); values.push(data.indemnityExpiryDate); }

  if (setClauses.length === 0) return;

  setClauses.push(`updated_at = NOW()`);
  values.push(gpId);

  await db.$queryRawUnsafe(
    `UPDATE gp_profiles SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
    ...values,
  );
}
