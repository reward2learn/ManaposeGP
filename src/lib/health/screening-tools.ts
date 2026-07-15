/**
 * Mental Health Screening Tools
 *
 * Pure TypeScript utility functions (no DB, no React) that score standard
 * mental health screening instruments: K10, PHQ-9, GAD-7, Menopause Rating Scale.
 */

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface ScreeningResult {
  screeningType: string;
  score: number;
  maxScore: number;
  interpretation: string;
  severity: string;
}

export interface K10Result extends ScreeningResult {
  screeningType: 'k10';
}

export interface PHQ9Result extends ScreeningResult {
  screeningType: 'phq9';
  suicideRiskFlag: boolean;
}

export interface GAD7Result extends ScreeningResult {
  screeningType: 'gad7';
}

export interface MRSResult extends ScreeningResult {
  screeningType: 'menopause_rating_scale';
  somaticScore: number;
  psychologicalScore: number;
  urogenitalScore: number;
}

// ── Validation Helpers ────────────────────────────────────────────────────────

function validateResponses(
  responses: number[],
  expectedCount: number,
  minValue: number,
  maxValue: number,
  instrumentName: string,
): void {
  if (!Array.isArray(responses)) {
    throw new Error(`${instrumentName}: responses must be an array`);
  }

  if (responses.length !== expectedCount) {
    throw new Error(
      `${instrumentName}: expected ${expectedCount} responses, got ${responses.length}`,
    );
  }

  for (let i = 0; i < responses.length; i++) {
    const val = responses[i];
    if (!Number.isInteger(val) || val < minValue || val > maxValue) {
      throw new Error(
        `${instrumentName}: response ${i + 1} must be an integer between ${minValue} and ${maxValue}, got ${val}`,
      );
    }
  }
}

function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

// ── K10 (Kessler Psychological Distress Scale) ────────────────────────────────

/**
 * Scores the Kessler Psychological Distress Scale (K10).
 *
 * - 10 items, each scored 1–5
 * - Total score range: 10–50
 * - Interpretation:
 *   - 10–19 → low
 *   - 20–24 → mild
 *   - 25–29 → moderate
 *   - 30–50 → severe
 */
export function scoreK10(responses: number[]): K10Result {
  validateResponses(responses, 10, 1, 5, 'K10');

  const score = sum(responses);

  let severity: string;
  let interpretation: string;

  if (score <= 19) {
    severity = 'low';
    interpretation = 'Low psychological distress — likely well.';
  } else if (score <= 24) {
    severity = 'mild';
    interpretation = 'Mild psychological distress — may benefit from support.';
  } else if (score <= 29) {
    severity = 'moderate';
    interpretation =
      'Moderate psychological distress — recommend clinical assessment.';
  } else {
    severity = 'severe';
    interpretation =
      'Severe psychological distress — urgent clinical review recommended.';
  }

  return {
    screeningType: 'k10',
    score,
    maxScore: 50,
    interpretation,
    severity,
  };
}

// ── PHQ-9 (Patient Health Questionnaire) ──────────────────────────────────────

/**
 * Scores the Patient Health Questionnaire (PHQ-9).
 *
 * - 9 items, each scored 0–3
 * - Total score range: 0–27
 * - Item 9 (index 8) assesses self-harm/suicide ideation — if score > 0,
 *   `suicideRiskFlag` is set to `true`.
 * - Depression severity:
 *   - 0–4  → none/minimal
 *   - 5–9  → mild
 *   - 10–14 → moderate
 *   - 15–19 → moderately severe
 *   - 20–27 → severe
 */
