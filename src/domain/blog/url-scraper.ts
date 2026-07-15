/**
 * URL Scraper — extracts title, content, images, and metadata from a URL.
 * Uses cheerio for serverless-safe HTML parsing (no headless browser).
 */
import * as cheerio from 'cheerio';

export interface ScrapedImage {
  src: string;       // Absolute URL
  alt?: string;      // Alt text or caption
  width?: number;
  height?: number;
}

export interface ScrapedContent {
  title: string;
  content: string;       // Markdown with embedded images like ![alt](url)
  excerpt: string;       // First ~200 chars (plain text)
  imageUrl?: string;     // Primary og:image for card thumbnail
  images: ScrapedImage[]; // All images found in article body
  sourceName?: string;   // Domain name
}

/**
 * Resolve a potentially relative URL to absolute using the page's base URL.
 */
function resolveUrl(src: string | undefined | null, baseUrl: string): string | undefined {
  if (!src) return undefined;
  // Already absolute
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//')) {
    return src.startsWith('//') ? `https:${src}` : src;
  }
  try {
    return new URL(src, baseUrl).href;
  } catch {
    return undefined;
  }
}

/**
 * Scrape a URL and extract article content with inline images.
 * Images from the article body are embedded as markdown in the content.
 */
export async function scrapeUrl(url: string): Promise<ScrapedContent> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'ManaposeGP-BlogBot/1.0 (healthcare content aggregator)',
      'Accept': 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // ── Title ──────────────────────────────────────────
  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('meta[name="twitter:title"]').attr('content') ||
    $('h1').first().text().trim() ||
    $('title').text().trim() ||
    'Untitled Article';

  // ── Primary image (card thumbnail) ─────────────────
  const imageUrl =
    $('meta[property="og:image"]').attr('content') ||
    $('meta[name="twitter:image"]').attr('content') ||
    $('article img').first().attr('src') ||
    undefined;

  // ── Source name ─────────────────────────────────────
  const sourceName =
    $('meta[property="og:site_name"]').attr('content') ||
    (() => {
      try { return new URL(url).hostname.replace('www.', ''); }
      catch { return undefined; }
    })();

  // ── Content extraction ──────────────────────────────
  // Remove non-content elements
  $('script, style, nav, footer, header, aside, .sidebar, .ad, .advertisement, .cookie-banner, .nav, .menu, .comments, .social-share, iframe, noscript').remove();

  // Try common article selectors
  let contentEl = $('article').first();
  if (!contentEl.length) contentEl = $('[role="main"]').first();
  if (!contentEl.length) contentEl = $('main').first();
  if (!contentEl.length) contentEl = $('.post-content, .article-content, .entry-content, .blog-content, .content-body').first();
  if (!contentEl.length) contentEl = $('body');

  // ── Extract inline images from article body ─────────
  const images: ScrapedImage[] = [];
  const seenSrcs = new Set<string>();

  contentEl.find('img').each((_, el) => {
    const $img = $(el);
    const src = resolveUrl($img.attr('src') || $img.attr('data-src'), url);
    if (!src || seenSrcs.has(src)) return;
    // Skip tiny icons, spacers, tracking pixels
    const width = parseInt($img.attr('width') || '0', 10);
    const height = parseInt($img.attr('height') || '0', 10);
    if ((width > 0 && width < 50) || (height > 0 && height < 50)) return;

    seenSrcs.add(src);
    const alt = $img.attr('alt')?.trim() || undefined;
    images.push({
      src,
      alt,
      width: width || undefined,
      height: height || undefined,
    });
  });

  // ── Extract text with embedded images ───────────────
  const blocks: string[] = [];
  let imageIndex = 0;

  contentEl.find('p, h2, h3, h4, li, figure, img, .wp-block-image, .image-wrapper, .featured-image').each((_, el) => {
    const tagName = (el as any).tagName?.toLowerCase();

    // Handle inline images and figures
    if (tagName === 'img' || tagName === 'figure' || $(el).hasClass('wp-block-image') || $(el).hasClass('image-wrapper')) {
      const $img = tagName === 'img' ? $(el) : $(el).find('img').first();
      const src = resolveUrl($img.attr('src') || $img.attr('data-src'), url);
      if (src && imageIndex < images.length) {
        const img = images[imageIndex];
        const caption = img.alt || $img.attr('alt')?.trim() || $(el).find('figcaption').text().trim() || 'Article image';
        blocks.push(`![${caption}](${img.src})`);
        imageIndex++;
      }
      return;
    }

    // Handle videos
    if (tagName === 'video' || tagName === 'iframe') {
      const videoSrc = $(el).attr('src') || $(el).find('source').first().attr('src');
      if (videoSrc) {
        const resolvedVideo = resolveUrl(videoSrc, url);
        if (resolvedVideo) {
          blocks.push(`\n> 🎥 **Video**: [Watch on source](${resolvedVideo})\n`);
        }
      }
      return;
    }

    const text = $(el).text().trim();
    if (text.length > 15) {
      if (['H2', 'H3', 'H4'].includes((el as any).tagName)) {
        blocks.push(`\n## ${text}\n`);
      } else if ((el as any).tagName === 'LI') {
        blocks.push(`- ${text}`);
      } else {
        blocks.push(text);
      }
    }
  });

  // Insert remaining images that weren't matched to a block
  while (imageIndex < images.length) {
    const img = images[imageIndex];
    blocks.push(`\n![${img.alt || 'Article image'}](${img.src})\n`);
    imageIndex++;
  }

  const content = blocks.join('\n\n') || $('body').text().trim().slice(0, 5000);
  const excerpt = content.replace(/!\[.*?\]\(.*?\)/g, '').replace(/\n/g, ' ').trim().slice(0, 250) + '…';

  return {
    title: title.slice(0, 300),
    content,
    excerpt,
    imageUrl: resolveUrl(imageUrl, url),
    images,
    sourceName,
  };
}
