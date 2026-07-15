import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { requireWriteAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import {
  getOrCreateProfile,
  updateProfile,
  getProfile,
} from '@/domain/health/health-profile-service';

// ── Zod schema ────────────────────────────────────────────────────────────

const profileUpdateSchema = z.object({
  dateOfBirth: z.string().optional(),
  sexAtBirth: z.string().optional(),
  menopauseStatus: z.string().optional(),
  heightCm: z.number().optional(),
  weightKg: z.number().optional(),
  bloodType: z.string().optional(),
  chronicConditions: z.array(z.string()).optional(),
  currentMedications: z.array(z.string()).optional(),
  smokingStatus: z.string().optional(),
  alcoholUnitsPerWeek: z.number().optional(),
  exerciseMinutesPerWeek: z.number().optional(),
  familyHistory: z.record(z.unknown()).optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────

function jsonError(error: string, status = 400): NextResponse<{ success: false; error: string }> {
  return NextResponse.json({ success: false, error }, { status });
}

// ── POST: Create or update health profile ─────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = profileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(`Validation failed: ${parsed.error.issues.map((i) => i.message).join('; ')}`);
  }

  const userId = guard.session.sub;
  const db = createClient({
    tier: guard.session.tier,
    sub: userId,
  });

  try {
    await getOrCreateProfile(db, userId);
    const profile = await updateProfile(db, userId, parsed.data);

    return NextResponse.json({ success: true, profile });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update health profile';
    return jsonError(message, 500);
  }
}

// ── GET: Return current user's profile ────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const userId = guard.session.sub;
  const db = createClient({
    tier: guard.session.tier,
    sub: userId,
  });

  try {
    const profile = await getProfile(db, userId);
    if (!profile) {
      return jsonError('Health profile not found', 404);
    }

    return NextResponse.json({ success: true, profile });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve health profile';
    return jsonError(message, 500);
  }
}
