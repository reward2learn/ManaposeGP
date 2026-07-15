import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePin } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import { generatePatientSummary } from '@/domain/health/ai-clinical-service';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  subjectiveNote: z.string().optional(),
  objectiveNote: z.string().optional(),
  assessmentNote: z.string().optional(),
  planNote: z.string().optional(),
  treatmentPlan: z.string().optional(),
  prescriptions: z.array(z.object({
    medicationName: z.string(), dosage: z.string(), frequency: z.string(), instructions: z.string().optional(),
  })).optional(),
  pathologyOrders: z.array(z.object({ testName: z.string() })).optional(),
  radiologyOrders: z.array(z.object({ imagingType: z.string(), bodyRegion: z.string() })).optional(),
  followUpInstructions: z.string().optional(),
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
  if (!parsed.success) return jsonError(`Validation: ${parsed.error.issues.map((i) => i.message).join('; ')}`);

  try {
    const summary = await generatePatientSummary(db, {
      subjectiveNote: parsed.data.subjectiveNote,
      objectiveNote: parsed.data.objectiveNote,
      assessmentNote: parsed.data.assessmentNote,
      planNote: parsed.data.planNote,
      treatmentPlan: parsed.data.treatmentPlan,
      prescriptions: parsed.data.prescriptions ?? [],
      pathologyOrders: parsed.data.pathologyOrders ?? [],
      radiologyOrders: parsed.data.radiologyOrders ?? [],
      followUpInstructions: parsed.data.followUpInstructions,
    });
    return NextResponse.json({ success: true, summary });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed', 500);
  }
}
