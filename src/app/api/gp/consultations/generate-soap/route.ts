import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePin } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import { generateSOAPNote } from '@/domain/health/consultation-service';

export const dynamic = 'force-dynamic';

// ── Zod schema ─────────────────────────────────────────────────────────────

const generateSOAPBodySchema = z.object({
  patientId: z.string().min(1, 'patientId is required'),
  notes: z.string().min(1, 'notes are required for SOAP generation'),
  includeMetrics: z.boolean().optional(),
});

// ── Helpers ────────────────────────────────────────────────────────────────

function jsonError(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

// ── POST: Generate SOAP note (no DB write) ────────────────────────────────

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
    return jsonError('Invalid JSON body');
  }

  const parsed = generateSOAPBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      `Validation: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
    );
  }

  try {
    const soapNote = await generateSOAPNote(db, parsed.data.patientId, {
      notes: parsed.data.notes,
      includeMetrics: parsed.data.includeMetrics,
    });

    return NextResponse.json({
      success: true,
      soap: {
        subjective: soapNote.subjective,
        objective: soapNote.objective,
        assessment: soapNote.assessment,
        plan: soapNote.plan,
        disclaimer: soapNote.disclaimer,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'SOAP generation failed';
    return jsonError(message, 500);
  }
}
