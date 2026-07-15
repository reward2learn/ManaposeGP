import type { DbClient } from '@/lib/db';
import { resolveOpenAiKey } from '@/lib/openai';

// ── Types ──────────────────────────────────────────────────────────────────

export interface PrescriptionSuggestion {
  medicationName: string;
  activeIngredient: string;
  typicalDosage: string;
  typicalFrequency: string;
  clinicalRationale: string;
  guidelineSource: string;
  category: 'mht' | 'supplement' | 'prescription';
}

export interface PatientSummaryInput {
  subjectiveNote?: string;
  objectiveNote?: string;
  assessmentNote?: string;
  planNote?: string;
  treatmentPlan?: string;
  prescriptions: Array<{ medicationName: string; dosage: string; frequency: string; instructions?: string }>;
  pathologyOrders: Array<{ testName: string }>;
  radiologyOrders: Array<{ imagingType: string; bodyRegion: string }>;
  followUpInstructions?: string;
}

export interface PatientSummary {
  title: string;
  whatWeDiscussed: string;
  whatWeFound: string;
  whatWeDecided: string;
  medicationsExplained: string[];
  testsOrdered: string[];
  nextSteps: string;
  whenToSeeDoctor: string;
  disclaimer: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const AI_MODEL = process.env.OPENAI_GP_CHAT_MODEL || 'gpt-4o';

async function callOpenAI(
  systemPrompt: string,
  userContent: string,
  temperature = 0.3,
  maxTokens = 2000,
): Promise<string> {
  const apiKey = await resolveOpenAiKey();
  if (!apiKey) throw new Error('OpenAI API key is not configured.');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    let detail = '';
    try { const err = await response.json() as { error?: { message?: string } }; detail = err.error?.message ?? ''; } catch { /* */ }
    throw new Error(`OpenAI error ${response.status}${detail ? `: ${detail}` : ''}`);
  }

