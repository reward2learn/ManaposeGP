/**
 * GET /api/blog/admin — list all blog posts (including drafts) for admin.
 * PATCH /api/blog/admin — update blog post (publish, edit content, images).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePin } from '@/lib/auth/guards';
import { listAllBlogPosts, updateBlogPost, getBlogPostById } from '@/domain/blog/blog-service';
import { indexBlogPost } from '@/domain/knowledge/ai-indexer';

export const dynamic = 'force-dynamic';

function jsonError(e: string, s = 400) { return NextResponse.json({ success: false, error: e }, { status: s }); }

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (id) {
      const post = await getBlogPostById(id);
      if (!post) return jsonError('Post not found', 404);
      return NextResponse.json({ success: true, post });
    }

    const posts = await listAllBlogPosts();
    return NextResponse.json({ success: true, posts });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed', 500);
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json() as Record<string, unknown>;
    const id = body.id as string;
    if (!id) return jsonError('id is required');

    const update: Parameters<typeof updateBlogPost>[1] = {};
    if (body.title !== undefined) update.title = body.title as string;
    if (body.content !== undefined) update.content = body.content as string;
    if (body.excerpt !== undefined) update.excerpt = body.excerpt as string;
    if (body.imageUrl !== undefined) update.imageUrl = (body.imageUrl as string) || null;
    if (body.sectionImages !== undefined) update.sectionImages = body.sectionImages as Array<{ src: string; alt: string; caption?: string }>;
    if (body.tags !== undefined) update.tags = body.tags as string[];
    if (body.published !== undefined) update.published = Boolean(body.published);

    const post = await updateBlogPost(id, update);
    if (!post) return jsonError('Post not found', 404);

    // Re-index if content changed
    if (body.content !== undefined) {
      indexBlogPost(post.id, post.title, post.content).catch(() => {});
    }

    return NextResponse.json({ success: true, post });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed', 500);
  }
}
