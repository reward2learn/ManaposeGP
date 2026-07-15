import type { DbClient } from '@/lib/db';
import { getConsentedPatients } from '@/domain/health/consent-service';
import type { ConsentedPatient } from '@/domain/health/consent-service';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PopulationAnalytics {
  panelSize: number;
  activePatients: number;
  demographics: {
    menopauseStatusDistribution: Record<string, number>;
    averageAge: number;
  };
  symptoms: {
    topSymptoms: { type: string; prevalence: string; avgSeverity: number }[];
    averageDailySeverity: number;
  };
  treatments: {
    mhtPrescriptionRate: string;
    antidepressantRate: string;
    supplementRate: string;
  };
  screening: {
    k10CompletionRate: string;
    phq9CompletionRate: string;
  };
  engagement: {
    averageEntriesPerWeek: number;
    averageLoggingStreakDays: number;
  };
  riskProfile: {
    highFractureRiskPct: string;
    highCvdRiskPct: string;
  };
  timeToCare: {
    averageDaysToFirstConsult: number;
  };
  generatedAt: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const ANTIDEPRESSANT_KEYWORDS = new Set([
  'fluoxetine', 'sertraline', 'paroxetine', 'citalopram', 'escitalopram',
  'venlafaxine', 'desvenlafaxine', 'duloxetine',
  'mirtazapine', 'bupropion', 'amitriptyline', 'nortriptyline',
  'clomipramine', 'doxepin', 'imipramine', 'phenelzine', 'tranylcypromine',
  'vortioxetine', 'agomelatine', 'reboxetine', 'fluvoxamine',
]);

const CVD_CHRONIC_KEYWORDS = new Set([
  'hypertension', 'high blood pressure', 'heart disease', 'cardiovascular disease',
  'coronary artery disease', 'cad', 'chd', 'arrhythmia', 'atrial fibrillation',
  'afib', 'stroke', 'tia', 'transient ischemic attack', 'diabetes',
  'type 2 diabetes', 'type 1 diabetes', 'hyperlipidemia', 'high cholesterol',
  'peripheral artery disease', 'heart failure', 'myocardial infarction',
]);

const CVD_FAMILY_KEYWORDS = new Set([
  'cvd', 'cardiovascular', 'heart', 'cardiac', 'stroke', 'mi',
  'myocardial', 'coronary', 'hypertension', 'cholesterol',
]);

const FRACTURE_RISK_CONDITIONS = new Set([
  'osteoporosis', 'osteopenia', 'low bone density', 'bone loss',
  'fracture', 'hip fracture', 'vertebral fracture',
]);

const FRACTURE_FAMILY_KEYWORDS = new Set([
  'osteoporosis', 'fracture', 'bone', 'hip',
]);

const FRACTURE_MED_KEYWORDS = new Set([
  'alendronate', 'risedronate', 'zoledronic', 'denosumab', 'prolia',
  'teriparatide', 'forteo', 'raloxifene', 'evista', 'calcitonin',
  'ibandronate', 'romosozumab',
]);

const ACTIVE_DAYS_WINDOW = 30;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Formats a number as a percentage string with 1 decimal place, e.g. "45.2%". */
function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** Rounds a number to 1 decimal place. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Rounds a number to 2 decimal places. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Returns today's date at midnight UTC. */
function today(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Returns a date `days` days ago at midnight UTC. */
function daysAgo(days: number): Date {
  const d = today();
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

/** Computes age in years from a Date. Returns null if invalid. */
function computeAge(dateOfBirth: Date): number {
  const now = new Date();
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < dateOfBirth.getUTCDate())) {
    age -= 1;
  }
  return age;
}

/**
 * Computes the longest consecutive-day streak from an array of dates
 * (sorted ascending, each a Date at midnight).
 */
function computeLoggingStreak(dates: Date[]): number {
  if (dates.length === 0) return 0;

  const uniqueDays = new Set<string>();
  for (const d of dates) {
    uniqueDays.add(d.toISOString().slice(0, 10));
  }

  const sorted = [...uniqueDays].sort();
  let longestStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diffDays = (curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000);

    if (diffDays === 1) {
      currentStreak += 1;
      if (currentStreak > longestStreak) {
        longestStreak = currentStreak;
      }
    } else {
      currentStreak = 1;
    }
  }

  return longestStreak;
}

