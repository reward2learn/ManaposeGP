/**
 * Instagram Scraper — extracts recent posts from a public Instagram profile.
 * Uses multiple fallback approaches for reliability.
 *
 * DISCLAIMER: Instagram's public APIs can change without notice.
 * This is a best-effort scraper. The admin page provides manual overrides.
 */
import * as cheerio from 'cheerio';

export interface InstagramPost {
  shortcode: string;
  url: string;
  caption: string;
  imageUrl?: string;
  timestamp?: string;
  likes?: number;
}

/**
 * Extract Instagram post shortcodes from profile page HTML.
 * Looks for <script type="application/ld+json"> and <a href="/p/SHORTCODE/">
 */
function extractShortcodesFromHtml(html: string, limit = 10): string[] {
  const $ = cheerio.load(html);
  const shortcodes = new Set<string>();

  // Method 1: Look for JSON-LD structured data
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || '{}');
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item.url && item.url.includes('/p/')) {
          const match = item.url.match(/\/p\/([A-Za-z0-9_-]+)/);
          if (match) shortcodes.add(match[1]);
        }
      }
    } catch { /* ignore parse errors */ }
  });

  // Method 2: Find all /p/SHORTCODE links
  $('a[href*="/p/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/\/p\/([A-Za-z0-9_-]+)/);
    if (match) shortcodes.add(match[1]);
  });

  return Array.from(shortcodes).slice(0, limit);
}

/**
 * Get post details via Instagram's public oEmbed endpoint.
 * Returns title (caption) and thumbnail URL.
 */
async function fetchPostViaOembed(shortcode: string): Promise<{ caption: string; imageUrl?: string } | null> {
  const postUrl = `https://www.instagram.com/p/${shortcode}/`;
  const oembedUrl = `https://api.instagram.com/oembed?url=${encodeURIComponent(postUrl)}`;

  try {
    const resp = await fetch(oembedUrl, {
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;

    const data = await resp.json() as {
      title?: string;
      thumbnail_url?: string;
    };

    return {
      caption: data.title || 'Instagram post',
      imageUrl: data.thumbnail_url,
    };
  } catch {
    return null;
  }
}

/**
 * Try to extract post data directly from the post page HTML.
 * Fallback if oEmbed fails.
 */
async function fetchPostViaHtml(shortcode: string): Promise<{ caption: string; imageUrl?: string } | null> {
  try {
    const resp = await fetch(`https://www.instagram.com/p/${shortcode}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ManaposeGP/1.0; +https://manaposegp.vercel.app)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return null;

    const html = await resp.text();
    const $ = cheerio.load(html);

    // Try to extract from meta tags
    const caption =
      $('meta[property="og:title"]').attr('content')?.trim() ||
      $('meta[name="description"]').attr('content')?.trim() ||
      'Instagram post';

    const imageUrl = $('meta[property="og:image"]').attr('content');

    return {
      caption: caption.length > 500 ? caption.slice(0, 500) + '…' : caption,
      imageUrl,
    };
  } catch {
    return null;
  }
}

/**
 * Scrape recent Instagram posts from a public profile.
 *
 * @param username - Instagram username (without @)
 * @param limit - Max posts to fetch
 * @param since - Only return posts after this date
 */
export async function scrapeInstagramProfile(
  username: string,
  limit = 5,
  _since?: Date,
): Promise<InstagramPost[]> {
  const cleanUsername = username.replace('@', '').trim();
  const profileUrl = `https://www.instagram.com/${cleanUsername}/`;

  // Step 1: Fetch profile page to get post shortcodes
  let html: string;
  try {
    const resp = await fetch(profileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ManaposeGP/1.0; +https://manaposegp.vercel.app)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    });
    html = await resp.text();
  } catch (err) {
    console.error(`[instagram] Failed to fetch profile ${cleanUsername}:`, err instanceof Error ? err.message : err);
    return [];
  }

  const shortcodes = extractShortcodesFromHtml(html, limit);
  if (!shortcodes.length) {
    console.warn(`[instagram] No posts found for ${cleanUsername}`);
    return [];
  }

  console.log(`[instagram] Found ${shortcodes.length} post shortcodes for ${cleanUsername}`);

  // Step 2: Fetch each post's details (oEmbed first, HTML fallback)
  const posts: InstagramPost[] = [];
  for (const shortcode of shortcodes.slice(0, limit)) {
    // Try oEmbed first (faster, cleaner)
    let details = await fetchPostViaOembed(shortcode);

    // Fall back to HTML scraping
    if (!details) {
      details = await fetchPostViaHtml(shortcode);
    }

    if (details) {
      posts.push({
        shortcode,
        url: `https://www.instagram.com/p/${shortcode}/`,
        caption: details.caption,
        imageUrl: details.imageUrl,
      });
    }

    // Rate limit: small delay between posts
    if (shortcodes.indexOf(shortcode) < shortcodes.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return posts;
}

/**
 * Scrape a single Instagram post by its URL.
 * Extracts the shortcode from the URL and fetches details directly.
 */
export async function scrapeInstagramPostUrl(postUrl: string): Promise<InstagramPost | null> {
  const match = postUrl.match(/\/p\/([A-Za-z0-9_-]+)/) || postUrl.match(/\/reel\/([A-Za-z0-9_-]+)/);
  if (!match) return null;

  const shortcode = match[1];
  const url = `https://www.instagram.com/p/${shortcode}/`;

  // Try oEmbed first
  let details = await fetchPostViaOembed(shortcode);

  // Fall back to HTML scraping
  if (!details) {
    details = await fetchPostViaHtml(shortcode);
  }

  if (!details) return null;

  return {
    shortcode,
    url,
    caption: details.caption,
    imageUrl: details.imageUrl,
  };
}
