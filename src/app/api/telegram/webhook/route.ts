/**
 * Telegram Bot Webhook — receives messages, scrapes URLs, creates blog posts.
 *
 * Setup:
 * 1. Create bot via @BotFather on Telegram → get TELEGRAM_BOT_TOKEN
 * 2. Set webhook: POST https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://manaposegp.vercel.app/api/telegram/webhook
 * 3. Store TELEGRAM_BOT_TOKEN in secrets table (key: TELEGRAM_BOT_TOKEN)
 *
 * Usage: Admin sends a URL to the bot → bot scrapes it → creates blog post → replies with link
 */
import { NextResponse } from 'next/server';
import { getSecretPlaintext } from '@/lib/secrets';
import { scrapeUrl } from '@/domain/blog/url-scraper';
import { enhanceContent } from '@/domain/blog/content-enhancer';
import { createBlogPost } from '@/domain/blog/blog-service';
import { indexBlogPost } from '@/domain/knowledge/ai-indexer';

// ── Telegram helpers ─────────────────────────────────────────────────────────

async function getBotToken(): Promise<string | null> {
  try {
    const stored = await getSecretPlaintext('TELEGRAM_BOT_TOKEN');
    if (stored) return stored;
  } catch { /* fall through to env */ }
  return process.env.TELEGRAM_BOT_TOKEN ?? null;
}

async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  const token = await getBotToken();
  if (!token) return;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    }),
  });
}

function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s)]+/g;
  return text.match(urlRegex) || [];
}

// ── Webhook handler ──────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  let body: { message?: { chat?: { id: number }; text?: string; from?: { id: number; username?: string } } };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const msg = body.message;
  if (!msg?.text || !msg?.chat?.id) {
    return NextResponse.json({ ok: true }); // Ignore non-text messages
  }

  const chatId = msg.chat.id;
  const urls = extractUrls(msg.text);

  if (urls.length === 0) {
    await sendTelegramMessage(chatId, '👋 Send me a URL and I\'ll turn it into a ManaposeGP blog post!\n\nExample: <code>https://www.jeanhailes.org.au/health-a-z/menopause/understanding-menopause</code>');
    return NextResponse.json({ ok: true });
  }

  const url = urls[0];

  try {
    // Step 1: Acknowledge
    await sendTelegramMessage(chatId, `🔍 Scraping: <a href="${url}">${url.slice(0, 60)}…</a>`);

    // Step 2: Scrape
    const scraped = await scrapeUrl(url);
    await sendTelegramMessage(chatId, `📄 Found: <b>${scraped.title.slice(0, 100)}</b>\n✍️ Enhancing with AI…`);

    // Step 3: Enhance with OpenAI
    const enhanced = await enhanceContent(scraped.title, scraped.content, scraped.sourceName);

    // Step 4: Create blog post
    const post = await createBlogPost({ scraped, enhanced, sourceUrl: url });

    // Index into AI knowledge base
    indexBlogPost(post.id, post.title, post.content).then(
      (count) => console.log(`[telegram] Indexed ${count} chunks for "${post.title}"`),
      () => {},
    );

    // Step 5: Reply with success
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://manaposegp.vercel.app';
    const postUrl = `${appUrl}/blog/${post.slug}`;

    await sendTelegramMessage(
      chatId,
      `✅ <b>Blog post created!</b>\n\n<b>${post.title}</b>\n\n📎 <a href="${postUrl}">View on ManaposeGP</a>\n🏷️ Tags: ${post.tags.join(', ') || 'none'}`,
    );
  } catch (err) {
    console.error('[telegram/webhook] Error:', err instanceof Error ? err.message : err);
    await sendTelegramMessage(
      chatId,
      `❌ Failed to process: ${err instanceof Error ? err.message : 'Unknown error'}\n\nTry a different URL or check that the page is accessible.`,
    );
  }

  return NextResponse.json({ ok: true });
}

/**
 * GET — used by Telegram to verify the webhook URL.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, service: 'ManaposeGP Telegram Blog Bot' });
}
