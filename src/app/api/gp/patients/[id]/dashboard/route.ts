import { NextRequest, NextResponse } from 'next/server';
import { requireWriteAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import { checkConsent } from '@/domain/health/consent-service';
import { getSymptomTrends, type SymptomTrends } from '@/domain/health/symptom-service';
import { getMetrics, type HealthMetricEntry } from '@/domain/health/health-metrics-service';
import { getMedications, type Medication } from '@/domain/health/medication-service';
import { getScreeningHistory, type StoredScreeningResult } from '@/domain/health/screening-service';
import { generateInsights, type HealthInsights } from '@/domain/health/health-insight-engine';
import { generateAlerts, type ClinicalAlert } from '@/domain/health/clinical-alert-service';

// ── Types ────────────────────────────────────────────────────────────────────

interface ProfileData {
  id: string;
  age: number | null;
  sexAtBirth: string | null;
  menopauseStatus: string | null;
  heightCm: number | null;
  weightKg: number | null;
  bloodType: string | null;
  allergies: string[];
  chronicConditions: string[];
  currentMedications: string[];
  smokingStatus: string | null;
  alcoholUnitsPerWeek: number | null;
  exerciseMinutesPerWeek: number | null;
  familyHistory: unknown;
}

interface ConsultationRecord {
  id: string;
  date: string;
  consultationType: string;
  duration: number | null;
  summary: string;
  subjectiveNote: string | null;
  objectiveNote: string | null;
  assessmentNote: string | null;
  planNote: string | null;
  treatmentPlan: string | null;
  prescriptions: string[];
  referrals: string[];
  followUp: string | null;
  mbsItems: string[];
  notes: string | null;
  aiGenerated: boolean;
  createdAt: string;
}

interface DashboardResponse {
  success: true;
  profile: ProfileData;
  symptoms: SymptomTrends;
  metrics: HealthMetricEntry[];
  medications: Medication[];
  screeningHistory: StoredScreeningResult[];
  insights: HealthInsights;
  consultations: ConsultationRecord[];
  alerts: ClinicalAlert[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function jsonError(
  error: string,
  status = 400,
): NextResponse<{ success: false; error: string }> {
  return NextResponse.json({ success: false, error }, { status });
}

/**
 * Computes age in years from a Date object.
 * Returns null if dateOfBirth is null.
 */
function computeAge(dateOfBirth: Date | null): number | null {
  if (!dateOfBirth) return null;

  const today = new Date();
  let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDelta = today.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < dateOfBirth.getUTCDate())) {
    age -= 1;
  }
  return age;
}

/**
 * Formats a Date as an ISO 8601 date-only string (YYYY-MM-DD).
 */
function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Maps a raw GPConsultation DB row to the API-safe ConsultationRecord.
 */
function mapConsultation(row: {
  id: string;
  date: Date;
  consultationType: string;
  duration: number | null;
  summary: string;
  subjectiveNote: string | null;
  objectiveNote: string | null;
  assessmentNote: string | null;
  planNote: string | null;
  treatmentPlan: string | null;
  prescriptions: string[];
  referrals: string[];
  followUp: Date | null;
  mbsItems: string[];
  notes: string | null;
  aiGenerated: boolean;
  createdAt: Date;
}): ConsultationRecord {
  return {
    id: row.id,
    date: formatDate(row.date),
    consultationType: row.consultationType,
    duration: row.duration,
    summary: row.summary,
    subjectiveNote: row.subjectiveNote,
    objectiveNote: row.objectiveNote,
    assessmentNote: row.assessmentNote,
    planNote: row.planNote,
    treatmentPlan: row.treatmentPlan,
    prescriptions: row.prescriptions,
    referrals: row.referrals,
    followUp: row.followUp ? formatDate(row.followUp) : null,
    mbsItems: row.mbsItems,
    notes: row.notes,
    aiGenerated: row.aiGenerated,
    createdAt: row.createdAt.toISOString(),
  };
}

// ── GET: Patient health dashboard (full data) ────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const { id: patientId } = await params;
  const gpId = guard.session.sub;

  const db = createClient({
    tier: guard.session.tier,
    sub: gpId,
  });

  try {
    // ── 0. Verify consent ─────────────────────────────────────────────────
    const hasConsent = await checkConsent(db, patientId, gpId);
    if (!hasConsent) {
      return NextResponse.json(
        { success: false, error: 'No active consent for this patient. The patient must grant consent before you can view their dashboard.' },
        { status: 403 },
      );
    }

    // ── 1. Health profile ─────────────────────────────────────────────────
    const profile = await db.healthProfile.findUnique({
      where: { id: patientId },
    });

    if (!profile) {
      return jsonError('Health profile not found for the given patient', 404);
    }

    const profileData: ProfileData = {
      id: profile.id,
      age: computeAge(profile.dateOfBirth ?? null),
      sexAtBirth: profile.sexAtBirth ?? null,
      menopauseStatus: profile.menopauseStatus ?? null,
      heightCm: profile.heightCm ?? null,
      weightKg: profile.weightKg ?? null,
      bloodType: profile.bloodType ?? null,
      allergies: profile.allergies,
      chronicConditions: profile.chronicConditions,
      currentMedications: profile.currentMedications,
      smokingStatus: profile.smokingStatus ?? null,
      alcoholUnitsPerWeek: profile.alcoholUnitsPerWeek ?? null,
      exerciseMinutesPerWeek: profile.exerciseMinutesPerWeek ?? null,
      familyHistory: profile.familyHistory,
    };

    // ── 2-6. Fetch data in parallel ───────────────────────────────────────
    const [symptoms, metrics, medications, screeningHistory, insights, alerts] =
      await Promise.all([
        getSymptomTrends(db, patientId, 30),
        getMetrics(db, patientId),
        getMedications(db, patientId),
        getScreeningHistory(db, patientId),
        generateInsights(db, patientId),
        generateAlerts(db, patientId),
      ]);

    // ── 7. Recent consultations ───────────────────────────────────────────
    const consultationRows = await db.gPConsultation.findMany({
      where: { patientId, gpId },
      orderBy: { date: 'desc' },
      take: 20,
    });

    const consultations: ConsultationRecord[] = consultationRows.map((row) =>
      mapConsultation(
        row as Parameters<typeof mapConsultation>[0],
      ),
    );

    const response: DashboardResponse = {
      success: true,
      profile: profileData,
      symptoms,
      metrics,
      medications,
      screeningHistory,
      insights,
      consultations,
      alerts,
    };

    return NextResponse.json(response);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to load patient dashboard';
    return jsonError(message, 500);
  }
}
