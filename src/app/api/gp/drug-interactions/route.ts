import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { requireWriteAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import { getMedications } from '@/domain/health/medication-service';
import {
  checkInteractions,
  type DrugInteractionResult,
} from '@/domain/health/drug-interaction-checker';

// ── Zod schemas ──────────────────────────────────────────────────────────────

const drugInteractionsSchema = z.object({
  medications: z
    .array(z.string().min(1, 'Medication name must not be empty'))
    .min(1, 'At least one medication is required')
    .max(10, 'Maximum 10 medications can be checked'),
  profileId: z.string().optional(),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function jsonError(
  error: string,
  status = 400,
): NextResponse<{ success: false; error: string }> {
  return NextResponse.json({ success: false, error }, { status });
}

// ── POST: Check drug interactions ────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
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

  const parsed = drugInteractionsSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      `Invalid request: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      400,
    );
  }

  const { medications, profileId } = parsed.data;

  try {
    // Build the final medication list
    let medicationsToCheck: string[] = [...medications];

    // If profileId is provided, fetch the patient's current medications and merge
    if (profileId) {
      const patientMeds = await getMedications(db, profileId);
      const patientMedNames = patientMeds.map((m) => m.name);
      medicationsToCheck = mergeMedicationLists(medications, patientMedNames);
    }

    const result: DrugInteractionResult = await checkInteractions(db, medicationsToCheck);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to check drug interactions';
    return jsonError(message, 500);
  }
}

/**
 * Merges two medication lists, deduplicating by case-insensitive name comparison.
 * Provider-supplied names take precedence (first) in output order.
 */
function mergeMedicationLists(provided: string[], patient: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  // Provider-supplied medications first
  for (const name of provided) {
    const key = name.trim().toLowerCase();
    if (key.length > 0 && !seen.has(key)) {
      seen.add(key);
      merged.push(name.trim());
    }
  }

  // Patient medications second (deduplicated)
  for (const name of patient) {
    const key = name.trim().toLowerCase();
    if (key.length > 0 && !seen.has(key)) {
      seen.add(key);
      merged.push(name.trim());
    }
  }

  // Cap at 10 medications
  return merged.slice(0, 10);
}
