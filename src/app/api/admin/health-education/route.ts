/**
 * GET /api/admin/health-education — list all articles for admin management.
 * PATCH /api/admin/health-education — update an article (any field).
 * DELETE /api/admin/health-education — delete an article + its chatbot snippet.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePin } from '@/lib/auth/guards';
import {
  listAllHealthEducation,
  getHealthEducationById,
  updateHealthEducation,
  deleteHealthEducation,
  type HealthEducationUpdate,
} from '@/domain/admin/health-education-service';

export const dynamic = 'force-dynamic';

function jsonError(e: string, s = 400) {
  return NextResponse.json({ success: false, error: e }, { status: s });
}

// ── GET — list all or single ─────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (id) {
      const article = await getHealthEducationById(id);
      if (!article) return jsonError('Article not found', 404);
      return NextResponse.json({ success: true, article });
    }

    const articles = await listAllHealthEducation();
    return NextResponse.json({ success: true, articles });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed to list articles', 500);
  }
}

// ── PATCH — update ───────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = body.id as string;
    if (!id) return jsonError('id is required');

    const update: HealthEducationUpdate = {};

    if (body.title !== undefined) update.title = body.title as string;
    if (body.category !== undefined) update.category = body.category as string;
    if (body.content !== undefined) update.content = body.content as string;
    if (body.summary !== undefined) update.summary = body.summary as string;
    if (body.source !== undefined) update.source = body.source as string;
    if (body.language !== undefined) update.language = body.language as string;
    if (body.readingLevel !== undefined) update.readingLevel = (body.readingLevel as string) || null;
    if (body.tags !== undefined) update.tags = body.tags as string[];
    if (body.url !== undefined) update.url = (body.url as string) || null;

    const article = await updateHealthEducation(id, update);
    if (!article) return jsonError('Article not found', 404);

    return NextResponse.json({ success: true, article });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed to update article', 500);
  }
}

// ── DELETE — remove ──────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return jsonError('id query parameter is required');

    const deleted = await deleteHealthEducation(id);
    if (!deleted) return jsonError('Article not found', 404);

    return NextResponse.json({ success: true, message: 'Article deleted' });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed to delete article', 500);
  }
}
