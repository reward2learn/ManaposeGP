import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePin } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import {
  generateReferralLetter,
  type ReferralLetter,
} from '@/domain/health/referral-generator';

export const dynamic = 'force-dynamic';

// ── Zod schema ────────────────────────────────────────────────────────────────

const referralLetterBodySchema = z.object({
  patientId: z.string().min(1, 'patientId is required'),
  specialistType: z.enum(
    [
      'gynaecologist',
      'endocrinologist',
      'psychiatrist',
      'physiotherapist',
      'dietitian',
      'cardiologist',
      'other',
    ],
    {
      errorMap: () => ({
        message:
          'specialistType must be one of: gynaecologist, endocrinologist, psychiatrist, physiotherapist, dietitian, cardiologist, other',
      }),
    },
  ),
  urgency: z.enum(['routine', 'semi-urgent', 'urgent'], {
    errorMap: () => ({
      message: 'urgency must be one of: routine, semi-urgent, urgent',
    }),
  }),
  reasonForReferral: z.string().min(1, 'reasonForReferral is required'),
  additionalNotes: z.string().optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function jsonError(
  error: string,
  status = 400,
): NextResponse<{ success: false; error: string }> {
  return NextResponse.json({ success: false, error }, { status });
}

function formatZodErrors(issues: z.ZodIssue[]): string {
  return issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
}

// ── POST: Generate a specialist referral letter ───────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  const db = createClient({
    tier: guard.session.tier,
    sub: guard.session.sub,
  });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = referralLetterBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      `Invalid request data: ${formatZodErrors(parsed.error.issues)}`,
      400,
    );
  }

  try {
    const letter: ReferralLetter = await generateReferralLetter(
      db,
      parsed.data.patientId,
      {
        specialistType: parsed.data.specialistType,
        urgency: parsed.data.urgency,
        reasonForReferral: parsed.data.reasonForReferral,
        additionalNotes: parsed.data.additionalNotes,
      },
    );

    return NextResponse.json({ success: true, letter });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'Failed to generate referral letter';
    return jsonError(message, 500);
  }
}
