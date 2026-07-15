import { NextRequest, NextResponse } from 'next/server';
import { requireWriteAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import { getConsentedPatients, type ConsentedPatient } from '@/domain/health/consent-service';

// ── Types ────────────────────────────────────────────────────────────────────

interface PatientListItem {
  profileId: string;
  consentType: string;
  grantedAt: string;
  expiresAt?: string;
  menopauseStatus: string | null;
  age: number | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function jsonError(
  error: string,
  status = 400,
): NextResponse<{ success: false; error: string }> {
  return NextResponse.json({ success: false, error }, { status });
}

/**
 * Computes age in years from a Date object.
 * Returns null if dateOfBirth is null.
 */
function computeAge(dateOfBirth: Date | null): number | null {
  if (!dateOfBirth) return null;

  const today = new Date();
  let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDelta = today.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < dateOfBirth.getUTCDate())) {
    age -= 1;
  }
  return age;
}

// ── GET: List consented patients for the GP ──────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const userId = guard.session.sub;
  const db = createClient({
    tier: guard.session.tier,
    sub: userId,
  });

  try {
    // Resolve GP profile UUID from the user's Google ID
    const gpProfile = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM gp_profiles WHERE user_id = $1`, userId,
    );
    const gpId = gpProfile[0]?.id;
    if (!gpId) {
      return jsonError('GP profile not found. Please complete GP registration first.', 404);
    }

    const consented: ConsentedPatient[] = await getConsentedPatients(db, gpId);

    // Enrich each patient with basic profile info (age, menopauseStatus)
    const patients: PatientListItem[] = await Promise.all(
      consented.map(async (c) => {
        const profile = await db.healthProfile.findUnique({
          where: { id: c.profileId },
          select: {
            dateOfBirth: true,
            menopauseStatus: true,
          },
        });

        return {
          profileId: c.profileId,
          consentType: c.consentType,
          grantedAt: c.grantedAt,
          expiresAt: c.expiresAt,
          menopauseStatus: profile?.menopauseStatus ?? null,
          age: computeAge(profile?.dateOfBirth ?? null),
        };
      }),
    );

    return NextResponse.json({ success: true, patients });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to list patients';
    return jsonError(message, 500);
  }
}
