import { resolveOpenAiKey } from '@/lib/openai';

// ── Types ────────────────────────────────────────────────────────────────────

export interface MBSInput {
  consultationType: string;
  duration: number;
  patientAge?: number;
  menopauseStatus?: string;
  mentalHealthScreening?: boolean;
  chronicConditions?: string[];
  newMedicationPrescribed?: boolean;
  carePlanCreated?: boolean;
}

export interface MBSItem {
  itemNumber: string;
  description: string;
  fee: string;
  rationale: string;
}

export interface MBSResult {
  suggestedItems: MBSItem[];
  notes: string;
  totalEstFee: string;
  disclaimer: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const MBS_MODEL = process.env.OPENAI_GP_CHAT_MODEL || 'gpt-4o';

const DISCLAIMER =
  'MBS item suggestions are AI-generated decision support only. The treating GP must independently verify item numbers, fees, and eligibility against the current MBS schedule before billing. Final billing responsibility rests with the GP.';

const SYSTEM_PROMPT = [
  "You are an MBS billing assistant for Australian GPs. Based on the consultation details provided, suggest appropriate MBS item numbers.",
  '',
  'Common menopause-related MBS items:',
  '- Level A (3): Brief consultation <5 min',
  '- Level B (23): Standard consultation 5-20 min ($41.40)',
  '- Level C (36): Long consultation 20-40 min ($80.10)',
  '- Level D (44): Prolonged consultation >40 min ($118.00)',
  '- 701/703/705/707: Health assessment (45-60 min)',
  '- 2700/2701: GP Mental Health Care Plan (20-40 min)',
  '- 2712: Mental Health Care Plan review',
  '- 721/723: GP Management Plan (20-40 min)',
  '- 732: Team Care Arrangements',
  '- 10997: Case conference',
  '',
  'For menopause consultations specifically:',
  '- Long consults (36 or 44) are often appropriate due to complexity',
  '- Consider mental health items if screening (K10/PHQ-9) was done',
  '- Health assessments (701/703/705/707) for patients 45-49 or 75+',
  '- Chronic disease management items for patients with osteoporosis, CVD risk',
  '',
  'Return ONLY valid JSON: { "suggestedItems": [{ "itemNumber": "string", "description": "string", "fee": "string", "rationale": "string" }], "notes": "string", "totalEstFee": "string" }',
].join('\n');

// ── Helpers ──────────────────────────────────────────────────────────────────

interface RawApiResponse {
  suggestedItems?: MBSItem[];
  notes?: string;
  totalEstFee?: string;
}

/**
 * Builds the user prompt from the consultation input data.
 */
function buildUserPrompt(data: MBSInput): string {
  const parts: string[] = ['CONSULTATION DETAILS:'];

  parts.push(`- Consultation type: ${data.consultationType}`);
  parts.push(`- Duration: ${data.duration} minutes`);

  if (data.patientAge !== undefined) {
    parts.push(`- Patient age: ${data.patientAge}`);
  }

  if (data.menopauseStatus) {
    parts.push(`- Menopause status: ${data.menopauseStatus}`);
  }

  if (data.mentalHealthScreening === true) {
    parts.push(`- Mental health screening: Performed (e.g. K10/PHQ-9)`);
  }

  if (data.chronicConditions && data.chronicConditions.length > 0) {
    parts.push(`- Chronic conditions: ${data.chronicConditions.join(', ')}`);
  }

  if (data.newMedicationPrescribed === true) {
    parts.push('- New medication prescribed: Yes');
  }

  if (data.carePlanCreated === true) {
    parts.push('- Care plan created: Yes');
  }

  parts.push('');
  parts.push('Based on the above, suggest the most appropriate MBS item number(s) for this consultation.');
  parts.push('Consider any relevant menopause-specific billing guidance, chronic disease management items, and mental health care plan items.');
  parts.push('');
  parts.push('Return a JSON object with exactly these fields:');
  parts.push('- "suggestedItems": array of objects with "itemNumber", "description", "fee", "rationale"');
  parts.push('- "notes": a string with additional billing guidance or cautions');
  parts.push('- "totalEstFee": the estimated total fee for all suggested items as a string');

  return parts.join('\n');
}

/**
 * Parses and validates the OpenAI JSON response against the MBSResult shape.
 */
function parseResponse(content: string): MBSResult {
  let parsed: RawApiResponse;

  try {
    parsed = JSON.parse(content) as RawApiResponse;
  } catch {
    throw new Error('Failed to parse MBS suggestions response as JSON');
  }

  const suggestedItems: MBSItem[] = Array.isArray(parsed.suggestedItems)
    ? parsed.suggestedItems.map((item) => ({
        itemNumber: typeof item.itemNumber === 'string' ? item.itemNumber : String(item.itemNumber),
        description: typeof item.description === 'string' ? item.description : '',
        fee: typeof item.fee === 'string' ? item.fee : '',
        rationale: typeof item.rationale === 'string' ? item.rationale : '',
      }))
    : [];

  const notes =
    typeof parsed.notes === 'string' && parsed.notes.trim()
      ? parsed.notes.trim()
      : 'No additional notes provided.';

  const totalEstFee =
    typeof parsed.totalEstFee === 'string' && parsed.totalEstFee.trim()
      ? parsed.totalEstFee.trim()
      : 'N/A';

  return {
    suggestedItems,
    notes,
    totalEstFee,
    disclaimer: DISCLAIMER,
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Suggests appropriate MBS item numbers for a GP consultation using GPT-4o.
 *
 * Analyses consultation details (type, duration, patient demographics,
 * menopause status, chronic conditions, mental health screening, etc.)
 * and returns AI-suggested MBS items with rationales.
 *
 * The suggestions are decision support only. The GP must independently
 * verify item numbers, fees, and eligibility against the current MBS
 * schedule before billing.
 *
 * @param consultationData Consult details including type, duration, and
 *                         patient-specific factors
 * @returns                Suggested MBS items with rationales and total estimate
 */
export async function suggestMBSItems(
  consultationData: MBSInput,
): Promise<MBSResult> {
  // ── Validate inputs ──────────────────────────────────────────────────
  if (!consultationData) {
    throw new Error('consultationData is required');
  }

  if (
    !consultationData.consultationType ||
    typeof consultationData.consultationType !== 'string' ||
    !consultationData.consultationType.trim()
  ) {
    throw new Error('consultationType is required');
  }

  if (
    typeof consultationData.duration !== 'number' ||
    consultationData.duration < 0
  ) {
    throw new Error('duration must be a non-negative number');
  }

  if (
    consultationData.patientAge !== undefined &&
    (typeof consultationData.patientAge !== 'number' || consultationData.patientAge < 0)
  ) {
    throw new Error('patientAge must be a non-negative number if provided');
  }

  // ── Resolve API key ──────────────────────────────────────────────────
  const apiKey = await resolveOpenAiKey();
  if (!apiKey) {
    throw new Error(
      'OpenAI API key is not configured. The administrator needs to add an OpenAI API key.',
    );
  }

  // ── Build user prompt ────────────────────────────────────────────────
  const userContent = buildUserPrompt(consultationData);

  // ── Call OpenAI ──────────────────────────────────────────────────────
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MBS_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errorBody = (await response.json()) as {
        error?: { message?: string };
      };
      if (errorBody.error?.message) {
        errorDetail = errorBody.error.message;
      }
    } catch {
      // ignore parse errors
    }
    const message =
      errorDetail || `OpenAI API returned status ${response.status}`;
    throw new Error(`MBS suggestion generation failed: ${message}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string | null } }[];
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content || !content.trim()) {
    throw new Error('MBS suggestion generation returned an empty response.');
  }

  // ── Parse and validate response ──────────────────────────────────────
  const result = parseResponse(content);

  return result;
}


