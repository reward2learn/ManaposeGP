/**
 * Automation Config API — GET/POST for admin page.
 * Also supports POST ?action=scrape-url for single Instagram post extraction.
 */
import { NextResponse } from 'next/server';
import { requirePin } from '@/lib/auth/guards';
import { getConfig, updateConfig, getLogs } from '@/domain/blog/automation-service';
import { scrapeInstagramPostUrl } from '@/domain/blog/instagram-scraper';
import { enhanceContent } from '@/domain/blog/content-enhancer';
import { createBlogPost } from '@/domain/blog/blog-service';
import { indexBlogPost } from '@/domain/knowledge/ai-indexer';

export async function GET(): Promise<NextResponse> {
  try {
    const [config, logs] = await Promise.all([getConfig(), getLogs(20)]);
    return NextResponse.json({ success: true, config, logs });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  // Single URL scraping
  if (action === 'scrape-url') {
    return handleScrapeUrl(request);
  }

  // Config update
  try {
    const body = await request.json() as {
      enabled?: boolean;
      instagramUsername?: string;
      maxPostsPerRun?: number;
      scheduleTime?: string;
      scheduleTimezone?: string;
    };

    await updateConfig({
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
      ...(body.instagramUsername ? { instagramUsername: body.instagramUsername } : {}),
      ...(body.maxPostsPerRun ? { maxPostsPerRun: body.maxPostsPerRun } : {}),
      ...(body.scheduleTime ? { scheduleTime: body.scheduleTime } : {}),
      ...(body.scheduleTimezone ? { scheduleTimezone: body.scheduleTimezone } : {}),
    });

    const config = await getConfig();
    return NextResponse.json({ success: true, config });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 },
    );
  }
}

async function handleScrapeUrl(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json() as { url?: string };
    const postUrl = body.url?.trim();

    if (!postUrl) {
      return NextResponse.json({ success: false, error: 'URL is required' }, { status: 400 });
    }

    if (!postUrl.includes('instagram.com')) {
      return NextResponse.json({ success: false, error: 'Only Instagram URLs are supported' }, { status: 400 });
    }

    const post = await scrapeInstagramPostUrl(postUrl);
    if (!post) {
      return NextResponse.json({ success: false, error: 'Could not extract post. The post may be private or Instagram blocked the request.' }, { status: 400 });
    }

    // Enhance with AI and create blog post
    const sourceName = `Instagram (@${postUrl.match(/instagram\.com\/([^/]+)/)?.[1] || 'unknown'})`;
    const scraped = {
      title: post.caption.slice(0, 80).replace(/\n/g, ' '),
      content: post.caption,
      excerpt: post.caption.slice(0, 200) + '…',
      imageUrl: post.imageUrl,
      images: post.imageUrl ? [{ src: post.imageUrl, alt: post.caption.slice(0, 100) }] : [],
      sourceName,
    };

    const enhanced = await enhanceContent(scraped.title, scraped.content, sourceName);
    const blogPost = await createBlogPost({ scraped, enhanced, sourceUrl: post.url });

    // Fire-and-forget indexing
    indexBlogPost(blogPost.id, blogPost.title, blogPost.content).catch(() => {});

    return NextResponse.json({
      success: true,
      post: { title: blogPost.title, slug: blogPost.slug, url: post.url },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to process post' },
      { status: 500 },
    );
  }
}
