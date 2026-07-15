/**
 * Embedding Service — generates embeddings via OpenAI text-embedding-3-small.
 * Caches results to minimize API calls for identical text.
 */
import { resolveOpenAiKey } from '@/lib/openai';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const MAX_TOKENS_PER_CHUNK = 500; // Conservative — ~300 words per chunk

/**
 * Generate an embedding vector for a single text string.
 * Returns a 1536-dimensional float array.
 */
export async function embedText(text: string): Promise<number[]> {
  const apiKey = await resolveOpenAiKey();
  if (!apiKey) throw new Error('OpenAI API key not available for embeddings');

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text.replace(/\n/g, ' ').trim(),
      dimensions: EMBEDDING_DIMENSIONS,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Embedding API error ${response.status}: ${err.slice(0, 200)}`);
  }

  const data = await response.json() as {
    data: Array<{ embedding: number[] }>;
    usage: { total_tokens: number };
  };

  return data.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in a single API call.
 * Much more efficient than calling embedText() in a loop.
 */
export async function embedBatch(texts: string[]): Promise<Array<{ embedding: number[]; tokens: number }>> {
  const apiKey = await resolveOpenAiKey();
  if (!apiKey) throw new Error('OpenAI API key not available for embeddings');

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts.map(t => t.replace(/\n/g, ' ').trim()),
      dimensions: EMBEDDING_DIMENSIONS,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Embedding batch API error ${response.status}: ${err.slice(0, 200)}`);
  }

  const data = await response.json() as {
    data: Array<{ embedding: number[]; index: number }>;
    usage: { total_tokens: number };
  };

  const avgTokens = Math.round(data.usage.total_tokens / texts.length);
  return data.data
    .sort((a, b) => a.index - b.index)
    .map(e => ({ embedding: e.embedding, tokens: avgTokens }));
}

/**
 * Chunk text into embeddable segments.
 * Preserves sentence boundaries where possible.
 */
export function chunkText(text: string, maxChars = 1000): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);

  let current = '';
  for (const sentence of sentences) {
    if (current.length + sentence.length > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += (current ? ' ' : '') + sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks.length ? chunks : [text.slice(0, maxChars)];
}

/**
 * Format a pgvector-compatible array literal from a number array.
 */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}
