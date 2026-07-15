/**
 * Creates / migrates the gp_profiles table.
 * Adds any missing columns (indemnity fields, practice address, etc.).
 * Run: bun run scripts/create-gp-profiles-table.ts
 */
import { createClient } from '../src/lib/db.js';

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS gp_profiles (
  id                       TEXT PRIMARY KEY,
  user_id                  TEXT NOT NULL UNIQUE,
  name                     TEXT NOT NULL,
  practice_name            TEXT,
  practice_address         TEXT,
  practice_suburb          TEXT,
  practice_state           TEXT,
  practice_postcode        TEXT,
  practice_phone           TEXT,
  ahpra_number             TEXT,
  email                    TEXT,
  indemnity_provider       TEXT,
  indemnity_policy_number  TEXT,
  indemnity_expiry_date    TEXT,
  verified                 BOOLEAN NOT NULL DEFAULT false,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

const MIGRATIONS: string[] = [
  // Add missing columns if they don't exist yet
  `ALTER TABLE gp_profiles ADD COLUMN IF NOT EXISTS practice_address TEXT`,
  `ALTER TABLE gp_profiles ADD COLUMN IF NOT EXISTS practice_suburb TEXT`,
  `ALTER TABLE gp_profiles ADD COLUMN IF NOT EXISTS practice_state TEXT`,
  `ALTER TABLE gp_profiles ADD COLUMN IF NOT EXISTS practice_postcode TEXT`,
  `ALTER TABLE gp_profiles ADD COLUMN IF NOT EXISTS practice_phone TEXT`,
  `ALTER TABLE gp_profiles ADD COLUMN IF NOT EXISTS indemnity_provider TEXT`,
  `ALTER TABLE gp_profiles ADD COLUMN IF NOT EXISTS indemnity_policy_number TEXT`,
  `ALTER TABLE gp_profiles ADD COLUMN IF NOT EXISTS indemnity_expiry_date TEXT`,
];

const INDEX_USER_ID = `CREATE INDEX IF NOT EXISTS idx_gp_profiles_user_id ON gp_profiles(user_id)`;
const INDEX_VERIFIED = `CREATE INDEX IF NOT EXISTS idx_gp_profiles_verified ON gp_profiles(verified)`;

async function main() {
  if (!process.env.POSTGRES_URL) {
    console.error('POSTGRES_URL not set');
    process.exit(1);
  }

  const db = createClient();

  try {
    console.log('[gp-profiles] Ensuring table exists...');
    await db.$executeRawUnsafe(CREATE_TABLE);

    console.log('[gp-profiles] Running migrations for missing columns...');
    for (const sql of MIGRATIONS) {
      await db.$executeRawUnsafe(sql);
    }

    console.log('[gp-profiles] Ensuring indexes...');
    await db.$executeRawUnsafe(INDEX_USER_ID);
    await db.$executeRawUnsafe(INDEX_VERIFIED);

    // Verify columns
    const rows = await db.$queryRawUnsafe<Array<{ column_name: string }>>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'gp_profiles' ORDER BY ordinal_position`,
    );
    console.log('[gp-profiles] Columns:', rows.map(r => r.column_name).join(', '));

    console.log('[gp-profiles] Done.');
  } catch (err) {
    console.error('[gp-profiles] Failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
