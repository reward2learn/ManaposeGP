/**
 * Instagram Automation Cron Job
 * Called by Vercel Cron every night at 11pm AEST (13:00 UTC).
 * Also callable manually via POST by admin.
 *
 * Workflow:
 * 1. Check if automation is enabled
 * 2. Scrape Instagram profile for new posts
 * 3. For each post: enhance with AI → create blog post → index into knowledge base
 * 4. Update config with last run timestamp
 * 5. Log results
 */
import { NextResponse } from 'next/server';
import { scrapeInstagramProfile } from '@/domain/blog/instagram-scraper';
import { enhanceContent } from '@/domain/blog/content-enhancer';
import { createBlogPost, findPostBySourceUrl, type BlogPost } from '@/domain/blog/blog-service';
import { indexBlogPost } from '@/domain/knowledge/ai-indexer';
import { getConfig, updateConfig, addLog, shouldRunNow } from '@/domain/blog/automation-service';
import { requirePin } from '@/lib/auth/guards';

export const maxDuration = 120; // Allow up to 2 minutes for scraping + AI

export async function GET(request: Request): Promise<NextResponse> {
  return handleCron(false); // Scheduled run — respects schedule time
}

export async function POST(request: Request): Promise<NextResponse> {
  // Manual trigger requires admin auth
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;
  return handleCron(true); // Manual trigger — always runs
}

async function handleCron(forceRun: boolean): Promise<NextResponse> {
  const config = await getConfig();

  if (!config.enabled) {
    await addLog({ status: 'disabled', postsFound: 0, postsCreated: 0 });
    return NextResponse.json({ success: true, message: 'Automation is disabled', postsCreated: 0 });
  }

  // For scheduled runs, check if it's the configured time
  if (!forceRun && !shouldRunNow(config)) {
    return NextResponse.json({ success: true, message: 'Not scheduled time yet', scheduleTime: config.scheduleTime });
  }

  const startTime = Date.now();
  let postsFound = 0;
    let postsCreated = 0;
    let duplicatesSkipped = 0;
    const errors: string[] = [];
  const created: Array<{ title: string; slug: string }> = [];

  try {
    // Scrape Instagram
    const posts = await scrapeInstagramProfile(
      config.instagramUsername,
      config.maxPostsPerRun,
    );
    postsFound = posts.length;

    if (!posts.length) {
      await updateConfig({ lastRunAt: new Date().toISOString() });
      await addLog({ status: 'success', postsFound: 0, postsCreated: 0, details: { message: 'No new posts found' } });
      return NextResponse.json({ success: true, message: 'No new posts found', postsFound: 0 });
    }

    // Process each post (skip duplicates)
    for (const post of posts) {
      try {
        // Check for duplicate by source URL
        const existing = await findPostBySourceUrl(post.url);
        if (existing) {
          console.log(`[cron] Skipping duplicate: ${post.url} (already exists as "${existing.title}")`);
          duplicatesSkipped++;
          continue;
        }

        const scraped = {
          title: post.caption.slice(0, 80).replace(/\n/g, ' '),
          content: post.caption,
          excerpt: post.caption.slice(0, 200) + '…',
          imageUrl: post.imageUrl,
          images: post.imageUrl ? [{ src: post.imageUrl, alt: post.caption.slice(0, 100) }] : [],
          sourceName: `@${config.instagramUsername} (Instagram)`,
        };

        const enhanced = await enhanceContent(scraped.title, scraped.content, scraped.sourceName);
        const blogPost = await createBlogPost({
          scraped, enhanced, sourceUrl: post.url,
          published: true, imageUrl: post.imageUrl || undefined,
        });

        // Index into knowledge base (fire-and-forget)
        indexBlogPost(blogPost.id, blogPost.title, blogPost.content).then(
          () => {},
          (err: Error) => console.error('[cron] Indexing failed:', err.message),
        );

        postsCreated++;
        created.push({ title: blogPost.title, slug: blogPost.slug });
      } catch (err) {
        errors.push(err instanceof Error ? err.message : 'Unknown error processing post');
      }
    }

    // Update config
    await updateConfig({
      lastRunAt: new Date().toISOString(),
      totalPostsCreated: config.totalPostsCreated + postsCreated,
    });

    // Log
    await addLog({
      status: postsCreated > 0 ? 'success' : errors.length > 0 ? 'partial' : 'success',
      postsFound,
      postsCreated,
      errorMessage: errors.length ? errors.join('; ') : undefined,
      details: { durationMs: Date.now() - startTime, duplicatesSkipped, created },
    });

    return NextResponse.json({
      success: true,
      postsFound,
      postsCreated,
      errors: errors.length ? errors : undefined,
      created,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cron job failed';
    console.error('[cron] Fatal error:', message);
    await addLog({ status: 'failed', postsFound, postsCreated, errorMessage: message });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
