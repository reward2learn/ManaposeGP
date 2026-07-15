/**
 * Creates the blog_posts table if it doesn't exist.
 * Run: bun run scripts/create-blog-posts-table.ts
 */
import { createClient } from '../src/lib/db.js';

const DDL = `
CREATE TABLE IF NOT EXISTS blog_posts (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  content     TEXT NOT NULL,
  excerpt     TEXT,
  source_url  TEXT,
  source_name TEXT,
  image_url   TEXT,
  author_name TEXT NOT NULL DEFAULT 'ManaposeGP',
  tags        TEXT[] DEFAULT '{}',
  published   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

const IDX1 = `CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(published, created_at DESC)`;
const IDX2 = `CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug)`;

async function main() {
  if (!process.env.POSTGRES_URL) {
    console.error('POSTGRES_URL not set');
    process.exit(1);
  }

  const db = createClient();

  try {
    console.log('[blog-posts] Creating table...');
    await db.$executeRawUnsafe(DDL);
    console.log('[blog-posts] Table created (or already exists).');

    console.log('[blog-posts] Creating indexes...');
    await db.$executeRawUnsafe(IDX1);
    await db.$executeRawUnsafe(IDX2);
    console.log('[blog-posts] Indexes created.');

    const rows = await db.$queryRawUnsafe<Array<{ column_name: string }>>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'blog_posts' ORDER BY ordinal_position`,
    );
    console.log('[blog-posts] Columns:', rows.map(r => r.column_name).join(', '));
    console.log('[blog-posts] Done.');
  } catch (err) {
    console.error('[blog-posts] Failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
