// Apple HealthKit integration library
// Data model, type mappings, and conversion utilities for browser/server use.
// Does NOT make native iOS calls.

// ─── Supported Metric Types ───────────────────────────────────────────────────

export const METRIC_TYPES = {
  HEART_RATE: 'heart_rate',
  RESTING_HEART_RATE: 'resting_heart_rate',
  HRV: 'hrv',
  SLEEP_DURATION: 'sleep_duration',
  SLEEP_QUALITY: 'sleep_quality',
  WRIST_TEMPERATURE: 'wrist_temperature',
  BODY_TEMPERATURE: 'body_temperature',
  STEP_COUNT: 'steps',
  ACTIVE_ENERGY: 'active_energy',
  BLOOD_PRESSURE_SYSTOLIC: 'blood_pressure_systolic',
  BLOOD_PRESSURE_DIASTOLIC: 'blood_pressure_diastolic',
  WEIGHT: 'weight',
  BMI: 'bmi',
  BLOOD_GLUCOSE: 'blood_glucose',
  OXYGEN_SATURATION: 'oxygen_saturation',
  RESPIRATORY_RATE: 'respiratory_rate',
  MENSTRUAL_FLOW: 'menstrual_flow',
  OVULATION_TEST: 'ovulation_test',
} as const;

export type MetricType = (typeof METRIC_TYPES)[keyof typeof METRIC_TYPES];

// ─── Type Definitions ─────────────────────────────────────────────────────────

export interface HealthKitMetric {
  type: string; // HealthKit type identifier (e.g. HKQuantityTypeIdentifierHeartRate)
  value: number;
  unit: string;
  startDate: string; // ISO datetime
  endDate: string; // ISO datetime
  source: string; // e.g. "Apple Watch Series 8"
  device?: string; // device identifier
}

export interface SyncMetricPayload {
  metricType: string;
  value: number;
  unit?: string;
  source?: string;
  sourceDevice?: string;
  recordedAt: string;
}

// ─── Metric Type Map ──────────────────────────────────────────────────────────

const metricTypeMap: Record<string, string> = {
  'HKQuantityTypeIdentifierHeartRate': METRIC_TYPES.HEART_RATE,
  'HKQuantityTypeIdentifierRestingHeartRate': METRIC_TYPES.RESTING_HEART_RATE,
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN': METRIC_TYPES.HRV,
  'HKCategoryTypeIdentifierSleepAnalysis': METRIC_TYPES.SLEEP_DURATION,
  'HKQuantityTypeIdentifierAppleSleepingWristTemperature':
    METRIC_TYPES.WRIST_TEMPERATURE,
  'HKQuantityTypeIdentifierBodyTemperature': METRIC_TYPES.BODY_TEMPERATURE,
  'HKQuantityTypeIdentifierStepCount': METRIC_TYPES.STEP_COUNT,
  'HKQuantityTypeIdentifierActiveEnergyBurned': METRIC_TYPES.ACTIVE_ENERGY,
  'HKQuantityTypeIdentifierBloodPressureSystolic':
    METRIC_TYPES.BLOOD_PRESSURE_SYSTOLIC,
  'HKQuantityTypeIdentifierBloodPressureDiastolic':
    METRIC_TYPES.BLOOD_PRESSURE_DIASTOLIC,
  'HKQuantityTypeIdentifierBodyMass': METRIC_TYPES.WEIGHT,
  'HKQuantityTypeIdentifierBodyMassIndex': METRIC_TYPES.BMI,
  'HKQuantityTypeIdentifierBloodGlucose': METRIC_TYPES.BLOOD_GLUCOSE,
  'HKQuantityTypeIdentifierOxygenSaturation': METRIC_TYPES.OXYGEN_SATURATION,
  'HKQuantityTypeIdentifierRespiratoryRate': METRIC_TYPES.RESPIRATORY_RATE,
  'HKCategoryTypeIdentifierMenstrualFlow': METRIC_TYPES.MENSTRUAL_FLOW,
  'HKCategoryTypeIdentifierOvulationTestResult': METRIC_TYPES.OVULATION_TEST,
};

// ─── Mapping Functions ────────────────────────────────────────────────────────

/**
 * Converts raw HealthKit data to the sync API payload format.
 * Maps HealthKit identifiers via metricTypeMap and uses startDate as recordedAt.
 * Skips entries with invalid (NaN/null/undefined) values or unknown metric types.
 */
export function mapHealthKitToMetrics(
  healthkitData: HealthKitMetric[],
): SyncMetricPayload[] {
  return healthkitData
    .filter((entry) => {
      // Must have a valid numeric value
      if (
        entry.value === undefined ||
        entry.value === null ||
        Number.isNaN(entry.value)
      ) {
        return false;
      }
      // Must map to a known metric type
      const resolved = metricTypeMap[entry.type];
      if (!resolved) {
        return false;
      }
      return true;
    })
    .map((entry) => {
      const resolvedType = metricTypeMap[entry.type]!;
      return {
        metricType: resolvedType,
        value: entry.value,
        unit: entry.unit,
        source: entry.source,
        sourceDevice: entry.device,
        recordedAt: entry.startDate,
      };
    });
}

