/**
 * Health Education Service — admin CRUD for health_education articles.
 * Uses ZenStack Prisma client for reads (@@allow('read', true)),
 * raw SQL for writes (no ZenStack write policies configured).
 */
import { createClient, type DbClient } from '@/lib/db';

// ── Types ────────────────────────────────────────────────────────────────────

export const HEALTH_EDUCATION_CATEGORIES = [
  'menopause',
  'mental_health',
  'bone_health',
  'cardiovascular',
  'sexual_health',
  'nutrition',
  'exercise',
  'sleep',
  'general',
] as const;

export type HealthEducationCategory = (typeof HEALTH_EDUCATION_CATEGORIES)[number];

export const HEALTH_EDUCATION_SOURCES = [
  'jean_hailes',
  'ams',
  'healthdirect',
  'beyond_blue',
  'racgp',
  'nps',
  'pubmed',
  'etg',
  'osteoporosis_australia',
  'admin',
] as const;

export type HealthEducationSource = (typeof HEALTH_EDUCATION_SOURCES)[number];

export const HEALTH_EDUCATION_LANGUAGES = ['en', 'es', 'fr', 'zh', 'ar', 'hi', 'pt'] as const;
export type HealthEducationLanguage = (typeof HEALTH_EDUCATION_LANGUAGES)[number];

export const READING_LEVELS = ['easy_read', 'standard', 'clinical'] as const;
export type ReadingLevel = (typeof READING_LEVELS)[number];

export interface HealthEducationArticle {
  id: string;
  title: string;
  category: string;
  content: string;
  summary: string;
  source: string;
  language: string;
  readingLevel: string | null;
  publishedAt: string;
  reviewedAt: string;
  tags: string[];
  url: string | null;
}

export interface HealthEducationUpdate {
  title?: string;
  category?: string;
  content?: string;
  summary?: string;
  source?: string;
  language?: string;
  readingLevel?: string | null;
  tags?: string[];
  url?: string | null;
  reviewedAt?: string;
}

// ── SELECT fragment (matches raw SQL column aliases to interface keys) ───────

const HE_SELECT = [
  'id',
  'title',
  'category',
  'content',
  'summary',
  'source',
  'language',
  'reading_level as "readingLevel"',
  'published_at::text as "publishedAt"',
  'reviewed_at::text as "reviewedAt"',
  'COALESCE(tags, \'{}\') as tags',
  'url',
].join(', ');

// ── Knowledge snippet helpers ─────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

async function upsertKnowledgeSnippet(
  db: DbClient,
  title: string,
  category: string,
  content: string,
  summary: string,
): Promise<void> {
  const snippetKey = `admin_${slugify(title)}`;
  await db.$executeRawUnsafe(
    `INSERT INTO knowledge_snippets (id, key, category, content)
     VALUES (gen_random_uuid()::text, $1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET content = EXCLUDED.content, category = EXCLUDED.category`,
    snippetKey,
    `health_${category}`,
    `${title}\n\n${summary}\n\n${content}`,
  );
}

async function deleteKnowledgeSnippet(db: DbClient, title: string): Promise<void> {
  const snippetKey = `admin_${slugify(title)}`;
  await db.$executeRawUnsafe(
    `DELETE FROM knowledge_snippets WHERE key = $1`,
    snippetKey,
  );
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * List all health education articles (admin view — no public/private filter).
 * Uses Prisma client for reads since @@allow('read', true) is configured.
 */
export async function listAllHealthEducation(): Promise<HealthEducationArticle[]> {
  const db = createClient({ tier: 'public' });
  const articles = await db.healthEducation.findMany({
    orderBy: { publishedAt: 'desc' },
  });
  return articles.map((a) => ({
    id: a.id,
    title: a.title,
    category: a.category,
    content: a.content,
    summary: a.summary,
    source: a.source,
    language: a.language,
    readingLevel: a.readingLevel ?? null,
    publishedAt: a.publishedAt.toISOString(),
    reviewedAt: a.reviewedAt.toISOString(),
    tags: a.tags,
    url: a.url ?? null,
  }));
}

/**
 * Get a single health education article by ID.
 */
export async function getHealthEducationById(id: string): Promise<HealthEducationArticle | null> {
  const db = createClient({ tier: 'public' });
  const a = await db.healthEducation.findUnique({ where: { id } });
  if (!a) return null;
  return {
    id: a.id,
    title: a.title,
    category: a.category,
    content: a.content,
    summary: a.summary,
    source: a.source,
    language: a.language,
    readingLevel: a.readingLevel ?? null,
    publishedAt: a.publishedAt.toISOString(),
    reviewedAt: a.reviewedAt.toISOString(),
    tags: a.tags,
    url: a.url ?? null,
  };
}

/**
 * Update a health education article. Uses raw SQL for writes.
 * Syncs the associated knowledge snippet when content/ title change.
 */
export async function updateHealthEducation(
  id: string,
  data: HealthEducationUpdate,
): Promise<HealthEducationArticle | null> {
  const db = createClient({ tier: 'pin' });

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.title !== undefined) { setClauses.push(`title = $${idx++}`); values.push(data.title); }
  if (data.category !== undefined) { setClauses.push(`category = $${idx++}`); values.push(data.category); }
  if (data.content !== undefined) { setClauses.push(`content = $${idx++}`); values.push(data.content); }
  if (data.summary !== undefined) { setClauses.push(`summary = $${idx++}`); values.push(data.summary); }
  if (data.source !== undefined) { setClauses.push(`source = $${idx++}`); values.push(data.source); }
  if (data.language !== undefined) { setClauses.push(`language = $${idx++}`); values.push(data.language); }
  if (data.readingLevel !== undefined) { setClauses.push(`reading_level = $${idx++}`); values.push(data.readingLevel); }
  if (data.tags !== undefined) { setClauses.push(`tags = $${idx++}`); values.push(data.tags); }
  if (data.url !== undefined) { setClauses.push(`url = $${idx++}`); values.push(data.url); }
  if (data.reviewedAt !== undefined) { setClauses.push(`reviewed_at = $${idx++}::timestamptz`); values.push(data.reviewedAt); }

  if (setClauses.length === 0) return getHealthEducationById(id);

  // Always bump reviewed_at if not explicitly set
  if (data.reviewedAt === undefined) {
    setClauses.push(`reviewed_at = NOW()`);
  }

  values.push(id);
  await db.$executeRawUnsafe(
    `UPDATE health_education SET ${setClauses.join(', ')} WHERE id = $${idx}`,
    ...values,
  );

  // Sync knowledge snippet if content or title changed
  const updated = await getHealthEducationById(id);
  if (updated && (data.content !== undefined || data.title !== undefined || data.summary !== undefined)) {
    await upsertKnowledgeSnippet(db, updated.title, updated.category, updated.content, updated.summary).catch(() => {});
  }

  return updated;
}

/**
 * Delete a health education article and its associated knowledge snippet.
 */
export async function deleteHealthEducation(id: string): Promise<boolean> {
  const db = createClient({ tier: 'pin' });

  // Get title before deleting so we can clean up the knowledge snippet
  const article = await db.healthEducation.findUnique({ where: { id }, select: { title: true } });
  if (!article) return false;

  // Delete the article
  await db.healthEducation.delete({ where: { id } });

  // Clean up knowledge snippet (fire-and-forget)
  deleteKnowledgeSnippet(db, article.title).catch(() => {});

  return true;
}
