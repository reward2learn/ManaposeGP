/**
 * P0-001: Create healthcare tables in Neon Postgres via Prisma.
 * Run: node scripts/migrate-healthcare.mjs
 * Requires POSTGRES_URL in env.
 */
import { PrismaClient } from '@prisma/client';

const POSTGRES_URL = process.env.POSTGRES_URL;
if (!POSTGRES_URL) {
  console.error('[healthcare-migrate] POSTGRES_URL not set');
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: POSTGRES_URL } } });

const ENUM_STATEMENTS = [
  `DO $$ BEGIN CREATE TYPE "MenopauseStatus" AS ENUM ('PREMENOPAUSAL','PERIMENOPAUSAL','POSTMENOPAUSAL','EARLY_MENOPAUSE','SURGICAL_MENOPAUSE','UNKNOWN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE TYPE "SymptomType" AS ENUM ('hot_flush','night_sweat','sleep_disturbance','mood_change','brain_fog','joint_pain','vaginal_dryness','libido_change','fatigue','weight_change','headache','palpitations','urinary_symptoms','skin_changes','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE TYPE "MetricSource" AS ENUM ('apple_health','manual','device','lab_result'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE TYPE "GuidelineSource" AS ENUM ('racgp','ams','jean_hailes','etg','healthdirect','pubmed','nps','beyond_blue'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE TYPE "ConsultationType" AS ENUM ('INITIAL','FOLLOW_UP','REVIEW','EMERGENCY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE TYPE "MedicationStatus" AS ENUM ('ACTIVE','DISCONTINUED','PAUSED','COMPLETED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE TYPE "ConsentStatus" AS ENUM ('PENDING','ACTIVE','REVOKED','EXPIRED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
];

const TABLE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS health_profiles (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, date_of_birth DATE, sex_at_birth TEXT, menopause_status TEXT, height_cm DOUBLE PRECISION, weight_kg DOUBLE PRECISION, blood_type TEXT, allergies TEXT[] DEFAULT '{}', chronic_conditions TEXT[] DEFAULT '{}', current_medications TEXT[] DEFAULT '{}', smoking_status TEXT, alcohol_units_per_week INTEGER, exercise_minutes_per_week INTEGER, family_history JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  
  `CREATE TABLE IF NOT EXISTS symptom_journals (id TEXT PRIMARY KEY, health_profile_id TEXT NOT NULL REFERENCES health_profiles(id) ON DELETE CASCADE, date DATE NOT NULL, symptom_type TEXT NOT NULL, severity INTEGER NOT NULL DEFAULT 0, duration INTEGER, frequency INTEGER, triggers TEXT[] DEFAULT '{}', relief_factors TEXT[] DEFAULT '{}', impact_on_daily INTEGER, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `CREATE INDEX IF NOT EXISTS idx_sj_profile_date ON symptom_journals(health_profile_id, date)`,
  `CREATE INDEX IF NOT EXISTS idx_sj_profile_type ON symptom_journals(health_profile_id, symptom_type)`,
  
  `CREATE TABLE IF NOT EXISTS health_metrics (id TEXT PRIMARY KEY, health_profile_id TEXT NOT NULL REFERENCES health_profiles(id) ON DELETE CASCADE, metric_type TEXT NOT NULL, value JSONB NOT NULL, unit TEXT, source TEXT NOT NULL DEFAULT 'apple_health', source_device TEXT, recorded_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `CREATE INDEX IF NOT EXISTS idx_hm_profile_type_time ON health_metrics(health_profile_id, metric_type, recorded_at)`,
  
  `CREATE TABLE IF NOT EXISTS medications (id TEXT PRIMARY KEY, health_profile_id TEXT NOT NULL REFERENCES health_profiles(id) ON DELETE CASCADE, name TEXT NOT NULL, type TEXT NOT NULL, dosage TEXT NOT NULL, frequency TEXT NOT NULL, route TEXT, start_date DATE NOT NULL, end_date DATE, status TEXT NOT NULL DEFAULT 'ACTIVE', prescribed_by TEXT, notes TEXT, adherence_log JSONB DEFAULT '[]', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `CREATE INDEX IF NOT EXISTS idx_meds_profile_status ON medications(health_profile_id, status)`,
  
  `CREATE TABLE IF NOT EXISTS lab_results (id TEXT PRIMARY KEY, health_profile_id TEXT NOT NULL REFERENCES health_profiles(id) ON DELETE CASCADE, test_name TEXT NOT NULL, test_category TEXT NOT NULL, result_value TEXT NOT NULL, unit TEXT, reference_range TEXT, is_abnormal BOOLEAN NOT NULL DEFAULT false, test_date DATE NOT NULL, laboratory TEXT, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  
  `CREATE TABLE IF NOT EXISTS gp_consultations (id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, gp_id TEXT NOT NULL, date DATE NOT NULL, consultation_type TEXT NOT NULL DEFAULT 'INITIAL', duration INTEGER, summary TEXT NOT NULL, subjective_note TEXT, objective_note TEXT, assessment_note TEXT, plan_note TEXT, treatment_plan TEXT, prescriptions TEXT[] DEFAULT '{}', referrals TEXT[] DEFAULT '{}', follow_up TIMESTAMPTZ, mbs_items TEXT[] DEFAULT '{}', notes TEXT, ai_generated BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `CREATE INDEX IF NOT EXISTS idx_cons_patient_date ON gp_consultations(patient_id, date)`,
  
  `CREATE TABLE IF NOT EXISTS patient_consents (id TEXT PRIMARY KEY, health_profile_id TEXT NOT NULL REFERENCES health_profiles(id) ON DELETE CASCADE, gp_id TEXT NOT NULL, consent_type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', granted_at TIMESTAMPTZ, expires_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(health_profile_id, gp_id))`,
  
  `CREATE TABLE IF NOT EXISTS clinical_guidelines (id TEXT PRIMARY KEY, source TEXT NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL, content TEXT NOT NULL, summary TEXT, version TEXT, last_updated TIMESTAMPTZ NOT NULL, url TEXT, keywords TEXT[] DEFAULT '{}')`,
  `CREATE TABLE IF NOT EXISTS medical_references (id TEXT PRIMARY KEY, topic TEXT NOT NULL, subtopic TEXT, content TEXT NOT NULL, source TEXT NOT NULL, url TEXT, keywords TEXT[] DEFAULT '{}')`,
  
  `CREATE TABLE IF NOT EXISTS health_education (id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL, content TEXT NOT NULL, summary TEXT NOT NULL, source TEXT NOT NULL, language TEXT NOT NULL DEFAULT 'en', reading_level TEXT, published_at TIMESTAMPTZ NOT NULL, reviewed_at TIMESTAMPTZ NOT NULL, tags TEXT[] DEFAULT '{}', url TEXT)`,
  
  `CREATE TABLE IF NOT EXISTS screening_results (id TEXT PRIMARY KEY, health_profile_id TEXT NOT NULL REFERENCES health_profiles(id) ON DELETE CASCADE, screening_type TEXT NOT NULL, score INTEGER NOT NULL, interpretation TEXT NOT NULL, severity TEXT, completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), notes TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_sr_profile_type ON screening_results(health_profile_id, screening_type)`,
];

async function main() {
  console.log('[healthcare] Enabling pgvector...');
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`);
  console.log('[healthcare] pgvector ready');

  console.log('[healthcare] Creating enums...');
  for (const stmt of ENUM_STATEMENTS) {
    try { await prisma.$executeRawUnsafe(stmt); } catch(e) { /* already exists */ }
  }
  console.log('[healthcare] Enums ready');

  console.log('[healthcare] Creating tables...');
  for (const stmt of TABLE_STATEMENTS) {
    try { 
      await prisma.$executeRawUnsafe(stmt);
    } catch(e) {
      console.error(`  Failed: ${e.message.substring(0, 80)}`);
    }
  }
  console.log('[healthcare] Tables ready');
  
  // Verify
  const tables = await prisma.$queryRawUnsafe<Array<{tablename: string}>>(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'health_%' OR tablename LIKE 'symptom_%' OR tablename LIKE 'gp_%' OR tablename LIKE 'patient_%' OR tablename LIKE 'clinical_%' OR tablename LIKE 'medical_%' OR tablename LIKE 'screening_%' OR tablename LIKE 'medications' OR tablename LIKE 'lab_results' ORDER BY tablename`
  );
  console.log('[healthcare] Created tables:', tables.map(t => t.tablename).join(', '));
  
  await prisma.$disconnect();
  console.log('[healthcare] Migration complete');
}

main().catch(err => {
  console.error('[healthcare] Fatal:', err.message);
  prisma.$disconnect();
  process.exit(1);
});
