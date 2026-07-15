/**
 * POST /api/blog/create — scrape a URL and create a blog post.
 * Auth: pin tier only (platform admin).
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePin } from '@/lib/auth/guards';
import { scrapeUrl } from '@/domain/blog/url-scraper';
import { enhanceContent } from '@/domain/blog/content-enhancer';
import { createBlogPost } from '@/domain/blog/blog-service';
import { indexBlogPost } from '@/domain/knowledge/ai-indexer';

const createSchema = z.object({
  url: z.string().url(),
});

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'A valid URL is required' },
      { status: 400 },
    );
  }

  const { url } = parsed.data;

  try {
    // Step 1: Scrape
    const scraped = await scrapeUrl(url);

    // Step 2: Enhance with AI
    const enhanced = await enhanceContent(scraped.title, scraped.content, scraped.sourceName);

    // Step 3: Create blog post
    const post = await createBlogPost({ scraped, enhanced, sourceUrl: url });

    // Step 4: Index into AI knowledge base (fire-and-forget)
    indexBlogPost(post.id, post.title, post.content).then(
      (count) => console.log(`[blog/create] Indexed ${count} chunks for "${post.title}"`),
      (err) => console.error('[blog/create] Indexing failed:', err instanceof Error ? err.message : err),
    );

    return NextResponse.json({
      success: true,
      post: {
        id: post.id,
        title: post.title,
        slug: post.slug,
        sourceName: post.sourceName,
        tags: post.tags,
      },
      scrapedTitle: scraped.title,
    });
  } catch (err) {
    console.error('[blog/create] Error:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create blog post. Check that the URL is accessible.',
      },
      { status: 500 },
    );
  }
}
