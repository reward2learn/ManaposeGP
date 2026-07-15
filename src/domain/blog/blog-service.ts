/**
 * Blog Service — create, list, and retrieve blog posts.
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

/**
 * Create a blog post from scraped + enhanced content.
 */
export async function createBlogPost(params: {
  scraped: ScrapedContent;
  enhanced: EnhancedContent;
  sourceUrl: string;
}): Promise<BlogPost> {
  const db = createClient();

  const result = await db.$queryRawUnsafe<Array<BlogPost>>(
    `INSERT INTO blog_posts (id, title, slug, content, excerpt, source_url, source_name, image_url, author_name, tags, published)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, 'ManaposeGP', $8, true)
     RETURNING id, title, slug, content, excerpt, source_url as "sourceUrl", source_name as "sourceName", image_url as "imageUrl", author_name as "authorName", tags, published, created_at as "createdAt"`,
    params.enhanced.title,
    makeUniqueSlug(slugify(params.enhanced.title)),
    params.enhanced.content,
    params.enhanced.excerpt || params.scraped.excerpt,
    params.sourceUrl,
    params.scraped.sourceName || null,
    params.scraped.imageUrl || null,
    params.enhanced.tags.length > 0 ? params.enhanced.tags : [],
  );

  return result[0];
}

/**
 * List published blog posts, newest first.
 */
export async function listBlogPosts(limit = 20, offset = 0): Promise<BlogPost[]> {
  const db = createClient();
  const rows = await db.$queryRawUnsafe<Array<BlogPost>>(
    `SELECT id, title, slug, excerpt, source_url as "sourceUrl", source_name as "sourceName", image_url as "imageUrl", author_name as "authorName", COALESCE(tags, '{}') as tags, published, created_at as "createdAt"
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
 * Get a single blog post by slug.
 */
export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const db = createClient();
  const result = await db.$queryRawUnsafe<Array<BlogPost>>(
    `SELECT id, title, slug, content, excerpt, source_url as "sourceUrl", source_name as "sourceName", image_url as "imageUrl", author_name as "authorName", COALESCE(tags, '{}') as tags, published, created_at as "createdAt"
     FROM blog_posts
     WHERE slug = $1 AND published = true`,
    slug,
  );
  return result[0] ?? null;
}

/**
 * Get a single blog post by ID.
 */
export async function getBlogPostById(id: string): Promise<BlogPost | null> {
  const db = createClient();
  const result = await db.$queryRawUnsafe<Array<BlogPost>>(
    `SELECT id, title, slug, content, excerpt, source_url as "sourceUrl", source_name as "sourceName", image_url as "imageUrl", author_name as "authorName", COALESCE(tags, '{}') as tags, published, created_at as "createdAt"
     FROM blog_posts
     WHERE id = $1`,
    id,
  );
  return result[0] ?? null;
}
