/**
 * Creates the instagram_automation config table.
 * Run: bun run scripts/create-automation-config-table.ts
 */
import { createClient } from '../src/lib/db.js';

const TABLE_DDL = `
CREATE TABLE IF NOT EXISTS instagram_automation (
  id                    TEXT PRIMARY KEY DEFAULT 'default',
  enabled               BOOLEAN NOT NULL DEFAULT false,
  instagram_username    TEXT NOT NULL DEFAULT 'menopause_doctor',
  max_posts_per_run     INTEGER NOT NULL DEFAULT 5,
  schedule_time         TEXT NOT NULL DEFAULT '23:00',
  schedule_timezone     TEXT NOT NULL DEFAULT 'Australia/Sydney',
  last_run_at           TIMESTAMPTZ,
  last_post_timestamp   TEXT,
  total_posts_created   INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

const LOG_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS instagram_automation_logs (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  run_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status        TEXT NOT NULL,       -- 'success', 'partial', 'failed', 'disabled'
  posts_found   INTEGER DEFAULT 0,
  posts_created INTEGER DEFAULT 0,
  error_message TEXT,
  details       JSON
)`;

async function main() {
  if (!process.env.POSTGRES_URL) {
    console.error('POSTGRES_URL not set');
    process.exit(1);
  }

  const db = createClient();

  try {
    await db.$executeRawUnsafe(TABLE_DDL);
    console.log('[automation] instagram_automation table ready.');

    await db.$executeRawUnsafe(LOG_TABLE_DDL);
    console.log('[automation] instagram_automation_logs table ready.');

    // Add schedule columns if migrating from older schema (MUST run before INSERT)
    try { await db.$executeRawUnsafe(`ALTER TABLE instagram_automation ADD COLUMN IF NOT EXISTS schedule_time TEXT NOT NULL DEFAULT '23:00'`); } catch { /* exists */ }
    try { await db.$executeRawUnsafe(`ALTER TABLE instagram_automation ADD COLUMN IF NOT EXISTS schedule_timezone TEXT NOT NULL DEFAULT 'Australia/Sydney'`); } catch { /* exists */ }

    // Ensure default row exists
    await db.$executeRawUnsafe(
      `INSERT INTO instagram_automation (id, enabled, instagram_username, max_posts_per_run, schedule_time, schedule_timezone)
       VALUES ('default', false, 'menopause_doctor', 5, '23:00', 'Australia/Sydney')
       ON CONFLICT (id) DO NOTHING`,
    );

    console.log('[automation] Default config row seeded.');
    console.log('[automation] Done.');
  } catch (err) {
    console.error('[automation] Failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
