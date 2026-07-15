import type { DbClient } from '@/lib/db';
import type { ScreeningResult } from '@/lib/health/screening-tools';

// ── Types ────────────────────────────────────────────────────────────────────

export interface StoredScreeningResult {
  id: string;
  healthProfileId: string;
  screeningType: string;
  score: number;
  interpretation: string;
  severity: string | null;
  completedAt: string;
  notes: string | null;
}

// ── Valid Screening Types ─────────────────────────────────────────────────────

const VALID_SCREENING_TYPES = new Set<string>([
  'k10',
  'phq9',
  'gad7',
  'menopause_rating_scale',
]);

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Maps a domain ScreeningResult to the DB-compatible payload.
 */
function toDbPayload(
  profileId: string,
  result: ScreeningResult,
): {
  healthProfileId: string;
  screeningType: string;
  score: number;
  interpretation: string;
  severity: string | null;
} {
  return {
    healthProfileId: profileId,
    screeningType: result.screeningType,
    score: result.score,
    interpretation: result.interpretation,
    severity: result.severity ?? null,
  };
}

/**
 * Converts a raw DB row to a plain StoredScreeningResult DTO.
 */
function toDto(
  row: {
    id: string;
    healthProfileId: string;
    screeningType: string;
    score: number;
    interpretation: string;
    severity: string | null;
    completedAt: Date;
    notes: string | null;
  },
): StoredScreeningResult {
  return {
    id: row.id,
    healthProfileId: row.healthProfileId,
    screeningType: row.screeningType,
    score: row.score,
    interpretation: row.interpretation,
    severity: row.severity ?? null,
    completedAt: row.completedAt.toISOString(),
    notes: row.notes ?? null,
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Persists a screening result for the given health profile.
 *
 * @param db        Database client
 * @param profileId The `health_profiles.id`
 * @param result    The scored screening result from screening-tools
 */
export async function saveScreeningResult(
  db: DbClient,
  profileId: string,
  result: ScreeningResult,
): Promise<void> {
  if (!profileId || typeof profileId !== 'string') {
    throw new Error('profileId is required');
  }

  if (!result) {
    throw new Error('result is required');
  }

  await db.screeningResult.create({
    data: toDbPayload(profileId, result),
  });
}

/**
 * Returns screening history for a health profile, optionally filtered by type.
 *
 * @param db        Database client
 * @param profileId The `health_profiles.id`
 * @param type      Optional screening type filter (e.g. 'k10', 'phq9')
 */
export async function getScreeningHistory(
  db: DbClient,
  profileId: string,
  type?: string,
): Promise<StoredScreeningResult[]> {
  if (!profileId || typeof profileId !== 'string') {
    throw new Error('profileId is required');
  }

  if (type !== undefined) {
    if (typeof type !== 'string' || !VALID_SCREENING_TYPES.has(type)) {
      throw new Error(
        `Invalid screening type "${type}". Valid values: ${[...VALID_SCREENING_TYPES].join(', ')}`,
      );
    }
  }

  const where: Record<string, unknown> = {
    healthProfileId: profileId,
  };

  if (type) {
    where.screeningType = type;
  }

  const rows = await db.screeningResult.findMany({
    where,
    orderBy: { completedAt: 'desc' },
  });

  return rows.map(toDto);
}
