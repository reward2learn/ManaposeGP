import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { requireWriteAuth } from '@/lib/auth/guards';
import {
  calculateFRAX,
  calculateCardiovascularRisk,
  calculateGailModel,
} from '@/lib/health/clinical-scoring';
import type {
  FRAXInput,
  CVRiskInput,
  GailInput,
  RiskOutput,
} from '@/lib/health/clinical-scoring';

// ── Disclaimer ───────────────────────────────────────────────────────────────

const DISCLAIMER =
  'This is a simplified clinical approximation. Always use validated tools ' +
  '(official FRAX at sheffield.ac.uk/FRAX, QRISK3 at qrisk.org) for clinical ' +
  'decision-making. These results should be interpreted by a qualified ' +
  'healthcare professional.';

// ── Zod schemas ──────────────────────────────────────────────────────────────

const fraxInputSchema = z.object({
  age: z.number().min(40).max(90),
  sex: z.enum(['male', 'female']),
  weight: z.number().positive(),
  height: z.number().positive(),
  previousFracture: z.boolean(),
  parentHipFracture: z.boolean(),
  currentSmoking: z.boolean(),
  glucocorticoids: z.boolean(),
  rheumatoidArthritis: z.boolean(),
  secondaryOsteoporosis: z.boolean(),
  alcohol3PerDay: z.boolean(),
  femoralNeckBMD: z.number().optional(),
});

const cvRiskInputSchema = z.object({
  age: z.number().min(35).max(84),
  sex: z.enum(['male', 'female']),
  smoking: z.enum(['current', 'ex', 'non']),
  diabetes: z.boolean(),
  familyHistoryCVD: z.boolean(),
  chronicKidneyDisease: z.boolean(),
  atrialFibrillation: z.boolean(),
  bloodPressureTreatment: z.boolean(),
  systolicBP: z.number().positive(),
  totalCholesterol: z.number().positive(),
  hdlCholesterol: z.number().positive(),
  bmi: z.number().positive(),
});

const gailInputSchema = z.object({
  age: z.number().min(35).max(85),
  ageAtMenarche: z.number().min(8).max(18),
  ageAtFirstBirth: z.number().min(12).max(50).nullable(),
  firstDegreeRelatives: z.number().int().min(0).max(10),
  previousBiopsies: z.number().int().min(0).max(10),
  atypicalHyperplasia: z.boolean(),
});

const modelEnum = z.enum(['frax', 'cardiovascular', 'gail']);

const riskCalculatorSchema = z.object({
  model: modelEnum,
  patientData: z.record(z.unknown()),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function jsonError(
  error: string,
  status = 400,
): NextResponse<{ success: false; error: string }> {
  return NextResponse.json({ success: false, error }, { status });
}

function validateModelInput(
  model: string,
  patientData: unknown,
):
  | { ok: true; data: FRAXInput | CVRiskInput | GailInput }
  | { ok: false; error: string } {
  let parsed: z.SafeParseReturnType<unknown, FRAXInput | CVRiskInput | GailInput>;

  switch (model) {
    case 'frax':
      parsed = fraxInputSchema.safeParse(patientData);
      break;
    case 'cardiovascular':
      parsed = cvRiskInputSchema.safeParse(patientData);
      break;
    case 'gail':
      parsed = gailInputSchema.safeParse(patientData);
      break;
    default:
      return { ok: false, error: `Unknown risk model: "${model}"` };
  }

  if (!parsed.success) {
    return {
      ok: false,
      error: `Validation failed: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    };
  }

  return { ok: true, data: parsed.data };
}

// ── POST: Calculate clinical risk ────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const topLevel = riskCalculatorSchema.safeParse(body);
  if (!topLevel.success) {
    return jsonError(
      `Invalid request: ${topLevel.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      400,
    );
  }

  const { model, patientData } = topLevel.data;

  // Validate model-specific input
  const validation = validateModelInput(model, patientData);
  if (!validation.ok) {
    return jsonError(validation.error, 400);
  }

  // Compute risk
  let result: RiskOutput;
  try {
    switch (model) {
      case 'frax':
        result = calculateFRAX(validation.data as FRAXInput);
        break;
      case 'cardiovascular':
        result = calculateCardiovascularRisk(validation.data as CVRiskInput);
        break;
      case 'gail':
        result = calculateGailModel(validation.data as GailInput);
        break;
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Risk calculation failed';
    return jsonError(message, 500);
  }

  return NextResponse.json({
    success: true,
    result,
    disclaimer: DISCLAIMER,
  });
}
