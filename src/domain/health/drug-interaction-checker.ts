import type { DbClient } from '@/lib/db';
import { resolveOpenAiKey } from '@/lib/openai';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DrugInteraction {
  pair: string[];
  severity: 'CONTRAINDICATED' | 'MAJOR' | 'MODERATE' | 'MINOR';
  mechanism: string;
  consequences: string;
  recommendation: string;
  source: string;
}

export interface DrugInteractionResult {
  interactions: DrugInteraction[];
  noInteractionsFound: boolean;
  disclaimer: string;
  medicationsChecked: string[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const DRUG_INTERACTION_MODEL = 'gpt-4o';

const VALID_SEVERITIES = new Set<string>([
  'CONTRAINDICATED',
  'MAJOR',
  'MODERATE',
  'MINOR',
]);

const DISCLAIMER =
  'This is an AI-assisted analysis. Always verify with the TGA ARTG, AMH, and your clinical judgment. Final prescribing decisions remain the GP\'s responsibility.';

// ── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a clinical pharmacology assistant for Australian GPs.
Check the following medications for potential drug interactions.

For each identified interaction, provide:
- The pair of medications involved
- Severity: CONTRAINDICATED / MAJOR / MODERATE / MINOR
- Mechanism of interaction
- Clinical consequences
- Management recommendation
- Reference source (e.g., AMS guidelines, TGA PI, Stockley's)

If MHT (estradiol, progesterone, etc.) is in the list, pay special attention to:
- CYP450 enzyme interactions
- Effects on MHT efficacy
- Thrombosis risk with concurrent medications

Return as JSON: { "interactions": [...], "noInteractionsFound": false }
If no interactions found: { "noInteractionsFound": true, "message": "No clinically significant interactions identified between these medications." }`;

// ── Raw API types ────────────────────────────────────────────────────────────

interface RawInteraction {
  pair?: string[] | unknown;
  severity?: string | unknown;
  mechanism?: string | unknown;
  consequences?: string | unknown;
  recommendation?: string | unknown;
  source?: string | unknown;
  [key: string]: unknown;
}

interface RawApiResponse {
  interactions?: RawInteraction[] | unknown;
  noInteractionsFound?: boolean | unknown;
  message?: string | unknown;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validates that a raw interaction object has the expected shape and coerces
 * it to a DrugInteraction.
 */
function parseRawInteraction(raw: RawInteraction): DrugInteraction | null {
  const pair = Array.isArray(raw.pair) && raw.pair.length === 2
    && typeof raw.pair[0] === 'string'
    && typeof raw.pair[1] === 'string'
    ? (raw.pair as [string, string])
    : null;

  if (!pair) return null;

  const severity = typeof raw.severity === 'string' && VALID_SEVERITIES.has(raw.severity)
    ? (raw.severity as DrugInteraction['severity'])
    : null;

  if (!severity) return null;

  const mechanism = typeof raw.mechanism === 'string' && raw.mechanism.trim().length > 0
    ? raw.mechanism.trim()
    : '';

  const consequences = typeof raw.consequences === 'string' && raw.consequences.trim().length > 0
    ? raw.consequences.trim()
    : '';

  const recommendation = typeof raw.recommendation === 'string' && raw.recommendation.trim().length > 0
    ? raw.recommendation.trim()
    : '';

  const source = typeof raw.source === 'string' && raw.source.trim().length > 0
    ? raw.source.trim()
    : '';

  return {
    pair: [...pair],
    severity,
    mechanism,
    consequences,
    recommendation,
    source,
  };
}

/**
 * Parses and validates the JSON response from OpenAI.
 */
function parseOpenAiResponse(content: string, medications: string[]): DrugInteractionResult {
  let parsed: RawApiResponse;

  try {
    parsed = JSON.parse(content) as RawApiResponse;
  } catch {
    throw new Error('Failed to parse drug interaction response as JSON');
  }

  const noInteractionsFound = parsed.noInteractionsFound === true || parsed.noInteractionsFound === false
    ? parsed.noInteractionsFound
    : false;

  if (noInteractionsFound) {
    return {
      interactions: [],
      noInteractionsFound: true,
      disclaimer: DISCLAIMER,
      medicationsChecked: [...medications],
    };
  }

  const raw = Array.isArray(parsed.interactions) ? parsed.interactions : [];

  const interactions: DrugInteraction[] = [];
  for (const item of raw) {
    const parsedInteraction = parseRawInteraction(item);
    if (parsedInteraction) {
      interactions.push(parsedInteraction);
    }
  }

  return {
    interactions,
    noInteractionsFound: interactions.length === 0,
    disclaimer: DISCLAIMER,
    medicationsChecked: [...medications],
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Checks for potential drug interactions between a list of medications using
 * GPT-4o, with special attention to MHT (menopausal hormone therapy) interactions.
 *
 * @param db           Database client (required for structural consistency with
 *                     other health domain services; not used directly by this
 *                     service but enables future logging/audit at the same
 *                     call site)
 * @param medications  Array of medication names to check (e.g. ["estradiol", "venlafaxine"])
 * @returns            Structured result with interactions or no-interactions-found
 */
export async function checkInteractions(
  _db: DbClient,
  medications: string[],
): Promise<DrugInteractionResult> {
  if (!medications || medications.length === 0) {
    throw new Error('At least one medication name is required');
  }

  if (medications.length > 10) {
    throw new Error('Maximum 10 medications can be checked at once');
  }

  const validMeds = medications
    .map((m) => m.trim())
    .filter((m) => m.length > 0);

  if (validMeds.length === 0) {
    throw new Error('No valid medication names provided');
  }

  // Handle single medication — no interactions possible
  if (validMeds.length === 1) {
    return {
      interactions: [],
      noInteractionsFound: true,
      disclaimer: DISCLAIMER,
      medicationsChecked: [...validMeds],
    };
  }

  const apiKey = await resolveOpenAiKey();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const medList = validMeds.join(', ');
  const userContent = `Check the following medications for potential drug interactions: ${medList}.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DRUG_INTERACTION_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    let detail = 'OpenAI API error';
    try {
      const errBody = await response.json() as { error?: { message?: string } };
      if (errBody.error?.message) detail = errBody.error.message;
    } catch {
      // ignore parse failure
    }
    throw new Error(`OpenAI API returned ${response.status}: ${detail}`);
  }

  const data = await response.json() as {
    choices?: { message?: { content?: string } }[];
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI returned an empty response');
  }

  return parseOpenAiResponse(content, validMeds);
}