export function scorePHQ9(responses: number[]): PHQ9Result {
  validateResponses(responses, 9, 0, 3, 'PHQ-9');

  const score = sum(responses);
  const suicideRiskFlag = responses[8] > 0;

  let severity: string;
  let interpretation: string;

  if (score <= 4) {
    severity = 'none/minimal';
    interpretation =
      'Minimal or no depressive symptoms — continue monitoring.';
  } else if (score <= 9) {
    severity = 'mild';
    interpretation =
      'Mild depression — consider watchful waiting and lifestyle interventions.';
  } else if (score <= 14) {
    severity = 'moderate';
    interpretation =
      'Moderate depression — recommend psychological therapy and/or pharmacotherapy.';
  } else if (score <= 19) {
    severity = 'moderately severe';
    interpretation =
      'Moderately severe depression — active treatment with pharmacotherapy and psychotherapy recommended.';
  } else {
    severity = 'severe';
    interpretation =
      'Severe depression — urgent psychiatric assessment and treatment recommended.';
  }

  return {
    screeningType: 'phq9',
    score,
    maxScore: 27,
    interpretation,
    severity,
    suicideRiskFlag,
  };
}

// ── GAD-7 (Generalized Anxiety Disorder) ──────────────────────────────────────

/**
 * Scores the Generalized Anxiety Disorder scale (GAD-7).
 *
 * - 7 items, each scored 0–3
 * - Total score range: 0–21
 * - Anxiety severity:
 *   - 0–4  → minimal
 *   - 5–9  → mild
 *   - 10–14 → moderate
 *   - 15–21 → severe
 */
export function scoreGAD7(responses: number[]): GAD7Result {
  validateResponses(responses, 7, 0, 3, 'GAD-7');

  const score = sum(responses);

  let severity: string;
  let interpretation: string;

  if (score <= 4) {
    severity = 'minimal';
    interpretation =
      'Minimal anxiety — continue monitoring and healthy coping strategies.';
  } else if (score <= 9) {
    severity = 'mild';
    interpretation =
      'Mild anxiety — consider watchful waiting and psychoeducation.';
  } else if (score <= 14) {
    severity = 'moderate';
    interpretation =
      'Moderate anxiety — recommend psychological therapy and/or pharmacotherapy.';
  } else {
    severity = 'severe';
    interpretation =
      'Severe anxiety — active treatment with pharmacotherapy and psychotherapy recommended.';
  }

  return {
    screeningType: 'gad7',
    score,
    maxScore: 21,
    interpretation,
    severity,
  };
}

// ── MRS (Menopause Rating Scale) ──────────────────────────────────────────────

/**
 * Scores the Menopause Rating Scale (MRS).
 *
 * - 11 items, each scored 0–4 (none → very severe)
 * - 3 subscales:
 *   - Somatic:      items 1–3  (indices 0–2)
 *   - Psychological: items 4–6  (indices 3–5)
 *   - Urogenital:   items 7–11 (indices 6–10)
 * - Total range: 0–44
 * - Severity:
 *   - 0–4   → none
 *   - 5–8   → mild
 *   - 9–15  → moderate
 *   - 16+   → severe
 */
export function scoreMenopauseRatingScale(responses: number[]): MRSResult {
  validateResponses(responses, 11, 0, 4, 'MRS');

  const somaticScore = sum(responses.slice(0, 3));
  const psychologicalScore = sum(responses.slice(3, 6));
  const urogenitalScore = sum(responses.slice(6, 11));
  const score = somaticScore + psychologicalScore + urogenitalScore;

  let severity: string;
  let interpretation: string;

  if (score <= 4) {
    severity = 'none';
    interpretation =
      'No significant menopausal symptoms — continue routine monitoring.';
  } else if (score <= 8) {
    severity = 'mild';
    interpretation =
      'Mild menopausal symptoms — lifestyle modifications and monitoring.';
  } else if (score <= 15) {
    severity = 'moderate';
    interpretation =
      'Moderate menopausal symptoms — consider hormone therapy and targeted interventions.';
  } else {
    severity = 'severe';
    interpretation =
      'Severe menopausal symptoms — comprehensive evaluation and active treatment recommended.';
  }

  return {
    screeningType: 'menopause_rating_scale',
    score,
    maxScore: 44,
    interpretation,
    severity,
    somaticScore,
    psychologicalScore,
    urogenitalScore,
  };
}