  const data = await response.json() as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

// ── System prompts ─────────────────────────────────────────────────────────

const PRESCRIPTION_SYSTEM_PROMPT = [
  'You are an AI clinical decision support tool for Australian GPs specialising in menopause and women\'s health.',
  'Based on the patient\'s profile, symptoms, and clinical notes, suggest appropriate medications.',
  '',
  'Return valid JSON with a single field "suggestions" — an array of objects:',
  '- medicationName: Brand or generic name',
  '- activeIngredient: Active pharmaceutical ingredient',
  '- typicalDosage: Standard starting dosage',
  '- typicalFrequency: Standard frequency (daily, twice weekly, etc.)',
  '- clinicalRationale: 1-2 sentences explaining why this medication is appropriate',
  '- guidelineSource: Reference to an Australian guideline (e.g. "RACGP Red Book", "Jean Hailes", "AMS 2023")',
  '- category: "mht", "supplement", or "prescription"',
  '',
  'Consider: Menopause status, symptom severity, chronic conditions, contraindications, PBS availability.',
  'Focus on evidence-based menopause treatments: MHT options (estradiol, progesterone), non-hormonal options (venlafaxine, gabapentin), supplements (vitamin D, calcium).',
  'Return 0-5 suggestions. Only suggest clinically appropriate medications.',
].join('\n');

const PATIENT_SUMMARY_SYSTEM_PROMPT = [
  'You are an AI that translates clinical consultation notes into a friendly, easy-to-understand summary for patients.',
  'Use plain language (Grade 6-8 reading level). Avoid medical jargon or explain it simply.',
  '',
  'Return valid JSON with these string fields:',
  '- title: A short, friendly title for the summary',
  '- whatWeDiscussed: 2-3 sentences summarizing what the patient talked about with their doctor',
  '- whatWeFound: 2-3 sentences summarizing any findings or observations',
  '- whatWeDecided: 2-3 sentences summarizing the treatment plan',
  '- medicationsExplained: Array of strings, each explaining a medication in simple terms (format: "MedicationName (dosage, frequency) — what it does and how to take it")',
  '- testsOrdered: Array of strings describing any tests ordered (e.g. "Blood test to check your iron levels")',
  '- nextSteps: What the patient should do next (e.g. "Take your new medication as prescribed, book a follow-up in 3 months")',
  '- whenToSeeDoctor: When to seek urgent care (e.g. "If you experience severe headache, chest pain, or leg swelling, see a doctor immediately")',
  '- disclaimer: Mandatory disclaimer text',
  '',
  'Be warm, supportive, and reassuring. Empower the patient to manage their health.',
].join('\n');

const DISCLAIMER_TEXT =
  'This summary was generated by AI and reviewed by your doctor. It is for your reference only. If you have any questions or concerns, please contact your GP. In an emergency, call 000.';

// ── Public API: suggestPrescriptions ───────────────────────────────────────

export async function suggestPrescriptions(
  db: DbClient,
  patientId: string,
  notes?: string,
): Promise<PrescriptionSuggestion[]> {
  if (!patientId) throw new Error('patientId is required');

  const profile = await db.healthProfile.findUnique({ where: { id: patientId } });
  if (!profile) throw new Error('Health profile not found');

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [symptoms, medications] = await Promise.all([
    db.symptomJournal.findMany({
      where: { healthProfileId: patientId, date: { gte: thirtyDaysAgo } },
      orderBy: { date: 'desc' }, take: 20,
    }),
    db.medication.findMany({
      where: { healthProfileId: patientId, status: 'ACTIVE' },
    }),
  ]);

  const parts: string[] = [];
  parts.push('PATIENT CONTEXT:');
  if (profile.dateOfBirth) {
    const age = Math.floor((Date.now() - profile.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    parts.push(`- Age: ${age}`);
  }
  if (profile.menopauseStatus) parts.push(`- Menopause status: ${profile.menopauseStatus}`);
  if (profile.chronicConditions.length) parts.push(`- Chronic conditions: ${profile.chronicConditions.join(', ')}`);
  if (profile.allergies.length) parts.push(`- Allergies: ${profile.allergies.join(', ')}`);

  if (symptoms.length > 0) {
    parts.push('\nRECENT SYMPTOMS:');
    for (const s of symptoms) {
      parts.push(`- ${s.symptomType} (severity ${s.severity}/10)`);
    }
  }

  if (medications.length > 0) {
    parts.push('\nCURRENT MEDICATIONS:');
    for (const m of medications) {
      parts.push(`- ${m.name}: ${m.dosage}, ${m.frequency}`);
    }
  }

  if (notes?.trim()) {
    parts.push(`\nGP NOTES:\n${notes.trim()}`);
  }

  parts.push('\nSuggest appropriate medications based on the above.');

  try {
    const content = await callOpenAI(PRESCRIPTION_SYSTEM_PROMPT, parts.join('\n'), 0.3, 1500);
    const json = JSON.parse(content) as { suggestions?: PrescriptionSuggestion[] };
    if (Array.isArray(json.suggestions)) {
      return json.suggestions.filter((s) => typeof s.medicationName === 'string' && s.medicationName.trim());
    }
  } catch { /* fall through */ }
  return [];
}

// ── Public API: generatePatientSummary ─────────────────────────────────────

export async function generatePatientSummary(
  _db: DbClient,
  input: PatientSummaryInput,
): Promise<PatientSummary> {
  if (!input.assessmentNote && !input.planNote && !input.subjectiveNote) {
    throw new Error('At least one of subjectiveNote, assessmentNote, or planNote is required');
  }

  const parts: string[] = ['Generate a patient-friendly summary from the following consultation details.\n'];

  if (input.subjectiveNote) parts.push(`WHAT THE PATIENT REPORTED:\n${input.subjectiveNote}\n`);
  if (input.objectiveNote) parts.push(`EXAMINATION FINDINGS:\n${input.objectiveNote}\n`);
  if (input.assessmentNote) parts.push(`DOCTOR\'S ASSESSMENT:\n${input.assessmentNote}\n`);
  if (input.planNote) parts.push(`TREATMENT PLAN:\n${input.planNote}\n`);
  if (input.treatmentPlan) parts.push(`ADDITIONAL PLAN:\n${input.treatmentPlan}\n`);

  if (input.prescriptions.length > 0) {
    parts.push('MEDICATIONS PRESCRIBED:');
    for (const p of input.prescriptions) {
      parts.push(`- ${p.medicationName}: ${p.dosage}, ${p.frequency}${p.instructions ? ` (${p.instructions})` : ''}`);
    }
    parts.push('');
  }

  if (input.pathologyOrders.length > 0) {
    parts.push('PATHOLOGY TESTS ORDERED:');
    for (const o of input.pathologyOrders) parts.push(`- ${o.testName}`);
    parts.push('');
  }

  if (input.radiologyOrders.length > 0) {
    parts.push('IMAGING ORDERED:');
    for (const o of input.radiologyOrders) parts.push(`- ${o.imagingType} of ${o.bodyRegion}`);
    parts.push('');
  }

  if (input.followUpInstructions) parts.push(`FOLLOW-UP: ${input.followUpInstructions}\n`);

  try {
    const content = await callOpenAI(PATIENT_SUMMARY_SYSTEM_PROMPT, parts.join('\n'), 0.5, 2000);
    const json = JSON.parse(content) as Record<string, unknown>;

    return {
      title: typeof json.title === 'string' ? json.title : 'Your Consultation Summary',
      whatWeDiscussed: typeof json.whatWeDiscussed === 'string' ? json.whatWeDiscussed : 'Consultation completed.',
      whatWeFound: typeof json.whatWeFound === 'string' ? json.whatWeFound : 'Assessment completed.',
      whatWeDecided: typeof json.whatWeDecided === 'string' ? json.whatWeDecided : 'Treatment plan created.',
      medicationsExplained: Array.isArray(json.medicationsExplained)
        ? json.medicationsExplained.filter((s): s is string => typeof s === 'string')
        : [],
      testsOrdered: Array.isArray(json.testsOrdered)
        ? json.testsOrdered.filter((s): s is string => typeof s === 'string')
        : [],
      nextSteps: typeof json.nextSteps === 'string' ? json.nextSteps : 'Follow your treatment plan.',
      whenToSeeDoctor: typeof json.whenToSeeDoctor === 'string'
        ? json.whenToSeeDoctor
        : 'If your symptoms worsen or you have concerns, contact your GP.',
      disclaimer: DISCLAIMER_TEXT,
    };
  } catch {
    return {
      title: 'Your Consultation Summary',
      whatWeDiscussed: input.subjectiveNote?.slice(0, 300) ?? 'Consultation completed.',
      whatWeFound: input.objectiveNote?.slice(0, 300) ?? 'Assessment completed.',
      whatWeDecided: input.planNote?.slice(0, 300) ?? 'Treatment plan created.',
      medicationsExplained: input.prescriptions.map((p) => `${p.medicationName} — ${p.dosage}, ${p.frequency}`),
      testsOrdered: [
        ...input.pathologyOrders.map((o) => o.testName),
        ...input.radiologyOrders.map((o) => `${o.imagingType} of ${o.bodyRegion}`),
      ],
      nextSteps: input.followUpInstructions ?? 'Follow your treatment plan and attend follow-up appointments.',
      whenToSeeDoctor: 'If you experience worsening symptoms or have concerns, contact your GP.',
      disclaimer: DISCLAIMER_TEXT,
    };
  }
}
