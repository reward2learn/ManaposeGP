import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { requireWriteAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import { searchGuidelines } from '@/domain/health/clinical-guideline-service';

// ── Zod schemas ─────────────────────────────────────────────────────────────

const searchParamsSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  sources: z
    .string()
    .optional()
    .transform((val) =>
      val
        ? val
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean)
        : undefined,
    ),
  topK: z
    .string()
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      const n = Number(val);
      return Number.isFinite(n) && n > 0 && n <= 20 ? n : undefined;
    }),
  category: z.string().optional(),
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function jsonError(
  error: string,
  status = 400,
): NextResponse<{ success: false; error: string }> {
  return NextResponse.json({ success: false, error }, { status });
}

// ── GET: Search clinical guidelines ─────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const db = createClient({
    tier: guard.session.tier,
    sub: guard.session.sub,
  });

  try {
    const url = new URL(request.url);
    const rawQuery = {
      query: url.searchParams.get('query') ?? '',
      sources: url.searchParams.get('sources') ?? undefined,
      topK: url.searchParams.get('topK') ?? undefined,
      category: url.searchParams.get('category') ?? undefined,
    };

    const parsed = searchParamsSchema.safeParse(rawQuery);
    if (!parsed.success) {
      return jsonError(
        `Invalid search parameters: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
        400,
      );
    }

    if (!parsed.data.query) {
      return jsonError('Search query is required', 400);
    }

    const { results, query, totalFound } = await searchGuidelines(db, parsed.data.query, {
      topK: parsed.data.topK,
      sources: parsed.data.sources,
      category: parsed.data.category,
    });

    return NextResponse.json({
      success: true,
      results,
      query,
      totalFound,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to search clinical guidelines';
    return jsonError(message, 500);
  }
}
