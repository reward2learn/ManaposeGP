import type { DbClient } from '@/lib/db';
import type { HealthProfile } from '@/generated/prisma';

// ── Types ────────────────────────────────────────────────────────────────────

export interface HealthProfileUpdate {
  dateOfBirth?: string;
  sexAtBirth?: string;
  menopauseStatus?: string;
  heightCm?: number;
  weightKg?: number;
  bloodType?: string;
  allergies?: string[];
  chronicConditions?: string[];
  currentMedications?: string[];
  smokingStatus?: string;
  alcoholUnitsPerWeek?: number;
  exerciseMinutesPerWeek?: number;
  familyHistory?: Record<string, unknown>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildUpdateData(
  data: Partial<HealthProfileUpdate>,
): Record<string, unknown> {
  const updateData: Record<string, unknown> = {};

  if (data.dateOfBirth !== undefined) {
    updateData.dateOfBirth = new Date(data.dateOfBirth);
  }
  if (data.sexAtBirth !== undefined) {
    updateData.sexAtBirth = data.sexAtBirth;
  }
  if (data.menopauseStatus !== undefined) {
    updateData.menopauseStatus = data.menopauseStatus;
  }
  if (data.heightCm !== undefined) {
    updateData.heightCm = data.heightCm;
  }
  if (data.weightKg !== undefined) {
    updateData.weightKg = data.weightKg;
  }
  if (data.bloodType !== undefined) {
    updateData.bloodType = data.bloodType;
  }
  if (data.allergies !== undefined) {
    updateData.allergies = data.allergies;
  }
  if (data.chronicConditions !== undefined) {
    updateData.chronicConditions = data.chronicConditions;
  }
  if (data.currentMedications !== undefined) {
    updateData.currentMedications = data.currentMedications;
  }
  if (data.smokingStatus !== undefined) {
    updateData.smokingStatus = data.smokingStatus;
  }
  if (data.alcoholUnitsPerWeek !== undefined) {
    updateData.alcoholUnitsPerWeek = data.alcoholUnitsPerWeek;
  }
  if (data.exerciseMinutesPerWeek !== undefined) {
    updateData.exerciseMinutesPerWeek = data.exerciseMinutesPerWeek;
  }
  if (data.familyHistory !== undefined) {
    updateData.familyHistory = data.familyHistory;
  }

  return updateData;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the existing health profile for the given user, or creates
 * a new one with defaults (only `userId` populated).
 *
 * Uses `findFirst` + `create` rather than `upsert` because `userId` is
 * not annotated `@unique` on the `HealthProfile` model — there is no
 * reliable uniqueness constraint for `upsert` to latch onto.
 */
export async function getOrCreateProfile(
  db: DbClient,
  userId: string,
): Promise<HealthProfile> {
  const existing = await db.healthProfile.findFirst({
    where: { userId },
  });

  if (existing) {
    return existing;
  }

  return db.healthProfile.create({
    data: { userId },
  });
}

/**
 * Updates the health profile for the given user. Only the fields that
 * are explicitly provided in `data` are touched — absent keys are left
 * unchanged.
 *
 * Throws if no profile exists for the user. Callers should ensure a
 * profile has been created (e.g. via `getOrCreateProfile`) first.
 */
export async function updateProfile(
  db: DbClient,
  userId: string,
  data: Partial<HealthProfileUpdate>,
): Promise<HealthProfile> {
  const profile = await db.healthProfile.findFirst({
    where: { userId },
    select: { id: true },
  });

  if (!profile) {
    throw new Error(`Health profile not found for user: ${userId}`);
  }

  const updateData = buildUpdateData(data);

  if (Object.keys(updateData).length === 0) {
    // Nothing to update — return the full profile
    return db.healthProfile.findFirstOrThrow({
      where: { userId },
    });
  }

  return db.healthProfile.update({
    where: { id: profile.id },
    data: updateData,
  });
}

/**
 * Returns the health profile for the given user, or `null` if none exists.
 */
export async function getProfile(
  db: DbClient,
  userId: string,
): Promise<HealthProfile | null> {
  return db.healthProfile.findFirst({
    where: { userId },
  });
}
