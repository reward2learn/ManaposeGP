/**
 * AI Knowledge Indexer — indexes blog posts and conversations into pgvector.
 */
import { createClient } from '@/lib/db';
import { chunkText, embedBatch, toVectorLiteral } from '@/lib/health/embedding-service';

/**
 * Index a blog post by chunking its content and storing embeddings.
 * Called after a blog post is created or updated.
 */
export async function indexBlogPost(blogId: string, title: string, content: string): Promise<number> {
  const db = createClient();

  // Remove old embeddings for this post
  await db.$executeRawUnsafe(`DELETE FROM blog_embeddings WHERE blog_id = $1`, blogId);

  // Combine title + content for context-aware chunks
  const fullText = `${title}\n\n${content}`;
  const chunks = chunkText(fullText, 1000);
  if (!chunks.length) return 0;

  // Generate embeddings in batch
  const results = await embedBatch(chunks);

  // Insert all chunks
  for (let i = 0; i < chunks.length; i++) {
    const vec = toVectorLiteral(results[i].embedding);
    await db.$executeRawUnsafe(
      `INSERT INTO blog_embeddings (blog_id, chunk_index, chunk_text, embedding, tokens)
       VALUES ($1, $2, $3, $4::vector, $5)`,
      blogId, i, chunks[i], vec, results[i].tokens,
    );
  }

  return chunks.length;
}

/**
 * Index conversation messages.
 * Called when a conversation is saved.
 */
export async function indexConversation(
  conversationId: number,
  messages: Array<{ role: string; content: string }>,
): Promise<number> {
  const db = createClient();

  // Remove old embeddings for this conversation
  await db.$executeRawUnsafe(`DELETE FROM conversation_embeddings WHERE conversation_id = $1`, conversationId);

  // Only index substantial messages (skip system messages, very short ones)
  const texts: string[] = [];
  const roles: string[] = [];
  for (const msg of messages) {
    if (msg.content.trim().length < 30) continue;
    texts.push(msg.content);
    roles.push(msg.role === 'assistant' ? 'assistant' : 'user');
  }

  if (!texts.length) return 0;

  const results = await embedBatch(texts);

  for (let i = 0; i < texts.length; i++) {
    const vec = toVectorLiteral(results[i].embedding);
    await db.$executeRawUnsafe(
      `INSERT INTO conversation_embeddings (conversation_id, message_role, chunk_text, embedding, tokens)
       VALUES ($1, $2, $3, $4::vector, $5)`,
      conversationId, roles[i], texts[i].slice(0, 1500), vec, results[i].tokens,
    );
  }

  return texts.length;
}

/**
 * Delete all embeddings for a conversation.
 */
export async function deleteConversationEmbeddings(conversationId: number): Promise<void> {
  const db = createClient();
  await db.$executeRawUnsafe(`DELETE FROM conversation_embeddings WHERE conversation_id = $1`, conversationId);
}
