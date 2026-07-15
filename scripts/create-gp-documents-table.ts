/**
 * Creates the gp_documents table for GP verification documents.
 * Run: bun run scripts/create-gp-documents-table.ts
 */
import { createClient } from '../src/lib/db.js';

const DDL = `
CREATE TABLE IF NOT EXISTS gp_documents (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  gp_id           TEXT NOT NULL REFERENCES gp_profiles(id) ON DELETE CASCADE,
  document_type   TEXT NOT NULL,
  file_name       TEXT NOT NULL,
  file_size       INTEGER NOT NULL DEFAULT 0,
  mime_type       TEXT NOT NULL DEFAULT 'application/octet-stream',
  data_base64     TEXT NOT NULL,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

const IDX_GP = `CREATE INDEX IF NOT EXISTS idx_gp_docs_gp_id ON gp_documents(gp_id)`;

async function main() {
  if (!process.env.POSTGRES_URL) {
    console.error('POSTGRES_URL not set');
    process.exit(1);
  }

  const db = createClient();

  try {
    await db.$executeRawUnsafe(DDL);
    console.log('[gp-docs] Table created.');
    await db.$executeRawUnsafe(IDX_GP);
    console.log('[gp-docs] Index created.');
    console.log('[gp-docs] Done.');
  } catch (err) {
    console.error('[gp-docs] Failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
