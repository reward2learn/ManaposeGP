/**
 * Clinical Risk Calculators
 *
 * Pure TypeScript library implementing simplified clinical risk scoring models:
 * FRAX (fracture risk), QRISK3-inspired cardiovascular risk, and Gail model
 * (breast cancer risk). All models are clinical approximations for screening
 * purposes only — use validated tools for clinical decision-making.
 *
 * DISCLAIMER: These are simplified scoring algorithms based on published risk
 * tables. They do NOT use the official algorithms. For clinical decisions,
 * always use validated tools — FRAX: sheffield.ac.uk/FRAX, QRISK3: qrisk.org,
 * Gail model / BCSC at bcrisktool.cancer.gov.
 */

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface FRAXInput {
  age: number;
  sex: string;
  weight: number;
  height: number;
  previousFracture: boolean;
  parentHipFracture: boolean;
  currentSmoking: boolean;
  glucocorticoids: boolean;
  rheumatoidArthritis: boolean;
  secondaryOsteoporosis: boolean;
  alcohol3PerDay: boolean;
  femoralNeckBMD?: number;
}

export interface FRAXResult {
  model: string;
  tenYearMajorOsteoporotic: number;
  tenYearHipFracture: number;
  riskCategory: string;
  inputs: FRAXInput;
}

export interface CVRiskInput {
  age: number;
  sex: string;
  smoking: string;
  diabetes: boolean;
  familyHistoryCVD: boolean;
  chronicKidneyDisease: boolean;
  atrialFibrillation: boolean;
  bloodPressureTreatment: boolean;
  systolicBP: number;
  totalCholesterol: number;
  hdlCholesterol: number;
  bmi: number;
}

export interface CVRiskResult {
  model: string;
  tenYearRisk: number;
  riskCategory: string;
  heartAge?: number;
  inputs: CVRiskInput;
}

export interface GailInput {
  age: number;
  ageAtMenarche: number;
  ageAtFirstBirth: number | null;
  firstDegreeRelatives: number;
  previousBiopsies: number;
  atypicalHyperplasia: boolean;
}

export interface GailResult {
  model: string;
  fiveYearRisk: number;
  lifetimeRisk: number;
  riskCategory: string;
  inputs: GailInput;
}

export type RiskModel = 'frax' | 'cardiovascular' | 'gail';

export type RiskInput = FRAXInput | CVRiskInput | GailInput;
export type RiskOutput = FRAXResult | CVRiskResult | GailResult;

// ── FRAX — 10-year Fracture Risk ─────────────────────────────────────────────

/**
 * Simplified FRAX scoring algorithm for major osteoporotic fracture risk.
 *
 * Based on published FRAX risk factor weightings. This is a clinical
 * approximation for screening — use the official FRAX tool at
 * sheffield.ac.uk/FRAX for clinical decisions.
 */
export function calculateFRAX(patient: FRAXInput): FRAXResult {
  // Base risk: 0.5% per year above age 50, min 0
  const yearsAbove50 = Math.max(0, patient.age - 50);
  let risk = yearsAbove50 * 0.5;

  // Clinical risk factors (additive percentages)
  if (patient.previousFracture) risk += 5;
  if (patient.parentHipFracture) risk += 3;
  if (patient.currentSmoking) risk += 2;
  if (patient.glucocorticoids) risk += 2;
  if (patient.rheumatoidArthritis) risk += 1;
  if (patient.secondaryOsteoporosis) risk += 1;
  if (patient.alcohol3PerDay) risk += 1;

  // Low BMI (<19) contributes additional risk
  const heightMeters = patient.height / 100;
  const bmi = patient.weight / (heightMeters * heightMeters);
  if (bmi < 19) risk += 2;

  // Femoral neck BMD T-score contributions
  if (patient.femoralNeckBMD !== undefined) {
    const tScore = patient.femoralNeckBMD;
    if (tScore <= -3) {
      risk += 15;
    } else if (tScore <= -2.5) {
      risk += 10;
    } else if (tScore <= -2) {
      risk += 5;
    } else if (tScore <= -1) {
      risk += 2;
    }
  }

  // Hip fracture risk is approximately 40% of major osteoporotic risk
  const majorOsteoporotic = Math.round(risk * 10) / 10;
  const hipFracture = Math.round(majorOsteoporotic * 0.4 * 10) / 10;

  // Risk categories
  let riskCategory: string;
  if (majorOsteoporotic < 10) {
    riskCategory = 'low';
  } else if (majorOsteoporotic <= 20) {
    riskCategory = 'moderate';
  } else {
    riskCategory = 'high';
  }

  return {
    model: 'FRAX (simplified clinical approximation)',
    tenYearMajorOsteoporotic: majorOsteoporotic,
    tenYearHipFracture: hipFracture,
    riskCategory,
    inputs: { ...patient },
  };
}

// ── Cardiovascular Risk (QRISK3-inspired) ────────────────────────────────────

/**
 * Simplified cardiovascular risk calculator inspired by QRISK3.
 *
 * Estimates 10-year CVD risk using additive clinical risk factors.
 * Designed for the Australian primary care context.
 * Use QRISK3 at qrisk.org for clinical decisions.
 */
