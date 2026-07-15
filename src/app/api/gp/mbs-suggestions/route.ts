import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { requirePin } from '@/lib/auth/guards';
import {
  suggestMBSItems,
  type MBSInput,
  type MBSResult,
} from '@/domain/health/mbs-assistant';

// ── Zod schemas ──────────────────────────────────────────────────────────────

const mbsSuggestionsSchema = z.object({
  consultationType: z
    .string()
    .min(1, 'consultationType is required'),
  duration: z
    .number()
    .min(0, 'duration must be a non-negative number'),
  patientAge: z
    .number()
    .min(0, 'patientAge must be a non-negative number if provided')
    .optional(),
  menopauseStatus: z.string().optional(),
  mentalHealthScreening: z.boolean().optional(),
  chronicConditions: z.array(z.string()).optional(),
  newMedicationPrescribed: z.boolean().optional(),
  carePlanCreated: z.boolean().optional(),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function jsonError(
  error: string,
  status = 400,
): NextResponse<{ success: false; error: string }> {
  return NextResponse.json({ success: false, error }, { status });
}

// ── POST: Suggest MBS items ──────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = mbsSuggestionsSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      `Invalid request: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      400,
    );
  }

  const input: MBSInput = parsed.data;

  try {
    const result: MBSResult = await suggestMBSItems(input);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to generate MBS suggestions';
    return jsonError(message, 500);
  }
}