/**
 * Returns a human-readable display name (with emoji prefix) for each metric type.
 */
export function getMetricDisplayName(type: string): string {
  switch (type) {
    case METRIC_TYPES.HEART_RATE:
      return '🫀 Heart Rate';
    case METRIC_TYPES.RESTING_HEART_RATE:
      return '🫀 Resting Heart Rate';
    case METRIC_TYPES.HRV:
      return '🫀 Heart Rate Variability';
    case METRIC_TYPES.SLEEP_DURATION:
      return '😴 Sleep Duration';
    case METRIC_TYPES.SLEEP_QUALITY:
      return '😴 Sleep Quality';
    case METRIC_TYPES.WRIST_TEMPERATURE:
      return '🌡️ Wrist Temperature';
    case METRIC_TYPES.BODY_TEMPERATURE:
      return '🌡️ Body Temperature';
    case METRIC_TYPES.STEP_COUNT:
      return '👣 Step Count';
    case METRIC_TYPES.ACTIVE_ENERGY:
      return '⚡ Active Energy';
    case METRIC_TYPES.BLOOD_PRESSURE_SYSTOLIC:
      return '🫀 Systolic Blood Pressure';
    case METRIC_TYPES.BLOOD_PRESSURE_DIASTOLIC:
      return '🫀 Diastolic Blood Pressure';
    case METRIC_TYPES.WEIGHT:
      return '⚖️ Weight';
    case METRIC_TYPES.BMI:
      return '⚖️ Body Mass Index';
    case METRIC_TYPES.BLOOD_GLUCOSE:
      return '🩸 Blood Glucose';
    case METRIC_TYPES.OXYGEN_SATURATION:
      return '🫁 Oxygen Saturation';
    case METRIC_TYPES.RESPIRATORY_RATE:
      return '🫁 Respiratory Rate';
    case METRIC_TYPES.MENSTRUAL_FLOW:
      return '🩸 Menstrual Flow';
    case METRIC_TYPES.OVULATION_TEST:
      return '🩸 Ovulation Test';
    default:
      return type;
  }
}

/**
 * Returns the standard display unit for each metric type.
 */
export function getMetricUnit(type: string): string {
  switch (type) {
    case METRIC_TYPES.HEART_RATE:
    case METRIC_TYPES.RESTING_HEART_RATE:
      return 'bpm';
    case METRIC_TYPES.HRV:
      return 'ms';
    case METRIC_TYPES.SLEEP_DURATION:
      return 'hours';
    case METRIC_TYPES.SLEEP_QUALITY:
      return '%';
    case METRIC_TYPES.WRIST_TEMPERATURE:
    case METRIC_TYPES.BODY_TEMPERATURE:
      return '°C';
    case METRIC_TYPES.STEP_COUNT:
      return 'steps';
    case METRIC_TYPES.ACTIVE_ENERGY:
      return 'kcal';
    case METRIC_TYPES.BLOOD_PRESSURE_SYSTOLIC:
    case METRIC_TYPES.BLOOD_PRESSURE_DIASTOLIC:
      return 'mmHg';
    case METRIC_TYPES.WEIGHT:
      return 'kg';
    case METRIC_TYPES.BMI:
      return 'kg/m²';
    case METRIC_TYPES.BLOOD_GLUCOSE:
      return 'mg/dL';
    case METRIC_TYPES.OXYGEN_SATURATION:
      return '%';
    case METRIC_TYPES.RESPIRATORY_RATE:
      return 'breaths/min';
    case METRIC_TYPES.MENSTRUAL_FLOW:
    case METRIC_TYPES.OVULATION_TEST:
      return '';
    default:
      return '';
  }
}

/**
 * Returns the category bucket for a given metric type.
 */
export function getMetricCategory(type: string): string {
  switch (type) {
    case METRIC_TYPES.HEART_RATE:
    case METRIC_TYPES.RESTING_HEART_RATE:
    case METRIC_TYPES.HRV:
    case METRIC_TYPES.BLOOD_PRESSURE_SYSTOLIC:
    case METRIC_TYPES.BLOOD_PRESSURE_DIASTOLIC:
      return 'cardiovascular';
    case METRIC_TYPES.SLEEP_DURATION:
    case METRIC_TYPES.SLEEP_QUALITY:
      return 'sleep';
    case METRIC_TYPES.WRIST_TEMPERATURE:
    case METRIC_TYPES.BODY_TEMPERATURE:
      return 'temperature';
    case METRIC_TYPES.STEP_COUNT:
    case METRIC_TYPES.ACTIVE_ENERGY:
      return 'activity';
    case METRIC_TYPES.WEIGHT:
    case METRIC_TYPES.BMI:
    case METRIC_TYPES.BLOOD_GLUCOSE:
    case METRIC_TYPES.OXYGEN_SATURATION:
    case METRIC_TYPES.RESPIRATORY_RATE:
      return 'body';
    case METRIC_TYPES.MENSTRUAL_FLOW:
    case METRIC_TYPES.OVULATION_TEST:
      return 'reproductive';
    default:
      return 'other';
  }
}
