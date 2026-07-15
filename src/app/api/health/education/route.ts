import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db';
import type { Prisma } from '@/generated/prisma';

// ── Zod schemas ─────────────────────────────────────────────────────────────

const searchParamsSchema = z.object({
  category: z.string().optional(),
  lang: z.string().optional().default('en'),
  search: z.string().optional(),
  limit: z
    .string()
    .optional()
    .default('20')
    .transform((val) => {
      const n = Number(val);
      return Number.isFinite(n) && n > 0 && n <= 100 ? n : 20;
    }),
});

type ValidatedParams = z.infer<typeof searchParamsSchema>;

// ── Allowed categories ──────────────────────────────────────────────────────

const ALLOWED_CATEGORIES = [
  'menopause',
  'mental_health',
  'bone_health',
  'cardiovascular',
  'sexual_health',
  'nutrition',
  'exercise',
  'sleep',
] as const;

function isAllowedCategory(value: string): value is (typeof ALLOWED_CATEGORIES)[number] {
  return (ALLOWED_CATEGORIES as readonly string[]).includes(value);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function jsonError(
  error: string,
  status = 400,
): NextResponse<{ success: false; error: string }> {
  return NextResponse.json({ success: false, error }, { status });
}

/**
 * Build Prisma where clause from validated query params.
 */
function buildWhereClause(params: ValidatedParams): Prisma.HealthEducationWhereInput {
  const where: Prisma.HealthEducationWhereInput = {
    language: params.lang,
  };

  if (params.category && isAllowedCategory(params.category)) {
    where.category = params.category;
  }

  if (params.search && params.search.trim().length > 0) {
    const term = params.search.trim();
    where.OR = [
      { title: { contains: term, mode: 'insensitive' } },
      { content: { contains: term, mode: 'insensitive' } },
      { summary: { contains: term, mode: 'insensitive' } },
    ];
  }

  return where;
}

// ── GET: List health education articles (public) ────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const db = createClient({ tier: 'public' });

  try {
    const url = new URL(request.url);
    const rawParams: Record<string, string | undefined> = {};
    const category = url.searchParams.get('category');
    const lang = url.searchParams.get('lang');
    const search = url.searchParams.get('search');
    const limit = url.searchParams.get('limit');
    if (category) rawParams.category = category;
    if (lang) rawParams.lang = lang;
    if (search) rawParams.search = search;
    if (limit) rawParams.limit = limit;

    const parsed = searchParamsSchema.safeParse(rawParams);
    if (!parsed.success) {
      return jsonError(
        `Invalid parameters: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
        400,
      );
    }

    const params = parsed.data;
    const where = buildWhereClause(params);

    const [articles, total] = await Promise.all([
      db.healthEducation.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        take: params.limit,
      }),
      db.healthEducation.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      articles,
      total,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch education articles';
    console.error('[health/education]', message, err);
    return jsonError(message, 500);
  }
}
