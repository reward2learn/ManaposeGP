import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { requireWriteAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import { getOrCreateProfile, getProfile } from '@/domain/health/health-profile-service';
import { logSymptom, getSymptoms } from '@/domain/health/symptom-service';

// ── Zod schemas ───────────────────────────────────────────────────────────

const symptomPostSchema = z.object({
  date: z.string().min(1, 'date is required'),
  symptomType: z.string().min(1, 'symptomType is required'),
  severity: z.number().int().min(0).max(10),
  duration: z.number().optional(),
  frequency: z.number().optional(),
  triggers: z.array(z.string()).optional(),
  reliefFactors: z.array(z.string()).optional(),
  impactOnDaily: z.number().optional(),
  notes: z.string().optional(),
});

const symptomQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────

function jsonError(error: string, status = 400): NextResponse<{ success: false; error: string }> {
  return NextResponse.json({ success: false, error }, { status });
}

// ── POST: Log a symptom ───────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = symptomPostSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(`Validation failed: ${parsed.error.issues.map((i) => i.message).join('; ')}`);
  }

  const userId = guard.session.sub;
  const db = createClient({
    tier: guard.session.tier,
    sub: userId,
  });

  try {
    const profile = await getOrCreateProfile(db, userId);
    const entry = await logSymptom(db, profile.id, parsed.data);

    return NextResponse.json({ success: true, entry });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to log symptom';
    return jsonError(message, 500);
  }
}

// ── GET: List symptom entries ─────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const userId = guard.session.sub;
  const db = createClient({
    tier: guard.session.tier,
    sub: userId,
  });

  try {
    // Resolve health profile; if none exists, return empty entries
    const profile = await getProfile(db, userId);
    if (!profile) {
      return NextResponse.json({ success: true, entries: [] });
    }

    const url = new URL(request.url);
    const query = symptomQuerySchema.safeParse({
      from: url.searchParams.get('from') ?? undefined,
      to: url.searchParams.get('to') ?? undefined,
    });

    const options = query.success
      ? { from: query.data.from, to: query.data.to }
      : undefined;

    const entries = await getSymptoms(db, profile.id, options);

    return NextResponse.json({ success: true, entries });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve symptoms';
    return jsonError(message, 500);
  }
}
