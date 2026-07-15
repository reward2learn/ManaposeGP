import type { DbClient } from '@/lib/db';
import { resolveOpenAiKey } from '@/lib/openai';

// ── Types ──────────────────────────────────────────────────────────────────

export interface GpSummary {
  overview: string;
  symptomHighlights: string[];
  metricTrends: string[];
  medicationNotes: string[];
  screeningAlerts: string[];
  suggestedDiscussionPoints: string[];
  urgency: 'routine' | 'attention' | 'urgent';
  generatedAt: string;
}

export interface InvestigationSuggestion {
  type: 'pathology' | 'radiology';
  testName: string;
  category?: string;
  imagingType?: string;
  bodyRegion?: string;
  clinicalRationale: string;
  urgency: 'ROUTINE' | 'URGENT' | 'STAT';
}

// ── Constants ──────────────────────────────────────────────────────────────

const SUMMARY_MODEL = process.env.OPENAI_GP_CHAT_MODEL || 'gpt-4o';

const SUMMARY_SYSTEM_PROMPT = [
  'You are an AI clinical summarizer for Australian GPs specialising in menopause and women\'s health.',
  'Generate a structured pre-consultation summary from the provided patient data.',
  '',
  'Your response must be valid JSON with exactly these fields:',
  '- overview: A 2-3 sentence summary of the patient\'s current health status.',
  '- symptomHighlights: Array of 2-5 key symptom observations (mention type, trend, severity).',
  '- metricTrends: Array of 1-3 notable health metric trends (e.g. "Sleep duration declined 15% over 14 days").',
  '- medicationNotes: Array of 1-3 medication observations (adherence concerns, new medications, interactions).',
  '- screeningAlerts: Array of 0-3 screening results requiring follow-up.',
  '- suggestedDiscussionPoints: Array of 3-5 specific topics the GP should discuss.',
  '- urgency: One of "routine", "attention", or "urgent" based on the data.',
  '',
  'If no data is available for a section, return an empty array.',
  'Be concise and clinically relevant. Flag anything requiring urgent attention.',
].join('\n');

const INVESTIGATIONS_SYSTEM_PROMPT = [
  'You are an AI clinical decision support tool for Australian GPs specialising in menopause and women\'s health.',
  'Based on the patient\'s profile, symptoms, and clinical notes, suggest relevant pathology and radiology investigations.',
  '',
  'Your response must be valid JSON with a single field "suggestions" — an array of objects with:',
  '- type: "pathology" or "radiology"',
  '- testName: The specific test (e.g. "FBE, EUC, LFT", "Iron Studies", "Pelvic Ultrasound")',
  '- category: (pathology only) HAEMATOLOGY, BIOCHEMISTRY, HORMONES, etc.',
  '- imagingType: (radiology only) XRAY, ULTRASOUND, CT, MRI, MAMMOGRAM, DEXA, etc.',
  '- bodyRegion: (radiology only) HEAD, CHEST, ABDOMEN, SPINE, PELVIS, etc.',
  '- clinicalRationale: 1-2 sentences explaining why this test is indicated.',
  '- urgency: ROUTINE, URGENT, or STAT',
  '',
  'Consider: Australian clinical guidelines (RACGP, Jean Hailes, AMS), menopause status, age, symptoms, chronic conditions, medications.',
  'Suggest only clinically appropriate tests. Do NOT suggest unnecessary investigations.',
  'Return 0-6 suggestions. If no investigations are clearly indicated, return an empty array.',
].join('\n');

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

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
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: SUMMARY_MODEL,
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
    try {
      const err = await response.json() as { error?: { message?: string } };
      detail = err.error?.message ?? '';
    } catch { /* ignore */ }
    throw new Error(`OpenAI API error ${response.status}${detail ? `: ${detail}` : ''}`);
  }

  const data = await response.json() as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content?.trim()) throw new Error('OpenAI returned an empty response.');
  return content.trim();
}

// ── Public API: generateGpSummary ──────────────────────────────────────────

