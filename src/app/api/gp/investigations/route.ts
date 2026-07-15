import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePin } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import { suggestInvestigations } from '@/domain/health/gp-prep-service';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  patientId: z.string().min(1),
  notes: z.string().optional(),
});

function jsonError(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON body'); }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonError(`Validation: ${parsed.error.issues[0]?.message}`);

  try {
    const suggestions = await suggestInvestigations(db, parsed.data.patientId, parsed.data.notes);
    return NextResponse.json({ success: true, suggestions });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed to generate suggestions', 500);
  }
}
