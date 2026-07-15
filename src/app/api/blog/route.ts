/**
 * GET /api/blog — list published blog posts
 */
import { NextResponse } from 'next/server';
import { listBlogPosts } from '@/domain/blog/blog-service';

export async function GET(): Promise<NextResponse> {
  try {
    const posts = await listBlogPosts();
    return NextResponse.json({ success: true, posts });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to list posts' },
      { status: 500 },
    );
  }
}
