import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { requireGoogle } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import { getOrCreateProfile } from '@/domain/health/health-profile-service';
import {
  saveScreeningResult,
  getScreeningHistory,
} from '@/domain/health/screening-service';
import type { StoredScreeningResult } from '@/domain/health/screening-service';
import {
  scoreK10,
  scorePHQ9,
  scoreGAD7,
  scoreMenopauseRatingScale,
  type ScreeningResult,
  type PHQ9Result,
} from '@/lib/health/screening-tools';

// ── Constants ────────────────────────────────────────────────────────────────

const SELF_HARM_MESSAGE =
  'Your response indicates you may be having thoughts of self-harm. This is serious. Please contact Lifeline on 13 11 14 or 000 in an emergency. We recommend speaking with your GP urgently.';

const SCREENING_TYPES = ['k10', 'phq9', 'gad7', 'menopause_rating_scale'] as const;
type ScreeningType = (typeof SCREENING_TYPES)[number];

// ── Zod schemas ──────────────────────────────────────────────────────────────

const screeningPostSchema = z.object({
  screeningType: z.enum(SCREENING_TYPES),
  responses: z.array(z.number()),
});

const screeningQuerySchema = z.object({
  type: z
    .string()
    .optional()
    .refine(
      (val) =>
        val === undefined || (SCREENING_TYPES as readonly string[]).includes(val),
      {
        message: `type must be one of: ${SCREENING_TYPES.join(', ')}`,
      },
    ),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function jsonError(
  error: string,
  status = 400,
): NextResponse<{ success: false; error: string }> {
  return NextResponse.json({ success: false, error }, { status });
}

/**
 * Dispatches to the correct scoring function based on screeningType.
 */
function scoreByType(
  screeningType: ScreeningType,
  responses: number[],
): ScreeningResult {
  switch (screeningType) {
    case 'k10':
      return scoreK10(responses);
    case 'phq9':
      return scorePHQ9(responses);
    case 'gad7':
      return scoreGAD7(responses);
    case 'menopause_rating_scale':
      return scoreMenopauseRatingScale(responses);
  }
}

// ── POST: Submit a screening ─────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requireGoogle(request);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = screeningPostSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      `Validation failed: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
    );
  }

  const { screeningType, responses } = parsed.data;
  const userId = guard.session.sub;
  const db = createClient({
    tier: guard.session.tier,
    sub: userId,
  });

  try {
    const profile = await getOrCreateProfile(db, userId);
    const result = scoreByType(screeningType, responses);

    await saveScreeningResult(db, profile.id, result);

    const responsePayload: Record<string, unknown> = {
      success: true,
      result: { ...result },
    };

    // PHQ-9 item 9 > 0 → flag suicide risk and include crisis message
    if (result.screeningType === 'phq9') {
      const phq9Result = result as PHQ9Result;
      if (phq9Result.suicideRiskFlag) {
        responsePayload.suicideRiskFlag = true;
        responsePayload.message = SELF_HARM_MESSAGE;
      }
    }

    return NextResponse.json(responsePayload);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to submit screening';
    return jsonError(message, 500);
  }
}

// ── GET: Retrieve screening history ──────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requireGoogle(request);
  if (!guard.ok) return guard.response;

  const userId = guard.session.sub;
  const db = createClient({
    tier: guard.session.tier,
    sub: userId,
  });

  try {
    // Resolve health profile; if none exists, return empty results
    const profile = await getOrCreateProfile(db, userId);

    const url = new URL(request.url);
    const rawType = url.searchParams.get('type') ?? undefined;

    const query = screeningQuerySchema.safeParse({ type: rawType });
    if (!query.success) {
      return jsonError(
        `Invalid query: ${query.error.issues.map((i) => i.message).join('; ')}`,
      );
    }

    const results: StoredScreeningResult[] = await getScreeningHistory(
      db,
      profile.id,
      query.data.type,
    );

    return NextResponse.json({ success: true, results });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to retrieve screening history';
    return jsonError(message, 500);
  }
}
