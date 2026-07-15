/**
 * Content Enhancer — optionally formats scraped content into a blog post
 * using OpenAI GPT-4o. Falls back to raw scraped content if OpenAI is unavailable.
 */
import { resolveOpenAiKey } from '@/lib/openai';

export interface EnhancedContent {
  title: string;
  content: string;   // Markdown-formatted blog post
  excerpt: string;
  tags: string[];
}

/**
 * Extract markdown image references from raw content so we can re-inject
 * them if the AI strips them out.
 */
function extractImages(markdown: string): string[] {
  const images: string[] = [];
  const regex = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/g;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    images.push(match[1]);
  }
  return images;
}

/**
 * Re-inject images into AI-enhanced content at paragraph breaks.
 */
function injectImages(enhancedContent: string, images: string[]): string {
  if (!images.length) return enhancedContent;

  const paragraphs = enhancedContent.split('\n\n');
  const result: string[] = [];

  // Calculate spacing: insert images evenly throughout the content
  const step = Math.max(1, Math.floor(paragraphs.length / (images.length + 1)));

  let imgIdx = 0;
  for (let i = 0; i < paragraphs.length; i++) {
    result.push(paragraphs[i]);
    // Insert image after every `step` paragraphs, avoiding insertion right after headings
    if (imgIdx < images.length && (i + 1) % step === 0 && !paragraphs[i].startsWith('#')) {
      result.push(`\n![Article image](${images[imgIdx]})\n`);
      imgIdx++;
    }
  }

  // Append any remaining images at the end
  while (imgIdx < images.length) {
    result.push(`\n![Article image](${images[imgIdx]})\n`);
    imgIdx++;
  }

  return result.join('\n\n');
}

/**
 * Use GPT-4o to convert scraped content into a well-structured healthcare blog post.
 * If OpenAI is unavailable, returns the raw scraped content as-is.
 */
export async function enhanceContent(
  rawTitle: string,
  rawContent: string,
  sourceName?: string,
): Promise<EnhancedContent> {
  const apiKey = await resolveOpenAiKey();

  if (!apiKey) {
    // No OpenAI key — use raw content as-is
    console.warn('[blog/enhancer] No OpenAI key — using raw content');
    return {
      title: rawTitle,
      content: `> Originally published on ${sourceName || 'external source'}\n\n${rawContent}`,
      excerpt: rawContent.slice(0, 200) + '…',
      tags: [],
    };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a medical blog editor for ManaposeGP, an Australian healthcare platform. 
Your task: convert the provided article content into a well-structured blog post.

Rules:
- Write in Australian English
- Use markdown formatting (headings, lists, emphasis)
- **PRESERVE any markdown images you see** — they look like ![alt](url). Keep them in your output at natural positions between paragraphs.
- Add a brief introduction paragraph explaining why this topic matters for patients
- Preserve all factual medical information accurately — do NOT fabricate data
- Add 2-3 subheadings to break up the content
- End with a "Key Takeaways" section (3-4 bullet points)
- Include a disclaimer: "This article is for educational purposes only. Always consult your GP for personalised medical advice."
- Generate 3-5 relevant tags for the article
- Keep the original title but you may improve it slightly for clarity
- Write in a warm, accessible tone suitable for patients (not academic)
- Target length: 400-800 words

Return your response as JSON:
{
  "title": "Improved title",
  "content": "Full markdown blog post...",
  "excerpt": "2-3 sentence summary for preview cards",
  "tags": ["tag1", "tag2", "tag3"]
}`,
          },
          {
            role: 'user',
            content: `Source: ${sourceName || 'Unknown'}\nTitle: ${rawTitle}\n\nContent:\n${rawContent.slice(0, 6000)}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };
    const parsed = JSON.parse(data.choices[0].message.content) as EnhancedContent;

    // If OpenAI dropped images, re-inject them from the original content
    const originalImages = extractImages(rawContent);
    if (originalImages.length > 0 && !/!\[.*?\]\(https?:\/\//.test(parsed.content)) {
      parsed.content = injectImages(parsed.content, originalImages);
    }

    return parsed;
  } catch (err) {
    console.error('[blog/enhancer] OpenAI enhancement failed, using raw content:', err instanceof Error ? err.message : err);
    return {
      title: rawTitle,
      content: `> Originally published on ${sourceName || 'external source'}\n\n${rawContent}`,
      excerpt: rawContent.slice(0, 200) + '…',
      tags: [],
    };
  }
}
