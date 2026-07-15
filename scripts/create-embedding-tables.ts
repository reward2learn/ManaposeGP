/**
 * Creates pgvector embedding tables for AI knowledge base.
 * Run: bun run scripts/create-embedding-tables.ts
 */
import { createClient } from '../src/lib/db.js';

const EXTENSION = `CREATE EXTENSION IF NOT EXISTS vector`;

const BLOG_TABLE = `
CREATE TABLE IF NOT EXISTS blog_embeddings (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  blog_id     TEXT NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text  TEXT NOT NULL,
  embedding   vector(1536),
  tokens      INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

const CONVERSATION_TABLE = `
CREATE TABLE IF NOT EXISTS conversation_embeddings (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  message_role    TEXT NOT NULL,  -- 'user' or 'assistant'
  chunk_text      TEXT NOT NULL,
  embedding       vector(1536),
  tokens          INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

const BLOG_IDX = `CREATE INDEX IF NOT EXISTS idx_blog_emb_blog_id ON blog_embeddings(blog_id)`;
const CONV_IDX = `CREATE INDEX IF NOT EXISTS idx_conv_emb_conv_id ON conversation_embeddings(conversation_id)`;

// IVFFlat indexes for approximate nearest-neighbor search (build after data exists)
const BLOG_VEC_IDX = `CREATE INDEX IF NOT EXISTS idx_blog_emb_embedding ON blog_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`;
const CONV_VEC_IDX = `CREATE INDEX IF NOT EXISTS idx_conv_emb_embedding ON conversation_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`;

async function main() {
  if (!process.env.POSTGRES_URL) {
    console.error('POSTGRES_URL not set');
    process.exit(1);
  }

  const db = createClient();

  try {
    // Enable extension
    await db.$executeRawUnsafe(EXTENSION);
    console.log('[embeddings] pgvector extension enabled.');

    // Create tables
    await db.$executeRawUnsafe(BLOG_TABLE);
    console.log('[embeddings] blog_embeddings table ready.');

    await db.$executeRawUnsafe(CONVERSATION_TABLE);
    console.log('[embeddings] conversation_embeddings table ready.');

    // Create indexes
    await db.$executeRawUnsafe(BLOG_IDX);
    await db.$executeRawUnsafe(CONV_IDX);
    console.log('[embeddings] FK indexes created.');

    // IVFFlat indexes (may fail if table is empty — that's OK)
    try {
      await db.$executeRawUnsafe(BLOG_VEC_IDX);
      await db.$executeRawUnsafe(CONV_VEC_IDX);
      console.log('[embeddings] IVFFlat vector indexes created.');
    } catch {
      console.log('[embeddings] IVFFlat indexes deferred (need data first).');
    }

    // Verify
    const tables = await db.$queryRawUnsafe<Array<{ tablename: string }>>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '%embedding%'`,
    );
    console.log('[embeddings] Tables:', tables.map(r => r.tablename).join(', '));

    console.log('[embeddings] Done — AI knowledge base ready.');
  } catch (err) {
    console.error('[embeddings] Failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
