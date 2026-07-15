import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { requireWriteAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import { getOrCreateProfile } from '@/domain/health/health-profile-service';
import {
  addMedication,
  getMedications,
  type AddMedicationInput,
} from '@/domain/health/medication-service';

// ── Zod schemas ─────────────────────────────────────────────────────────────

const medicationPostSchema = z.object({
  name: z.string().min(1, 'name is required'),
  type: z.enum(['mht', 'supplement', 'prescription', 'otc'], {
    errorMap: () => ({ message: 'type must be mht, supplement, prescription, or otc' }),
  }),
  dosage: z.string().min(1, 'dosage is required'),
  frequency: z.string().min(1, 'frequency is required'),
  route: z
    .enum(['oral', 'transdermal', 'vaginal', 'injection', 'implant'])
    .optional(),
  startDate: z.string().min(1, 'startDate is required'),
  endDate: z.string().optional(),
  prescribedBy: z.string().optional(),
  notes: z.string().optional(),
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function jsonError(
  error: string,
  status = 400,
): NextResponse<{ success: false; error: string }> {
  return NextResponse.json({ success: false, error }, { status });
}

// ── POST: Add a medication ──────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = medicationPostSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      `Validation failed: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
    );
  }

  const userId = guard.session.sub;
  const db = createClient({
    tier: guard.session.tier,
    sub: userId,
  });

  try {
    const profile = await getOrCreateProfile(db, userId);
    const medication = await addMedication(
      db,
      profile.id,
      parsed.data as AddMedicationInput,
    );

    return NextResponse.json({ success: true, medication }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to add medication';
    return jsonError(message, 500);
  }
}

// ── GET: List medications ───────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const userId = guard.session.sub;
  const db = createClient({
    tier: guard.session.tier,
    sub: userId,
  });

  try {
    const profile = await getOrCreateProfile(db, userId);

    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status') ?? undefined;

    const medications = await getMedications(db, profile.id, statusFilter);

    return NextResponse.json({ success: true, medications });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to retrieve medications';
    return jsonError(message, 500);
  }
}
