/**
 * Database connection helper.
 * Uses @neondatabase/serverless when POSTGRES_URL is configured.
 * Gracefully degrades when no database is available.
 * Auto-creates required tables on first runtime connect (not during next build).
 */

let _sql = null;
let _ready = false;
let _migrated = false;

function isBuildPhase() {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

function isNeonRetryable(err) {
  const msg = err?.message ?? String(err);
  return msg.includes('neon:retryable') || msg.includes('Control plane request failed');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(fn, { attempts = 3, baseMs = 500 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isNeonRetryable(err) || i === attempts - 1) throw err;
      const delay = baseMs * (i + 1);
      console.warn(`[db] Transient Neon error, retry ${i + 1}/${attempts - 1} in ${delay}ms…`);
      await sleep(delay);
    }
  }
  throw lastErr;
}

async function connectDb() {
  if (_ready) return true;
  if (_sql === false) return false;
  if (_sql !== null) return _ready;

  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.log('[db] No POSTGRES_URL — DB disabled');
    _sql = false;
    return false;
  }

  try {
    const { neon } = await import('@neondatabase/serverless');
    _sql = neon(connectionString);
    _ready = true;
    console.log('[db] Connected');
    return true;
  } catch (err) {
    console.warn('[db] Init failed:', err.message);
    _sql = false;
    return false;
  }
}

async function ensureDb() {
  if (isBuildPhase()) return false;

  const connected = await connectDb();
  if (connected && !_migrated) {
    await migrate();
    _migrated = true;
  }
  return _ready;
}

/** Explicit migration entry point for `bun run db:migrate` / seed scripts. */
export async function runMigrations() {
  const connected = await connectDb();
  if (!connected) {
    throw new Error('POSTGRES_URL is not set or connection failed');
  }
  await migrate();
  _migrated = true;
}

