/**
 * Blog Service — create, list, update, and retrieve blog posts.
 */
import { createClient } from '@/lib/db';
import type { ScrapedContent } from './url-scraper';
import type { EnhancedContent } from './content-enhancer';

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  sourceUrl?: string;
  sourceName?: string;
  imageUrl?: string;
  sectionImages: Array<{ src: string; alt: string; caption?: string }>;
  authorName: string;
  tags: string[];
  published: boolean;
  createdAt: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function makeUniqueSlug(base: string): string {
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

/** Ensure section_images column exists on blog_posts */
export async function ensureBlogPostColumns(db: ReturnType<typeof createClient>): Promise<void> {
  try {
    await db.$executeRawUnsafe(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS section_images JSONB NOT NULL DEFAULT '[]'`);
  } catch { /* column may already exist */ }
}

/**
 * Create a blog post from scraped + enhanced content.
 */
export async function createBlogPost(params: {
  scraped: ScrapedContent;
  enhanced: EnhancedContent;
  sourceUrl: string;
  published?: boolean;
  imageUrl?: string;
  sectionImages?: Array<{ src: string; alt: string; caption?: string }>;
}): Promise<BlogPost> {
  const db = createClient();
  await ensureBlogPostColumns(db);

  const result = await db.$queryRawUnsafe<Array<BlogPost>>(
    `INSERT INTO blog_posts (id, title, slug, content, excerpt, source_url, source_name, image_url, section_images, author_name, tags, published)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'ManaposeGP', $9, $10)
     RETURNING id, title, slug, content, excerpt, source_url as "sourceUrl", source_name as "sourceName", image_url as "imageUrl", COALESCE(section_images, '[]') as "sectionImages", author_name as "authorName", tags, published, created_at as "createdAt"`,
    params.enhanced.title,
    makeUniqueSlug(slugify(params.enhanced.title)),
    params.enhanced.content,
    params.enhanced.excerpt || params.scraped.excerpt,
    params.sourceUrl,
    params.scraped.sourceName || null,
    params.imageUrl || params.scraped.imageUrl || null,
    JSON.stringify(params.sectionImages || []),
    params.enhanced.tags.length > 0 ? params.enhanced.tags : [],
    params.published ?? true,
  );

  return result[0];
}

const BLOG_SELECT = `id, title, slug, content, excerpt, source_url as "sourceUrl", source_name as "sourceName", image_url as "imageUrl", COALESCE(section_images, '[]'::jsonb) as "sectionImages", author_name as "authorName", COALESCE(tags, '{}') as tags, published, created_at as "createdAt"`;

/**
 * List published blog posts, newest first.
 */
export async function listBlogPosts(limit = 20, offset = 0): Promise<BlogPost[]> {
  const db = createClient();
  const rows = await db.$queryRawUnsafe<Array<BlogPost>>(
    `SELECT ${BLOG_SELECT}
     FROM blog_posts
     WHERE published = true
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    limit,
    offset,
  );
  return rows;
}

/**
 * List ALL blog posts (including drafts) for admin.
 */
export async function listAllBlogPosts(limit = 50, offset = 0): Promise<BlogPost[]> {
  const db = createClient();
  const rows = await db.$queryRawUnsafe<Array<BlogPost>>(
    `SELECT ${BLOG_SELECT}
     FROM blog_posts
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    limit,
    offset,
  );
  return rows;
}

/**
 * Get a single blog post by slug (published only).
 */
export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const db = createClient();
  const result = await db.$queryRawUnsafe<Array<BlogPost>>(
    `SELECT ${BLOG_SELECT}
     FROM blog_posts
     WHERE slug = $1 AND published = true`,
    slug,
  );
  return result[0] ?? null;
}

/**
 * Get a blog post by ID (any status — for admin and AI).
 */
export async function getBlogPostById(id: string): Promise<BlogPost | null> {
  const db = createClient();
  const result = await db.$queryRawUnsafe<Array<BlogPost>>(
    `SELECT ${BLOG_SELECT} FROM blog_posts WHERE id = $1`,
    id,
  );
  return result[0] ?? null;
}

/**
 * Update a blog post.
 */
export async function updateBlogPost(
  id: string,
  data: Partial<{
    title: string;
    content: string;
    excerpt: string;
    imageUrl: string | null;
    sectionImages: Array<{ src: string; alt: string; caption?: string }>;
    tags: string[];
    published: boolean;
  }>,
): Promise<BlogPost | null> {
  const db = createClient();
  await ensureBlogPostColumns(db);

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.title !== undefined) { setClauses.push(`title = $${idx++}`); values.push(data.title); }
  if (data.content !== undefined) { setClauses.push(`content = $${idx++}`); values.push(data.content); }
  if (data.excerpt !== undefined) { setClauses.push(`excerpt = $${idx++}`); values.push(data.excerpt); }
  if (data.imageUrl !== undefined) { setClauses.push(`image_url = $${idx++}`); values.push(data.imageUrl); }
  if (data.sectionImages !== undefined) { setClauses.push(`section_images = $${idx++}::jsonb`); values.push(JSON.stringify(data.sectionImages)); }
  if (data.tags !== undefined) { setClauses.push(`tags = $${idx++}`); values.push(data.tags); }
  if (data.published !== undefined) { setClauses.push(`published = $${idx++}`); values.push(data.published); }

  if (setClauses.length === 0) return null;

  values.push(id);
  await db.$executeRawUnsafe(
    `UPDATE blog_posts SET ${setClauses.join(', ')} WHERE id = $${idx}`,
    ...values,
  );

  return getBlogPostById(id);
}

/**
 * Check if a post with the given source URL already exists in the database.
 * Returns the existing post if found, null otherwise.
 */
export async function findPostBySourceUrl(sourceUrl: string): Promise<BlogPost | null> {
  if (!sourceUrl) return null;
  const db = createClient();
  const result = await db.$queryRawUnsafe<Array<BlogPost>>(
    `SELECT id, title, slug, content, excerpt, source_url as "sourceUrl", source_name as "sourceName", image_url as "imageUrl", author_name as "authorName", COALESCE(tags, '{}') as tags, published, created_at as "createdAt"
     FROM blog_posts
     WHERE source_url = $1
     LIMIT 1`,
    sourceUrl,
  );
  return result[0] ?? null;
}
