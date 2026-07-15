/**
 * RAG (Retrieval-Augmented Generation) Service.
 * Searches the vector knowledge base and returns relevant context snippets.
 */
import { createClient } from '@/lib/db';
import { embedText, toVectorLiteral } from '@/lib/health/embedding-service';

export interface KnowledgeSnippet {
  text: string;
  source: string;   // e.g. "Blog: Understanding Menopause" or "Conversation #42"
  similarity: number;
  sourceType: 'blog' | 'conversation';
}

/**
 * Search the knowledge base for snippets relevant to a query.
 * Searches both blog_embeddings and conversation_embeddings via cosine similarity.
 */
export async function searchKnowledgeBase(query: string, topK = 5): Promise<KnowledgeSnippet[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  // Skip vector search if no embedding model available — return empty
  if (!apiKey && !process.env.OPENAI_API_KEY) {
    console.warn('[rag] No OpenAI key — skipping vector search');
    return [];
  }

  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedText(query);
  } catch (err) {
    console.error('[rag] Embedding failed:', err instanceof Error ? err.message : err);
    return [];
  }

  const vec = toVectorLiteral(queryEmbedding);
  const db = createClient();

  // Search both tables in parallel
  type BlogRow = { chunk_text: string; blog_id: string; title: string; similarity: number };
  type ConvRow = { chunk_text: string; conversation_id: number; message_role: string; similarity: number };

  const [blogResults, convResults] = await Promise.all([
    db.$queryRawUnsafe<BlogRow[]>(
      `SELECT be.chunk_text, be.blog_id, bp.title, 1 - (be.embedding <=> $1::vector) as similarity
       FROM blog_embeddings be
       JOIN blog_posts bp ON bp.id = be.blog_id
       WHERE be.embedding IS NOT NULL AND bp.published = true
       ORDER BY be.embedding <=> $1::vector
       LIMIT $2`,
      vec, topK,
    ).catch((): BlogRow[] => []),

    db.$queryRawUnsafe<ConvRow[]>(
      `SELECT chunk_text, conversation_id, message_role, 1 - (embedding <=> $1::vector) as similarity
       FROM conversation_embeddings
       WHERE embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      vec, topK,
    ).catch((): ConvRow[] => []),
  ]);

  // Merge and sort by similarity
  const results: KnowledgeSnippet[] = [
    ...blogResults.map((r: BlogRow) => ({
      text: r.chunk_text,
      source: `Blog: ${r.title || 'Article'}`,
      similarity: Number(r.similarity),
      sourceType: 'blog' as const,
    })),
    ...convResults.map((r: ConvRow) => ({
      text: r.chunk_text,
      source: `Conversation #${r.conversation_id} (${r.message_role})`,
      similarity: Number(r.similarity),
      sourceType: 'conversation' as const,
    })),
  ];

  // Filter: only return results with meaningful similarity (>0.7)
  return results
    .filter(r => r.similarity > 0.7)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

/**
 * Format knowledge snippets into a context block for the AI system prompt.
 */
export function formatKnowledgeContext(snippets: KnowledgeSnippet[]): string {
  if (!snippets.length) return '';

  const lines = ['', '=== RELEVANT KNOWLEDGE FROM ManaposeGP ==='];
  for (const s of snippets) {
    lines.push(`\n[Source: ${s.source}]`);
    lines.push(s.text.slice(0, 600));
  }
  lines.push('\n=== END KNOWLEDGE ===');
  return lines.join('\n');
}