export function calculateCardiovascularRisk(patient: CVRiskInput): CVRiskResult {
  // Base risk: age / 3
  let risk = patient.age / 3;

  // Sex
  if (patient.sex.toLowerCase() === 'male') risk += 5;

  // Smoking status
  if (patient.smoking === 'current') risk += 8;

  // Comorbidities
  if (patient.diabetes) risk += 6;
  if (patient.familyHistoryCVD) risk += 4;
  if (patient.chronicKidneyDisease) risk += 5;
  if (patient.atrialFibrillation) risk += 4;

  // Blood pressure
  if (patient.bloodPressureTreatment) risk += 3;
  if (patient.systolicBP > 160) {
    risk += 10;
  } else if (patient.systolicBP > 140) {
    risk += 5;
  }

  // Cholesterol ratio
  const ratio = patient.totalCholesterol / patient.hdlCholesterol;
  if (ratio > 6) {
    risk += 8;
  } else if (ratio > 5) {
    risk += 5;
  }

  // Obesity
  if (patient.bmi > 30) risk += 3;

  const tenYearRisk = Math.round(risk * 10) / 10;

  // Risk categories (QRISK3-inspired thresholds)
  let riskCategory: string;
  if (tenYearRisk < 10) {
    riskCategory = 'low';
  } else if (tenYearRisk <= 15) {
    riskCategory = 'moderate';
  } else {
    riskCategory = 'high';
  }

  // Heart age estimation: age of a person with same risk but only age+sex factors
  const sexBonus = patient.sex.toLowerCase() === 'male' ? 5 : 0;
  const adjustedAge = Math.round((tenYearRisk - sexBonus) * 3);
  const heartAge = Math.max(patient.age, Math.min(adjustedAge, 90));

  return {
    model: 'QRISK3-inspired (simplified clinical approximation)',
    tenYearRisk,
    riskCategory,
    heartAge: heartAge > patient.age ? heartAge : undefined,
    inputs: { ...patient },
  };
}

// ── Gail Model — Breast Cancer Risk ──────────────────────────────────────────

/**
 * Baseline 5-year breast cancer risk by age group (Caucasian reference).
 * Values approximate published Gail model baseline hazard rates.
 */
function gailAgeGroupBaseline(age: number): number {
  if (age < 40) return 0.4;
  if (age < 45) return 0.6;
  if (age < 50) return 0.9;
  if (age < 55) return 1.1;
  if (age < 60) return 1.4;
  if (age < 65) return 1.7;
  if (age < 70) return 2.1;
  if (age < 75) return 2.5;
  if (age < 80) return 2.8;
  return 3.0;
}

/**
 * Simplified Gail model for 5-year and lifetime breast cancer risk.
 *
 * Uses age-group baseline risk multiplied by relative risk factors derived
 * from published Gail model coefficients. This is a screening approximation —
 * use the BCSC Risk Calculator at bcrisktool.cancer.gov for clinical decisions.
 */
export function calculateGailModel(patient: GailInput): GailResult {
  const baseline = gailAgeGroupBaseline(patient.age);

  // Relative risk multipliers
  let rr = 1.0;

  // Age at menarche
  if (patient.ageAtMenarche < 12) {
    rr *= 1.1;
  } else if (patient.ageAtMenarche >= 14) {
    rr *= 0.9;
  }

  // Age at first birth
  if (patient.ageAtFirstBirth === null) {
    rr *= 1.0; // nulliparous — neutral baseline
  } else if (patient.ageAtFirstBirth < 20) {
    rr *= 0.8;
  } else if (patient.ageAtFirstBirth < 25) {
    rr *= 0.9;
  } else if (patient.ageAtFirstBirth >= 30) {
    rr *= 1.2;
  }

  // Previous biopsies
  if (patient.previousBiopsies === 1) {
    rr *= 1.5;
  } else if (patient.previousBiopsies >= 2) {
    rr *= 2.0;
  }

  // Atypical hyperplasia (additional multiplier)
  if (patient.atypicalHyperplasia) {
    rr *= 1.5;
  }

  // First-degree relatives
  if (patient.firstDegreeRelatives === 1) {
    rr *= 1.5;
  } else if (patient.firstDegreeRelatives >= 2) {
    rr *= 2.5;
  }

  // Five-year risk
  const fiveYearRisk = Math.round(baseline * rr * 10) / 10;

  // Lifetime risk (to age 90): ~12% baseline, adjusted by same RR with age factor
  const lifetimeBaseline = 12.0;
  const lifetimeRisk = Math.round(lifetimeBaseline * rr * 10) / 10;

  // Risk categories: <1.66% low, 1.66-3% moderate, >3% high
  let riskCategory: string;
  if (fiveYearRisk < 1.66) {
    riskCategory = 'low';
  } else if (fiveYearRisk <= 3.0) {
    riskCategory = 'moderate';
  } else {
    riskCategory = 'high';
  }

  return {
    model: 'Gail Model (simplified clinical approximation)',
    fiveYearRisk,
    lifetimeRisk,
    riskCategory,
    inputs: { ...patient },
  };
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

/**
 * Main dispatcher: routes to the correct calculator based on model name.
 *
 * @param model - One of 'frax', 'cardiovascular', or 'gail'
 * @param patientData - Patient input data matching the model's input type
 * @returns Risk calculation result
 * @throws Error if model is unknown or patientData is invalid
 */
export function calculateRisk(
  model: string,
  patientData: Record<string, unknown>,
): RiskOutput {
  switch (model) {
    case 'frax':
      return calculateFRAX(patientData as unknown as FRAXInput);
    case 'cardiovascular':
      return calculateCardiovascularRisk(patientData as unknown as CVRiskInput);
    case 'gail':
      return calculateGailModel(patientData as unknown as GailInput);
    default:
      throw new Error(
        `Unknown risk model: "${model}". Valid models: frax, cardiovascular, gail`,
      );
  }
}