/**
 * Checks if a string matches any of the given keywords (case-insensitive,
 * checks for substring presence in the lowercase normalized input).
 */
function containsKeyword(text: string, keywords: Set<string>): boolean {
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    if (lower.includes(kw)) return true;
  }
  return false;
}

// ── Risk derivations ─────────────────────────────────────────────────────────

interface RiskFlags {
  isHighCvdRisk: boolean;
  isHighFractureRisk: boolean;
}

/**
 * Derives cardiovascular and fracture risk flags from a patient's health profile,
 * medications list, and screening results.
 *
 * Since there is no dedicated RiskAssessment table, risk is inferred from:
 * - HealthProfile: smokingStatus, chronicConditions, familyHistory, menopauseStatus, currentMedications
 * - Medication records: type/name matching
 * - ScreeningResult records: severity level
 */
function deriveRiskFlags(
  profile: {
    smokingStatus: string | null;
    chronicConditions: string[];
    familyHistory: unknown;
    menopauseStatus: string | null;
    currentMedications: string[];
  },
  medicationNames: string[],
  screeningSeverities: string[],
): RiskFlags {
  // ── High CVD risk ───────────────────────────────────────────────────
  let isHighCvdRisk = false;

  // Smoking status
  if (profile.smokingStatus === 'current') {
    isHighCvdRisk = true;
  }

  // Chronic conditions containing CVD keywords
  if (!isHighCvdRisk) {
    for (const condition of profile.chronicConditions) {
      if (containsKeyword(condition, CVD_CHRONIC_KEYWORDS)) {
        isHighCvdRisk = true;
        break;
      }
    }
  }

  // Family history mentioning CVD
  if (!isHighCvdRisk && profile.familyHistory) {
    const fhStr =
      typeof profile.familyHistory === 'string'
        ? profile.familyHistory
        : JSON.stringify(profile.familyHistory);
    if (containsKeyword(fhStr, CVD_FAMILY_KEYWORDS)) {
      isHighCvdRisk = true;
    }
  }

  // CVD-related medications (statins, antihypertensives, anticoagulants)
  if (!isHighCvdRisk) {
    for (const med of medicationNames) {
      const lower = med.toLowerCase();
      if (
        lower.includes('statin') ||
        lower.includes('sartan') ||
        lower.includes('pril') || // ACE inhibitors
        lower.includes('beta') ||
        lower.includes('blocker') ||
        lower.includes('calcium') ||
        lower.includes('warfarin') ||
        lower.includes('apixaban') ||
        lower.includes('rivaroxaban') ||
        lower.includes('dabigatran') ||
        lower.includes('clopidogrel') ||
        lower.includes('aspirin') ||
        lower.includes('atorvastatin') ||
        lower.includes('rosuvastatin') ||
        lower.includes('simvastatin') ||
        lower.includes('metformin')
      ) {
        isHighCvdRisk = true;
        break;
      }
    }
  }

  // Screening severity = 'high' related to cardiovascular
  if (!isHighCvdRisk) {
    if (screeningSeverities.includes('high') || screeningSeverities.includes('severe')) {
      isHighCvdRisk = true;
    }
  }

  // ── High fracture risk ──────────────────────────────────────────────
  let isHighFractureRisk = false;

  // Must be postmenopausal or surgical menopause
  const isPostmenopausal =
    profile.menopauseStatus === 'POSTMENOPAUSAL' ||
    profile.menopauseStatus === 'SURGICAL_MENOPAUSE';

  if (!isPostmenopausal) {
    return { isHighCvdRisk, isHighFractureRisk: false };
  }

  // Check chronic conditions for osteoporosis
  for (const condition of profile.chronicConditions) {
    if (containsKeyword(condition, FRACTURE_RISK_CONDITIONS)) {
      isHighFractureRisk = true;
      break;
    }
  }

  // Check family history for fracture/osteoporosis
  if (!isHighFractureRisk && profile.familyHistory) {
    const fhStr =
      typeof profile.familyHistory === 'string'
        ? profile.familyHistory
        : JSON.stringify(profile.familyHistory);
    if (containsKeyword(fhStr, FRACTURE_FAMILY_KEYWORDS)) {
      isHighFractureRisk = true;
    }
  }

  // Check medications for osteoporosis treatments
  if (!isHighFractureRisk) {
    for (const med of medicationNames) {
      if (containsKeyword(med, FRACTURE_MED_KEYWORDS)) {
        isHighFractureRisk = true;
        break;
      }
    }
  }

  // Check profile medications as well
  if (!isHighFractureRisk) {
    for (const med of profile.currentMedications) {
      if (containsKeyword(med, FRACTURE_MED_KEYWORDS)) {
        isHighFractureRisk = true;
        break;
      }
    }
  }

  return { isHighCvdRisk, isHighFractureRisk };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Computes de-identified, aggregated population health analytics for a GP's
 * entire consented patient panel.
 *
 * No individual patient data is returned — only counts, percentages, and
 * averages across the panel.
 *
 * @param db    Database client
 * @param gpId  The GP identifier
 * @returns     Aggregated population analytics
 */
export async function getPopulationAnalytics(
  db: DbClient,
  gpId: string,
): Promise<PopulationAnalytics> {
  if (!gpId || typeof gpId !== 'string') {
    throw new Error('gpId is required');
  }

  // ── 1. Get consented patients ────────────────────────────────────────
  const consented: ConsentedPatient[] = await getConsentedPatients(db, gpId);
  const panelSize = consented.length;

  if (panelSize === 0) {
    return emptyAnalytics();
  }

  const profileIds = consented.map((c) => c.profileId);

  // ── 2. Batch-load all relevant data ──────────────────────────────────
  const [
    profiles,
    symptoms,
    medications,
    screenings,
    consultations,
  ] = await Promise.all([
    db.healthProfile.findMany({
      where: { id: { in: profileIds } },
      select: {
        id: true,
        dateOfBirth: true,
        menopauseStatus: true,
        smokingStatus: true,
        chronicConditions: true,
        currentMedications: true,
        familyHistory: true,
        heightCm: true,
        weightKg: true,
        sexAtBirth: true,
      },
    }),
    db.symptomJournal.findMany({
      where: { healthProfileId: { in: profileIds } },
      orderBy: { date: 'asc' },
      select: {
        id: true,
        healthProfileId: true,
        date: true,
        symptomType: true,
        severity: true,
      },
    }),
    db.medication.findMany({
      where: { healthProfileId: { in: profileIds } },
      select: {
        id: true,
        healthProfileId: true,
        name: true,
        type: true,
      },
    }),
    db.screeningResult.findMany({
      where: { healthProfileId: { in: profileIds } },
      select: {
        id: true,
        healthProfileId: true,
        screeningType: true,
        severity: true,
      },
    }),
    db.gPConsultation.findMany({
      where: { patientId: { in: profileIds } },
      orderBy: { date: 'asc' },
      select: {
        id: true,
        patientId: true,
        date: true,
      },
    }),
  ]);

  // ── 3. Index data by profileId ───────────────────────────────────────
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  const symptomsByProfile = new Map<string, typeof symptoms>();
  for (const s of symptoms) {
    const list = symptomsByProfile.get(s.healthProfileId) ?? [];
    list.push(s);
    symptomsByProfile.set(s.healthProfileId, list);
  }

  const medsByProfile = new Map<string, typeof medications>();
  for (const m of medications) {
    const list = medsByProfile.get(m.healthProfileId) ?? [];
    list.push(m);
    medsByProfile.set(m.healthProfileId, list);
  }

  const screeningsByProfile = new Map<string, typeof screenings>();
  for (const sc of screenings) {
    const list = screeningsByProfile.get(sc.healthProfileId) ?? [];
    list.push(sc);
    screeningsByProfile.set(sc.healthProfileId, list);
  }

  const consultsByProfile = new Map<string, typeof consultations>();
  for (const c of consultations) {
    const list = consultsByProfile.get(c.patientId) ?? [];
    list.push(c);
    consultsByProfile.set(c.patientId, list);
  }

  // ── 4. Compute per-patient metrics ───────────────────────────────────
  const now = today();
  const activeSince = daysAgo(ACTIVE_DAYS_WINDOW);

  let totalAge = 0;
  let ageCount = 0;
  const menopauseCounts: Record<string, number> = {};

  // Symptom aggregation
  const symptomTypeSeverities = new Map<string, number[]>();
  const symptomTypeCounts = new Map<string, number>();
  let totalSeveritySum = 0;
  let totalSeverityEntries = 0;

  // Patient-level booleans
  let patientsOnMht = 0;
  let patientsOnAntidepressant = 0;
  let patientsOnSupplement = 0;

  const k10Done = new Set<string>();
  const phq9Done = new Set<string>();

  const entriesPerWeekValues: number[] = [];
  const streakValues: number[] = [];

  let highCvdRiskCount = 0;
  let highFractureRiskCount = 0;

  let activePatientCount = 0;

  // Time to first consult accumulators
  let timeToConsultSum = 0;
  let timeToConsultCount = 0;

  for (const profileId of profileIds) {
    const profile = profileMap.get(profileId);
    if (!profile) continue;

    // ── Demographics ────────────────────────────────────────────────
    const menoStatus = profile.menopauseStatus ?? 'UNKNOWN';
    menopauseCounts[menoStatus] = (menopauseCounts[menoStatus] ?? 0) + 1;

    if (profile.dateOfBirth) {
      totalAge += computeAge(profile.dateOfBirth);
      ageCount += 1;
    }

    // ── Symptom prevalence ──────────────────────────────────────────
    const patientSymptoms = symptomsByProfile.get(profileId) ?? [];

    if (patientSymptoms.length > 0) {
      for (const s of patientSymptoms) {
        const severities = symptomTypeSeverities.get(s.symptomType) ?? [];
        severities.push(s.severity);
        symptomTypeSeverities.set(s.symptomType, severities);

        symptomTypeCounts.set(
          s.symptomType,
          (symptomTypeCounts.get(s.symptomType) ?? 0) + 1,
        );

        totalSeveritySum += s.severity;
        totalSeverityEntries += 1;
      }
    }

    // ── Active patients ─────────────────────────────────────────────
    const hasRecentSymptom = patientSymptoms.some(
      (s) => s.date >= activeSince,
    );
    if (hasRecentSymptom) {
      activePatientCount += 1;
    }

    // ── Treatment prevalence ────────────────────────────────────────
    const patientMeds = medsByProfile.get(profileId) ?? [];
    const medNames = patientMeds.map((m) => m.name);
    const medTypes = patientMeds.map((m) => m.type);

    if (medTypes.some((t) => t === 'mht')) {
      patientsOnMht += 1;
    }

    if (medNames.some((n) => containsKeyword(n, ANTIDEPRESSANT_KEYWORDS))) {
      patientsOnAntidepressant += 1;
    }

    if (medTypes.some((t) => t === 'supplement')) {
      patientsOnSupplement += 1;
    }

    // ── Screening completion ────────────────────────────────────────
    const patientScreenings = screeningsByProfile.get(profileId) ?? [];
    for (const sc of patientScreenings) {
      if (sc.screeningType === 'k10') k10Done.add(profileId);
      if (sc.screeningType === 'phq9') phq9Done.add(profileId);
    }

    // ── Engagement ──────────────────────────────────────────────────
    if (patientSymptoms.length > 0) {
      const dates = patientSymptoms.map((s) => s.date);
      const earliest = dates[0];
      const latest = dates[dates.length - 1];
      const weeksSpan = Math.max(
        1,
        (latest.getTime() - earliest.getTime()) / (7 * 24 * 60 * 60 * 1000),
      );
      const epw = patientSymptoms.length / weeksSpan;
      entriesPerWeekValues.push(epw);

      const streak = computeLoggingStreak(dates);
      streakValues.push(streak);
    }

    // ── Risk ────────────────────────────────────────────────────────
    const screeningSeverities = patientScreenings
      .map((s) => s.severity)
      .filter((s): s is string => s !== null);

    const riskFlags = deriveRiskFlags(
      {
        smokingStatus: profile.smokingStatus,
        chronicConditions: profile.chronicConditions,
        familyHistory: profile.familyHistory,
        menopauseStatus: profile.menopauseStatus,
        currentMedications: profile.currentMedications,
      },
      medNames,
      screeningSeverities,
    );

    if (riskFlags.isHighCvdRisk) highCvdRiskCount += 1;
    if (riskFlags.isHighFractureRisk) highFractureRiskCount += 1;

    // ── Time to first consult ───────────────────────────────────────
    const patientConsults = consultsByProfile.get(profileId) ?? [];
    if (patientSymptoms.length > 0 && patientConsults.length > 0) {
      const firstSymptomDate = patientSymptoms[0].date;
      const firstConsultDate = patientConsults[0].date;
      // Only count if consult happened AFTER first symptom (time-to-care)
      const daysDiff =
        (firstConsultDate.getTime() - firstSymptomDate.getTime()) /
        (24 * 60 * 60 * 1000);
      if (daysDiff >= 0) {
        timeToConsultSum += daysDiff;
        timeToConsultCount += 1;
      }
    }
  }

  // ── 5. Compute panel-level aggregates ─────────────────────────────────

  // Demographics
  const averageAge = ageCount > 0 ? round1(totalAge / ageCount) : 0;

  // Symptoms: top 5 by count
  const topSymptoms = [...symptomTypeCounts.entries()]
    .map(([type, count]) => {
      const severities = symptomTypeSeverities.get(type) ?? [];
      const avgSev =
        severities.length > 0
          ? round2(severities.reduce((s, v) => s + v, 0) / severities.length)
          : 0;
      return {
        type,
        prevalence: formatPct(count / panelSize),
        avgSeverity: avgSev,
      };
    })
    .sort((a, b) => {
      const countB = symptomTypeCounts.get(b.type) ?? 0;
      const countA = symptomTypeCounts.get(a.type) ?? 0;
      return countB - countA;
    })
    .slice(0, 5);

  const averageDailySeverity =
    totalSeverityEntries > 0
      ? round2(totalSeveritySum / totalSeverityEntries)
      : 0;

  // Treatments
  const mhtPrescriptionRate = formatPct(patientsOnMht / panelSize);
  const antidepressantRate = formatPct(patientsOnAntidepressant / panelSize);
  const supplementRate = formatPct(patientsOnSupplement / panelSize);

  // Screening
  const k10CompletionRate = formatPct(k10Done.size / panelSize);
  const phq9CompletionRate = formatPct(phq9Done.size / panelSize);

  // Engagement
  const averageEntriesPerWeek =
    entriesPerWeekValues.length > 0
      ? round1(
          entriesPerWeekValues.reduce((s, v) => s + v, 0) /
            entriesPerWeekValues.length,
        )
      : 0;

  const averageLoggingStreakDays =
    streakValues.length > 0
      ? round1(
          streakValues.reduce((s, v) => s + v, 0) / streakValues.length,
        )
      : 0;

  // Risk
  const highFractureRiskPct = formatPct(highFractureRiskCount / panelSize);
  const highCvdRiskPct = formatPct(highCvdRiskCount / panelSize);

  // Time to care
  const averageDaysToFirstConsult =
    timeToConsultCount > 0
      ? round1(timeToConsultSum / timeToConsultCount)
      : 0;

  return {
    panelSize,
    activePatients: activePatientCount,
    demographics: {
      menopauseStatusDistribution: menopauseCounts,
      averageAge,
    },
    symptoms: {
      topSymptoms,
      averageDailySeverity,
    },
    treatments: {
      mhtPrescriptionRate,
      antidepressantRate,
      supplementRate,
    },
    screening: {
      k10CompletionRate,
      phq9CompletionRate,
    },
    engagement: {
      averageEntriesPerWeek,
      averageLoggingStreakDays,
    },
    riskProfile: {
      highFractureRiskPct,
      highCvdRiskPct,
    },
    timeToCare: {
      averageDaysToFirstConsult,
    },
    generatedAt: new Date().toISOString(),
  };
}

// ── Empty state ──────────────────────────────────────────────────────────────

function emptyAnalytics(): PopulationAnalytics {
  return {
    panelSize: 0,
    activePatients: 0,
    demographics: {
      menopauseStatusDistribution: {},
      averageAge: 0,
    },
    symptoms: {
      topSymptoms: [],
      averageDailySeverity: 0,
    },
    treatments: {
      mhtPrescriptionRate: '0.0%',
      antidepressantRate: '0.0%',
      supplementRate: '0.0%',
    },
    screening: {
      k10CompletionRate: '0.0%',
      phq9CompletionRate: '0.0%',
    },
    engagement: {
      averageEntriesPerWeek: 0,
      averageLoggingStreakDays: 0,
    },
    riskProfile: {
      highFractureRiskPct: '0.0%',
      highCvdRiskPct: '0.0%',
    },
    timeToCare: {
      averageDaysToFirstConsult: 0,
    },
    generatedAt: new Date().toISOString(),
  };
}
