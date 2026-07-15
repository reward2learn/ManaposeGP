import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePin } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import {
  createConsultation,
  generateSOAPNote,
  getConsultations,
  type CreateConsultationInput,
} from '@/domain/health/consultation-service';

export const dynamic = 'force-dynamic';

// ── Zod schemas ─────────────────────────────────────────────────────────────

const createConsultationBodySchema = z.object({
  patientId: z.string().min(1, 'patientId is required'),
  gpId: z.string().min(1, 'gpId is required'),
  date: z.string().min(1, 'date is required (YYYY-MM-DD)'),
  consultationType: z
    .enum(['INITIAL', 'FOLLOW_UP', 'REVIEW', 'EMERGENCY'])
    .optional(),
  duration: z.number().int().positive('duration must be a positive integer').optional(),
  summary: z.string().min(1, 'summary is required'),
  subjectiveNote: z.string().optional(),
  objectiveNote: z.string().optional(),
  assessmentNote: z.string().optional(),
  planNote: z.string().optional(),
  treatmentPlan: z.string().optional(),
  prescriptions: z.array(z.string()).optional(),
  referrals: z.array(z.string()).optional(),
  followUp: z.string().optional(),
  mbsItems: z.array(z.string()).optional(),
  notes: z.string().optional(),
  aiGenerated: z.boolean().optional(),
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function jsonError(
  error: string,
  status = 400,
): NextResponse<{ success: false; error: string }> {
  return NextResponse.json({ success: false, error }, { status });
}

function formatZodErrors(issues: z.ZodIssue[]): string {
  return issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
}

// ── POST: Create a GP consultation ─────────────────────────────────────────

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

  const parsed = createConsultationBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      `Invalid consultation data: ${formatZodErrors(parsed.error.issues)}`,
      400,
    );
  }

  try {
    const input: CreateConsultationInput = {
      patientId: parsed.data.patientId,
      gpId: parsed.data.gpId,
      date: parsed.data.date,
      consultationType: parsed.data.consultationType,
      duration: parsed.data.duration,
      summary: parsed.data.summary,
      subjectiveNote: parsed.data.subjectiveNote,
      objectiveNote: parsed.data.objectiveNote,
      assessmentNote: parsed.data.assessmentNote,
      planNote: parsed.data.planNote,
      treatmentPlan: parsed.data.treatmentPlan,
      prescriptions: parsed.data.prescriptions,
      referrals: parsed.data.referrals,
      followUp: parsed.data.followUp,
      mbsItems: parsed.data.mbsItems,
      notes: parsed.data.notes,
      aiGenerated: parsed.data.aiGenerated,
    };

    // If SOAP fields are provided directly, store them; otherwise generate if aiGenerated
    const hasSOAPFields = parsed.data.subjectiveNote || parsed.data.objectiveNote
      || parsed.data.assessmentNote || parsed.data.planNote;

    const consultation = await createConsultation(db, input);

    // Only auto-generate SOAP if aiGenerated=true AND notes provided AND no SOAP fields already sent
    if (parsed.data.aiGenerated && parsed.data.notes?.trim() && !hasSOAPFields) {
      try {
        const soapNote = await generateSOAPNote(db, input.patientId, {
          notes: parsed.data.notes.trim(),
        });

        // Update the consultation record with SOAP fields
        const updated = await db.gPConsultation.update({
          where: { id: consultation.id },
          data: {
            subjectiveNote: soapNote.subjective,
            objectiveNote: soapNote.objective,
            assessmentNote: soapNote.assessment,
            planNote: soapNote.plan,
          },
        });

        return NextResponse.json({
          success: true,
          consultation: {
            id: updated.id,
            patientId: updated.patientId,
            gpId: updated.gpId,
            date: updated.date.toISOString().slice(0, 10),
            consultationType: updated.consultationType,
            duration: updated.duration,
            summary: updated.summary,
            subjectiveNote: updated.subjectiveNote,
            objectiveNote: updated.objectiveNote,
            assessmentNote: updated.assessmentNote,
            planNote: updated.planNote,
            treatmentPlan: updated.treatmentPlan,
            prescriptions: updated.prescriptions,
            referrals: updated.referrals,
            followUp: updated.followUp?.toISOString(),
            mbsItems: updated.mbsItems,
            notes: updated.notes,
            aiGenerated: updated.aiGenerated,
          },
        });
      } catch (soapErr) {
        // SOAP generation failed — return the consultation without SOAP fields
        // but include a warning
        const message =
          soapErr instanceof Error ? soapErr.message : 'SOAP generation failed';
        console.warn('[gp/consultations] SOAP generation failed:', message);

        return NextResponse.json({
          success: true,
          consultation,
          warning: `Consultation created but SOAP note generation failed: ${message}`,
        });
      }
    }

    return NextResponse.json({ success: true, consultation });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to create consultation';
    return jsonError(message, 500);
  }
}

// ── GET: List consultations for a patient ───────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  const db = createClient({
    tier: guard.session.tier,
    sub: guard.session.sub,
  });

  try {
    const url = new URL(request.url);
    const patientId = url.searchParams.get('patientId');

    if (!patientId || !patientId.trim()) {
      return jsonError('patientId query parameter is required', 400);
    }

    const consultations = await getConsultations(db, patientId.trim());

    return NextResponse.json({ success: true, consultations });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to list consultations';
    return jsonError(message, 500);
  }
}