async function migrate() {
  try {
    await withRetry(async () => {
    await _sql(`
      CREATE TABLE IF NOT EXISTS secrets (
        key_name TEXT PRIMARY KEY,
        encrypted_value TEXT NOT NULL,
        iv TEXT NOT NULL,
        auth_tag TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[db] Secrets table ready');

await _sql(`
       CREATE TABLE IF NOT EXISTS conversations (
         id SERIAL PRIMARY KEY,
         user_name TEXT DEFAULT 'Anonymous',
         title TEXT DEFAULT 'Chat Conversation',
         messages JSONB NOT NULL DEFAULT '[]'::jsonb,
         message_count INTEGER DEFAULT 0,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       );
     `);
     console.log('[db] Conversations table ready');

     // ---- Job Queue Table (persistent for async tasks) ----
     await _sql(`
       CREATE TABLE IF NOT EXISTS job_queue (
         job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         requested_by_session TEXT,
         payload JSONB NOT NULL,
         status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
         created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
         updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
         completed_data JSONB
       );
     `);
      await _sql(`CREATE INDEX IF NOT EXISTS idx_job_queue_by_status ON job_queue (status);`);

      // ---- Financial Projections Table (from Excel P&L) ----
      await _sql(`
        CREATE TABLE IF NOT EXISTS financial_projections (
          id SERIAL PRIMARY KEY,
          period TEXT NOT NULL,
          year INTEGER NOT NULL,
          month INTEGER NOT NULL,
          data_type TEXT NOT NULL,
          scenario TEXT NOT NULL DEFAULT 'conservative',
          revenue NUMERIC(14,2) DEFAULT 0,
          ebitda NUMERIC(14,2) DEFAULT 0,
          net_income NUMERIC(14,2) DEFAULT 0,
          guests INTEGER DEFAULT 0,
          staff_cost NUMERIC(14,2) DEFAULT 0,
          UNIQUE(period, data_type, scenario)
        );
      `);
      // Migration: add scenario column if missing, set defaults
      try { await _sql(`ALTER TABLE financial_projections ADD COLUMN IF NOT EXISTS scenario TEXT NOT NULL DEFAULT 'conservative';`); } catch(e) {}
      try { await _sql(`UPDATE financial_projections SET scenario = 'actual' WHERE data_type = 'actual' AND scenario = 'conservative';`); } catch(e) {}
      try { await _sql(`UPDATE financial_projections SET scenario = 'conservative' WHERE data_type = 'forecast' AND scenario = 'actual';`); } catch(e) {}
      // Drop old unique constraint if it exists (before scenario column was added)
      try { await _sql(`ALTER TABLE financial_projections DROP CONSTRAINT IF EXISTS financial_projections_period_data_type_key;`); } catch(e) {}
      // Recreate unique constraint to include scenario (ignore if already exists)
      try { await _sql(`ALTER TABLE financial_projections ADD CONSTRAINT financial_projections_period_data_type_scenario_key UNIQUE (period, data_type, scenario);`); } catch(e) {}
      try { await _sql(`ALTER TABLE financial_projections ADD COLUMN IF NOT EXISTS pnl_lines JSONB;`); } catch(e) {}
      await _sql(`CREATE INDEX IF NOT EXISTS idx_financial_projections_period ON financial_projections (period);`);

      // ---- Daily Z Sales Reports (POS printout) ----
      await _sql(`
        CREATE TABLE IF NOT EXISTS daily_z_reports (
          id SERIAL PRIMARY KEY,
          report_date DATE NOT NULL,
          department TEXT NOT NULL DEFAULT 'all_pos',
          report_time TIME,
          operator TEXT,
          report_no INTEGER,
          pos_group TEXT,
          period_start TIMESTAMP,
          period_end TIMESTAMP,
          item_sales_qty INTEGER DEFAULT 0,
          item_sales_amount NUMERIC(14,2) DEFAULT 0,
          item_discount_qty INTEGER DEFAULT 0,
          item_discount_amount NUMERIC(14,2) DEFAULT 0,
          bill_discount_qty INTEGER DEFAULT 0,
          bill_discount_amount NUMERIC(14,2) DEFAULT 0,
          foc_items_qty INTEGER DEFAULT 0,
          foc_items_amount NUMERIC(14,2) DEFAULT 0,
          foc_bill_qty INTEGER DEFAULT 0,
          foc_bill_amount NUMERIC(14,2) DEFAULT 0,
          total_sales NUMERIC(14,2) DEFAULT 0,
          estimated_sales NUMERIC(14,2) DEFAULT 0,
          cash_qty INTEGER DEFAULT 0,
          cash_amount NUMERIC(14,2) DEFAULT 0,
          bca_qty INTEGER DEFAULT 0,
          bca_amount NUMERIC(14,2) DEFAULT 0,
          gojek_pay_qty INTEGER DEFAULT 0,
          gojek_pay_amount NUMERIC(14,2) DEFAULT 0,
          mandiri_qty INTEGER DEFAULT 0,
          mandiri_amount NUMERIC(14,2) DEFAULT 0,
          total_card_qty INTEGER DEFAULT 0,
          total_card_amount NUMERIC(14,2) DEFAULT 0,
          total_cash_qty INTEGER DEFAULT 0,
          total_cash_amount NUMERIC(14,2) DEFAULT 0,
          refund_qty INTEGER DEFAULT 0,
          refund_amount NUMERIC(14,2) DEFAULT 0,
          pre_send_void_qty INTEGER DEFAULT 0,
          pre_send_void_amount NUMERIC(14,2) DEFAULT 0,
          post_send_void_qty INTEGER DEFAULT 0,
          post_send_void_amount NUMERIC(14,2) DEFAULT 0,
          tot_collection_qty INTEGER DEFAULT 0,
          tot_collection_amount NUMERIC(14,2) DEFAULT 0,
          tax_10_amount NUMERIC(14,2) DEFAULT 0,
          service_7_amount NUMERIC(14,2) DEFAULT 0,
          nett_sales NUMERIC(14,2) DEFAULT 0,
          bills_pending_qty INTEGER DEFAULT 0,
          bills_pending_amount NUMERIC(14,2) DEFAULT 0,
          total_bills INTEGER DEFAULT 0,
          avg_bills NUMERIC(14,2) DEFAULT 0,
          total_covers INTEGER DEFAULT 0,
          avg_covers NUMERIC(14,2) DEFAULT 0,
          begin_receipt_no TEXT,
          end_receipt_no TEXT,
          group_beverage_qty INTEGER DEFAULT 0,
          group_beverage_amount NUMERIC(14,2) DEFAULT 0,
          group_food_qty INTEGER DEFAULT 0,
          group_food_amount NUMERIC(14,2) DEFAULT 0,
          group_total_qty INTEGER DEFAULT 0,
          group_total_amount NUMERIC(14,2) DEFAULT 0,
          group_foc_beverage_qty INTEGER DEFAULT 0,
          group_foc_beverage_amount NUMERIC(14,2) DEFAULT 0,
          group_foc_food_qty INTEGER DEFAULT 0,
          group_foc_food_amount NUMERIC(14,2) DEFAULT 0,
          dine_in_qty INTEGER DEFAULT 0,
          dine_in_amount NUMERIC(14,2) DEFAULT 0,
          gofood_qty INTEGER DEFAULT 0,
          gofood_amount NUMERIC(14,2) DEFAULT 0,
          total_ctgry_qty INTEGER DEFAULT 0,
          total_ctgry_amount NUMERIC(14,2) DEFAULT 0,
          bill_disc_20_qty INTEGER DEFAULT 0,
          bill_disc_20_amount NUMERIC(14,2) DEFAULT 0,
          total_item_discount_qty INTEGER DEFAULT 0,
          total_item_discount_amount NUMERIC(14,2) DEFAULT 0,
          raw_text TEXT,
          entry_source TEXT NOT NULL DEFAULT 'manual',
          receipt_images JSONB DEFAULT '[]'::jsonb,
          corrected_at TIMESTAMP,
          correction_field TEXT,
          correction_reason TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      try {
        await _sql(`ALTER TABLE daily_z_reports ADD COLUMN IF NOT EXISTS entry_source TEXT NOT NULL DEFAULT 'manual';`);
      } catch (e) {}
      try {
        await _sql(`ALTER TABLE daily_z_reports ADD COLUMN IF NOT EXISTS receipt_images JSONB DEFAULT '[]'::jsonb;`);
      } catch (e) {}
      try {
        await _sql(`ALTER TABLE daily_z_reports ADD COLUMN IF NOT EXISTS corrected_at TIMESTAMP;`);
      } catch (e) {}
      try {
        await _sql(`ALTER TABLE daily_z_reports ADD COLUMN IF NOT EXISTS correction_field TEXT;`);
      } catch (e) {}
      try {
        await _sql(`ALTER TABLE daily_z_reports ADD COLUMN IF NOT EXISTS correction_reason TEXT;`);
      } catch (e) {}
      try {
        await _sql(`ALTER TABLE daily_z_reports ADD COLUMN IF NOT EXISTS department TEXT NOT NULL DEFAULT 'all_pos';`);
      } catch (e) {}
      try {
        await _sql(`ALTER TABLE daily_z_reports DROP CONSTRAINT IF EXISTS daily_z_reports_report_date_key;`);
      } catch (e) {}
      try {
        await _sql(`CREATE UNIQUE INDEX IF NOT EXISTS daily_z_reports_date_dept_key ON daily_z_reports (report_date, department);`);
      } catch (e) {}
      console.log('[db] daily_z_reports table ready');

      await _sql(`
        CREATE TABLE IF NOT EXISTS monthly_actual_inputs (
          period TEXT PRIMARY KEY,
          inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('[db] monthly_actual_inputs table ready');

      await _sql(`
        CREATE TABLE IF NOT EXISTS monthly_actual_departments (
          period TEXT NOT NULL,
          department TEXT NOT NULL,
          inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
          receipt_images JSONB NOT NULL DEFAULT '[]'::jsonb,
          notes TEXT DEFAULT '',
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (period, department)
        );
      `);
      console.log('[db] monthly_actual_departments table ready');

      // ── Healthcare tables ──
      await _sql(`CREATE EXTENSION IF NOT EXISTS vector`);
      console.log('[db] pgvector extension enabled');

      // Healthcare enum types
      const hcEnums = [
        `CREATE TYPE "MenopauseStatus" AS ENUM ('PREMENOPAUSAL','PERIMENOPAUSAL','POSTMENOPAUSAL','EARLY_MENOPAUSE','SURGICAL_MENOPAUSE','UNKNOWN')`,
        `CREATE TYPE "SymptomType" AS ENUM ('hot_flush','night_sweat','sleep_disturbance','mood_change','brain_fog','joint_pain','vaginal_dryness','libido_change','fatigue','weight_change','headache','palpitations','urinary_symptoms','skin_changes','other')`,
        `CREATE TYPE "MetricSource" AS ENUM ('apple_health','manual','device','lab_result')`,
        `CREATE TYPE "GuidelineSource" AS ENUM ('racgp','ams','jean_hailes','etg','healthdirect','pubmed','nps','beyond_blue','osteoporosis_australia')`,
        `CREATE TYPE "ConsultationType" AS ENUM ('INITIAL','FOLLOW_UP','REVIEW','EMERGENCY')`,
        `CREATE TYPE "MedicationStatus" AS ENUM ('ACTIVE','DISCONTINUED','PAUSED','COMPLETED')`,
        `CREATE TYPE "ConsentStatus" AS ENUM ('PENDING','ACTIVE','REVOKED','EXPIRED')`,
      ];
      for (const e of hcEnums) {
        try { await _sql.unsafe(e); } catch(_) { /* already exists */ }
      }
      console.log('[db] Healthcare enums ready');

      await _sql(`CREATE TABLE IF NOT EXISTS health_profiles (id TEXT PRIMARY KEY DEFAULT gen_random_uuid(), user_id TEXT NOT NULL, date_of_birth DATE, sex_at_birth TEXT, menopause_status TEXT, height_cm DOUBLE PRECISION, weight_kg DOUBLE PRECISION, blood_type TEXT, allergies TEXT[] DEFAULT '{}', chronic_conditions TEXT[] DEFAULT '{}', current_medications TEXT[] DEFAULT '{}', smoking_status TEXT, alcohol_units_per_week INTEGER, exercise_minutes_per_week INTEGER, family_history JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
      console.log('[db] health_profiles table ready');

      await _sql(`CREATE TABLE IF NOT EXISTS symptom_journals (id TEXT PRIMARY KEY DEFAULT gen_random_uuid(), health_profile_id TEXT NOT NULL REFERENCES health_profiles(id) ON DELETE CASCADE, date DATE NOT NULL, symptom_type TEXT NOT NULL, severity INTEGER NOT NULL DEFAULT 0, duration INTEGER, frequency INTEGER, triggers TEXT[] DEFAULT '{}', relief_factors TEXT[] DEFAULT '{}', impact_on_daily INTEGER, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
      await _sql(`CREATE INDEX IF NOT EXISTS idx_sj_profile_date ON symptom_journals(health_profile_id, date)`);
      console.log('[db] symptom_journals table ready');

      await _sql(`CREATE TABLE IF NOT EXISTS health_metrics (id TEXT PRIMARY KEY DEFAULT gen_random_uuid(), health_profile_id TEXT NOT NULL REFERENCES health_profiles(id) ON DELETE CASCADE, metric_type TEXT NOT NULL, value JSONB NOT NULL, unit TEXT, source TEXT NOT NULL DEFAULT 'apple_health', source_device TEXT, recorded_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
      await _sql(`CREATE INDEX IF NOT EXISTS idx_hm_profile_type_time ON health_metrics(health_profile_id, metric_type, recorded_at)`);
      console.log('[db] health_metrics table ready');

      await _sql(`CREATE TABLE IF NOT EXISTS medications (id TEXT PRIMARY KEY DEFAULT gen_random_uuid(), health_profile_id TEXT NOT NULL REFERENCES health_profiles(id) ON DELETE CASCADE, name TEXT NOT NULL, type TEXT NOT NULL, dosage TEXT NOT NULL, frequency TEXT NOT NULL, route TEXT, start_date DATE NOT NULL, end_date DATE, status TEXT NOT NULL DEFAULT 'ACTIVE', prescribed_by TEXT, notes TEXT, adherence_log JSONB DEFAULT '[]', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
      console.log('[db] medications table ready');

      await _sql(`CREATE TABLE IF NOT EXISTS lab_results (id TEXT PRIMARY KEY DEFAULT gen_random_uuid(), health_profile_id TEXT NOT NULL REFERENCES health_profiles(id) ON DELETE CASCADE, test_name TEXT NOT NULL, test_category TEXT NOT NULL, result_value TEXT NOT NULL, unit TEXT, reference_range TEXT, is_abnormal BOOLEAN NOT NULL DEFAULT false, test_date DATE NOT NULL, laboratory TEXT, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
      console.log('[db] lab_results table ready');

      await _sql(`CREATE TABLE IF NOT EXISTS gp_consultations (id TEXT PRIMARY KEY DEFAULT gen_random_uuid(), patient_id TEXT NOT NULL, gp_id TEXT NOT NULL, date DATE NOT NULL, consultation_type TEXT NOT NULL DEFAULT 'INITIAL', duration INTEGER, summary TEXT NOT NULL, subjective_note TEXT, objective_note TEXT, assessment_note TEXT, plan_note TEXT, treatment_plan TEXT, prescriptions TEXT[] DEFAULT '{}', referrals TEXT[] DEFAULT '{}', follow_up TIMESTAMPTZ, mbs_items TEXT[] DEFAULT '{}', notes TEXT, ai_generated BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
      await _sql(`CREATE INDEX IF NOT EXISTS idx_cons_patient_date ON gp_consultations(patient_id, date)`);
      console.log('[db] gp_consultations table ready');

      await _sql(`CREATE TABLE IF NOT EXISTS patient_consents (id TEXT PRIMARY KEY DEFAULT gen_random_uuid(), health_profile_id TEXT NOT NULL REFERENCES health_profiles(id) ON DELETE CASCADE, gp_id TEXT NOT NULL, consent_type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', granted_at TIMESTAMPTZ, expires_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(health_profile_id, gp_id))`);
      console.log('[db] patient_consents table ready');

      await _sql(`CREATE TABLE IF NOT EXISTS clinical_guidelines (id TEXT PRIMARY KEY DEFAULT gen_random_uuid(), source TEXT NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL, content TEXT NOT NULL, summary TEXT, version TEXT, last_updated TIMESTAMPTZ NOT NULL, url TEXT, keywords TEXT[] DEFAULT '{}')`);
      console.log('[db] clinical_guidelines table ready');

      await _sql(`CREATE TABLE IF NOT EXISTS medical_references (id TEXT PRIMARY KEY DEFAULT gen_random_uuid(), topic TEXT NOT NULL, subtopic TEXT, content TEXT NOT NULL, source TEXT NOT NULL, url TEXT, keywords TEXT[] DEFAULT '{}')`);
      console.log('[db] medical_references table ready');

      await _sql(`CREATE TABLE IF NOT EXISTS health_education (id TEXT PRIMARY KEY DEFAULT gen_random_uuid(), title TEXT NOT NULL, category TEXT NOT NULL, content TEXT NOT NULL, summary TEXT NOT NULL, source TEXT NOT NULL, language TEXT NOT NULL DEFAULT 'en', reading_level TEXT, published_at TIMESTAMPTZ NOT NULL, reviewed_at TIMESTAMPTZ NOT NULL, tags TEXT[] DEFAULT '{}', url TEXT)`);
      console.log('[db] health_education table ready');

      await _sql(`CREATE TABLE IF NOT EXISTS screening_results (id TEXT PRIMARY KEY DEFAULT gen_random_uuid(), health_profile_id TEXT NOT NULL REFERENCES health_profiles(id) ON DELETE CASCADE, screening_type TEXT NOT NULL, score INTEGER NOT NULL, interpretation TEXT NOT NULL, severity TEXT, completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), notes TEXT)`);
      console.log('[db] screening_results table ready');

      // ── Compliance & Audit tables ──
      await _sql(`CREATE TABLE IF NOT EXISTS consent_audit_logs (id TEXT PRIMARY KEY DEFAULT gen_random_uuid(), consent_id TEXT NOT NULL, action TEXT NOT NULL, actor_type TEXT NOT NULL, actor_id TEXT NOT NULL, previous_status TEXT, new_status TEXT, metadata JSONB DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
      await _sql(`CREATE INDEX IF NOT EXISTS idx_cal_consent ON consent_audit_logs(consent_id)`);
      console.log('[db] consent_audit_logs table ready');

      // GP indemnity insurance columns (add to existing gp_profiles)
      try { await _sql(`ALTER TABLE gp_profiles ADD COLUMN IF NOT EXISTS indemnity_provider TEXT`); } catch(_) {}
      try { await _sql(`ALTER TABLE gp_profiles ADD COLUMN IF NOT EXISTS indemnity_policy_number TEXT`); } catch(_) {}
      try { await _sql(`ALTER TABLE gp_profiles ADD COLUMN IF NOT EXISTS indemnity_expiry_date TIMESTAMPTZ`); } catch(_) {}
      console.log('[db] gp_profiles indemnity columns ready');

      // GP AI verification audit columns (add to existing gp_consultations)
      try { await _sql(`ALTER TABLE gp_consultations ADD COLUMN IF NOT EXISTS ai_verified_at TIMESTAMPTZ`); } catch(_) {}
      try { await _sql(`ALTER TABLE gp_consultations ADD COLUMN IF NOT EXISTS ai_verified_by TEXT`); } catch(_) {}
      console.log('[db] gp_consultations ai_verification columns ready');
    });
  } catch (err) {
    console.warn('[db] Migration note:', err.message);
  }
}

export async function query(text, params) {
  await ensureDb();
  if (!_ready) return { rows: [] };
  try {
    const result = await _sql(text, params);
    return { rows: result };
  } catch (err) {
    console.error('[db] Query error:', err.message);
    return { rows: [] };
  }
}

export async function isReady() {
  await ensureDb();
  return _ready;
}

/**
 * Retrieve an encrypted secret from the database.
 * Returns { encrypted, iv, authTag } or null if not found.
 */
export async function getSecret(keyName) {
  await ensureDb();
  if (!_ready) return null;
  try {
    const rows = await _sql`SELECT encrypted_value, iv, auth_tag FROM secrets WHERE key_name = ${keyName}`;
    if (rows.length === 0) return null;
    return {
      encrypted: rows[0].encrypted_value,
      iv: rows[0].iv,
      authTag: rows[0].auth_tag,
    };
  } catch (err) {
    console.error('[db] getSecret error:', err.message);
    return null;
  }
}

/**
 * Store an encrypted secret in the database (upsert).
 */
export async function setSecret(keyName, encryptedValue, iv, authTag) {
  await ensureDb();
  if (!_ready) throw new Error('Database not ready');
  await _sql`
    INSERT INTO secrets (key_name, encrypted_value, iv, auth_tag, updated_at)
    VALUES (${keyName}, ${encryptedValue}, ${iv}, ${authTag}, CURRENT_TIMESTAMP)
    ON CONFLICT (key_name)
    DO UPDATE SET encrypted_value = ${encryptedValue}, iv = ${iv}, auth_tag = ${authTag}, updated_at = CURRENT_TIMESTAMP
  `;
}