export async function generateGpSummary(
  db: DbClient,
  patientId: string,
): Promise<GpSummary> {
  if (!patientId) throw new Error('patientId is required');

  // ── Fetch patient context ────────────────────────────────────────────
  const profile = await db.healthProfile.findUnique({
    where: { id: patientId },
  });

  if (!profile) throw new Error('Health profile not found');

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [symptoms, metrics, medications, screenings, consultations] = await Promise.all([
    db.symptomJournal.findMany({
      where: { healthProfileId: patientId, date: { gte: ninetyDaysAgo } },
      orderBy: { date: 'desc' },
    }),
    db.healthMetric.findMany({
      where: { healthProfileId: patientId },
      orderBy: { recordedAt: 'desc' },
      take: 30,
    }),
    db.medication.findMany({
      where: { healthProfileId: patientId, status: 'ACTIVE' },
    }),
    db.screeningResult.findMany({
      where: { healthProfileId: patientId },
      orderBy: { completedAt: 'desc' },
      take: 5,
    }),
    db.gPConsultation.findMany({
      where: { patientId },
      orderBy: { date: 'desc' },
      take: 5,
    }),
  ]);

  // ── Build prompt ─────────────────────────────────────────────────────
  const parts: string[] = [];

  // Demographics
  parts.push('PATIENT PROFILE:');
  if (profile.dateOfBirth) {
    const age = Math.floor((Date.now() - profile.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    parts.push(`- Age: ${age}`);
  }
  if (profile.menopauseStatus) parts.push(`- Menopause status: ${profile.menopauseStatus}`);
  if (profile.sexAtBirth) parts.push(`- Sex at birth: ${profile.sexAtBirth}`);
  if (profile.chronicConditions.length) parts.push(`- Chronic conditions: ${profile.chronicConditions.join(', ')}`);
  if (profile.allergies.length) parts.push(`- Allergies: ${profile.allergies.join(', ')}`);
  if (profile.smokingStatus) parts.push(`- Smoking: ${profile.smokingStatus}`);

  // Symptoms
  if (symptoms.length > 0) {
    parts.push('\nRECENT SYMPTOMS (last 90 days):');
    for (const s of symptoms.slice(0, 30)) {
      parts.push(`- ${formatDate(s.date)}: ${s.symptomType} (severity ${s.severity}/10)${s.notes ? ` — ${s.notes}` : ''}`);
    }
  }

  // Metrics
  if (metrics.length > 0) {
    parts.push('\nHEALTH METRICS (last 30 entries):');
    for (const m of metrics) {
      const v = typeof m.value === 'object' ? JSON.stringify(m.value) : String(m.value);
      parts.push(`- ${m.metricType}: ${v}${m.unit ? ` ${m.unit}` : ''} (${m.recordedAt.toISOString()})`);
    }
  }

  // Medications
  if (medications.length > 0) {
    parts.push('\nACTIVE MEDICATIONS:');
    for (const m of medications) {
      parts.push(`- ${m.name}: ${m.dosage}, ${m.frequency} (started ${formatDate(m.startDate)})`);
    }
  }

  // Screenings
  if (screenings.length > 0) {
    parts.push('\nRECENT SCREENINGS:');
    for (const s of screenings) {
      parts.push(`- ${s.screeningType}: score ${s.score} — ${s.interpretation} (${s.severity ?? 'N/A'})`);
    }
  }

  // Past consultations
  if (consultations.length > 0) {
    parts.push('\nRECENT CONSULTATIONS:');
    for (const c of consultations) {
      parts.push(`- ${formatDate(c.date)}: ${c.consultationType} — ${c.summary}`);
    }
  }

  parts.push('\nGenerate a structured GP pre-consultation summary from the above data.');
  parts.push('Return ONLY valid JSON matching the GpSummary schema.');

  // ── Call OpenAI ──────────────────────────────────────────────────────
  const content = await callOpenAI(SUMMARY_SYSTEM_PROMPT, parts.join('\n'));

  // ── Parse response ───────────────────────────────────────────────────
  let parsed: GpSummary;
  try {
    const json = JSON.parse(content) as Record<string, unknown>;
    parsed = {
      overview: typeof json.overview === 'string' ? json.overview : 'No overview generated.',
      symptomHighlights: Array.isArray(json.symptomHighlights) ? json.symptomHighlights.filter((s): s is string => typeof s === 'string') : [],
      metricTrends: Array.isArray(json.metricTrends) ? json.metricTrends.filter((s): s is string => typeof s === 'string') : [],
      medicationNotes: Array.isArray(json.medicationNotes) ? json.medicationNotes.filter((s): s is string => typeof s === 'string') : [],
      screeningAlerts: Array.isArray(json.screeningAlerts) ? json.screeningAlerts.filter((s): s is string => typeof s === 'string') : [],
      suggestedDiscussionPoints: Array.isArray(json.suggestedDiscussionPoints) ? json.suggestedDiscussionPoints.filter((s): s is string => typeof s === 'string') : [],
      urgency: (json.urgency === 'routine' || json.urgency === 'attention' || json.urgency === 'urgent') ? json.urgency : 'routine',
      generatedAt: new Date().toISOString(),
    };
  } catch {
    parsed = {
      overview: content.slice(0, 500),
      symptomHighlights: [],
      metricTrends: [],
      medicationNotes: [],
      screeningAlerts: [],
      suggestedDiscussionPoints: [],
      urgency: 'routine',
      generatedAt: new Date().toISOString(),
    };
  }

  return parsed;
}

// ── Public API: suggestInvestigations ──────────────────────────────────────

export async function suggestInvestigations(
  db: DbClient,
  patientId: string,
  notes?: string,
): Promise<InvestigationSuggestion[]> {
  if (!patientId) throw new Error('patientId is required');

  // ── Fetch patient context ────────────────────────────────────────────
  const profile = await db.healthProfile.findUnique({ where: { id: patientId } });
  if (!profile) throw new Error('Health profile not found');

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [symptoms, medications] = await Promise.all([
    db.symptomJournal.findMany({
      where: { healthProfileId: patientId, date: { gte: thirtyDaysAgo } },
      orderBy: { date: 'desc' },
      take: 30,
    }),
    db.medication.findMany({
      where: { healthProfileId: patientId, status: 'ACTIVE' },
    }),
  ]);

  // ── Build prompt ─────────────────────────────────────────────────────
  const parts: string[] = [];

  parts.push('PATIENT CONTEXT:');
  if (profile.dateOfBirth) {
    const age = Math.floor((Date.now() - profile.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    parts.push(`- Age: ${age}`);
  }
  if (profile.menopauseStatus) parts.push(`- Menopause status: ${profile.menopauseStatus}`);
  if (profile.sexAtBirth) parts.push(`- Sex at birth: ${profile.sexAtBirth}`);
  if (profile.chronicConditions.length) parts.push(`- Chronic conditions: ${profile.chronicConditions.join(', ')}`);
  if (profile.allergies.length) parts.push(`- Allergies: ${profile.allergies.join(', ')}`);

  if (symptoms.length > 0) {
    parts.push('\nRECENT SYMPTOMS (30 days):');
    for (const s of symptoms) {
      parts.push(`- ${formatDate(s.date)}: ${s.symptomType} (severity ${s.severity}/10)`);
    }
  }

  if (medications.length > 0) {
    parts.push('\nACTIVE MEDICATIONS:');
    for (const m of medications) {
      parts.push(`- ${m.name}: ${m.dosage}, ${m.frequency}`);
    }
  }

  if (notes?.trim()) {
    parts.push(`\nGP CLINICAL NOTES:\n${notes.trim()}`);
  }

  parts.push('\nSuggest appropriate investigations based on the above clinical picture.');
  parts.push('Return ONLY valid JSON with a "suggestions" array.');

  // ── Call OpenAI ──────────────────────────────────────────────────────
  const content = await callOpenAI(INVESTIGATIONS_SYSTEM_PROMPT, parts.join('\n'), 0.3, 1500);

  // ── Parse response ───────────────────────────────────────────────────
  try {
    const json = JSON.parse(content) as { suggestions?: InvestigationSuggestion[] };
    if (Array.isArray(json.suggestions)) {
      return json.suggestions.filter(
        (s): s is InvestigationSuggestion =>
          typeof s === 'object' &&
          (s.type === 'pathology' || s.type === 'radiology') &&
          typeof s.testName === 'string' &&
          s.testName.trim() !== '',
      );
    }
  } catch { /* fall through */ }

  return [];
}
