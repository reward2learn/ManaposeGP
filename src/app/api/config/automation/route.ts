/**
 * Automation Config API — GET/POST for admin page.
 * Also supports POST ?action=scrape-url for single Instagram post extraction.
 */
import { NextResponse } from 'next/server';
import { requirePin } from '@/lib/auth/guards';
import { getConfig, updateConfig, getLogs } from '@/domain/blog/automation-service';
import { scrapeInstagramPostUrl } from '@/domain/blog/instagram-scraper';
import { scrapeUrl, type ScrapedContent } from '@/domain/blog/url-scraper';
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
    const body = await request.json() as { url?: string; type?: string };
    const postUrl = body.url?.trim();

    if (!postUrl) {
      return NextResponse.json({ success: false, error: 'URL is required' }, { status: 400 });
    }

    // Instagram URL handling
    if (postUrl.includes('instagram.com')) {
      return handleInstagramScrape(postUrl);
    }

    // General health article URL handling
    return handleArticleScrape(postUrl);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to process post' },
      { status: 500 },
    );
  }
}

async function handleInstagramScrape(postUrl: string): Promise<NextResponse> {
  const post = await scrapeInstagramPostUrl(postUrl);
  if (!post) {
    return NextResponse.json({ success: false, error: 'Could not extract Instagram post. The post may be private or Instagram blocked the request.' }, { status: 400 });
  }

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

  indexBlogPost(blogPost.id, blogPost.title, blogPost.content).catch(() => {});

  return NextResponse.json({
    success: true,
    post: { title: blogPost.title, slug: blogPost.slug, url: post.url, type: 'instagram' },
  });
}

async function handleArticleScrape(articleUrl: string): Promise<NextResponse> {
  let scraped: ScrapedContent;
  try {
    scraped = await scrapeUrl(articleUrl);
  } catch {
    return NextResponse.json({ success: false, error: 'Could not scrape this URL. The site may block automated access or the content may be behind a paywall.' }, { status: 400 });
  }

  if (!scraped.content || scraped.content.length < 50) {
    return NextResponse.json({ success: false, error: 'Scraped content is too short. The page may not contain enough article text.' }, { status: 400 });
  }

  const enhanced = await enhanceContent(scraped.title, scraped.content, scraped.sourceName ?? 'External source');
  const blogPost = await createBlogPost({
    scraped,
    enhanced,
    sourceUrl: articleUrl,
  });

  indexBlogPost(blogPost.id, blogPost.title, blogPost.content).catch(() => {});

  return NextResponse.json({
    success: true,
    post: { title: blogPost.title, slug: blogPost.slug, url: articleUrl, type: 'article' },
  });
}
