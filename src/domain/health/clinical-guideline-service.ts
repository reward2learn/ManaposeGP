import type { DbClient } from '@/lib/db';
import type { GuidelineSource } from '@/generated/prisma';

// ── Public interfaces ─────────────────────────────────────────────────────────

export interface GuidelineResult {
  id: string;
  title: string;
  source: string;
  category: string;
  content: string;       // truncated for search, full for getById
  summary?: string;
  url?: string;
  keywords: string[];
  lastUpdated?: string;
  relevanceScore: number;
  isFullContent: boolean;
}

export interface GuidelineSearchResponse {
  results: GuidelineResult[];
  query: string;
  totalFound: number;
}

export interface SearchOptions {
  topK?: number;
  sources?: string[];
  category?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_TOP_K = 5;
const CONTENT_TRUNCATE_LENGTH = 300;

// ── Scoring helpers ───────────────────────────────────────────────────────────

/**
 * Scores a document against search terms.
 * Title matches = 10 pts per term, keyword matches = 5 pts, content matches = 1 pt.
 */
function computeRelevanceScore(
  title: string,
  keywords: string[],
  content: string,
  queryTerms: string[],
): number {
  const lowerTitle = title.toLowerCase();
  const lowerContent = content.toLowerCase();
  const lowerKeywords = keywords.map((k) => k.toLowerCase());

  let score = 0;

  for (const term of queryTerms) {
    const cleanTerm = term.replace(/[^a-z0-9]/gi, '');
    if (!cleanTerm || cleanTerm.length < 2) continue;

    if (lowerTitle.includes(cleanTerm)) {
      score += 10;
    }
    if (lowerKeywords.some((k) => k.includes(cleanTerm))) {
      score += 5;
    }
    if (lowerContent.includes(cleanTerm)) {
      score += 1;
    }
  }

  return score;
}

/**
 * Splits a user query into lowercase search terms, removing short/stop words.
 */
function parseQueryTerms(query: string): string[] {
  const stopWords = new Set([
    'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'for', 'with',
    'to', 'from', 'in', 'of', 'by', 'be', 'that', 'this', 'it', 'as',
  ]);

  return query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !stopWords.has(t));
}

/**
 * Truncates content to approximately `length` characters at a word boundary,
 * appending "..." if truncated.
 */
function truncateContent(content: string, maxLength: number = CONTENT_TRUNCATE_LENGTH): string {
  if (content.length <= maxLength) return content;

  const cut = content.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  const truncated = lastSpace > maxLength * 0.7 ? cut.slice(0, lastSpace) : cut;
  return `${truncated}...`;
}

// ── Mapping helpers ───────────────────────────────────────────────────────────

function mapGuideline(
  row: {
    id: string;
    title: string;
    source: string;
    category: string;
    content: string;
    summary: string | null;
    url: string | null;
    keywords: string[];
    lastUpdated: Date;
  },
  relevanceScore: number,
  truncate: boolean,
): GuidelineResult {
  return {
    id: row.id,
    title: row.title,
    source: row.source,
    category: row.category,
    content: truncate ? truncateContent(row.content) : row.content,
    summary: row.summary ?? undefined,
    url: row.url ?? undefined,
    keywords: row.keywords,
    lastUpdated: row.lastUpdated.toISOString(),
    relevanceScore,
    isFullContent: !truncate,
  };
}

function mapReference(
  row: {
    id: string;
    topic: string;
    content: string;
    source: string;
    url: string | null;
    keywords: string[];
  },
  relevanceScore: number,
  truncate: boolean,
): GuidelineResult {
  return {
    id: row.id,
    title: row.topic,
    source: row.source,
    category: 'reference',
    content: truncate ? truncateContent(row.content) : row.content,
    url: row.url ?? undefined,
    keywords: row.keywords,
    relevanceScore,
    isFullContent: !truncate,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Searches both `clinical_guidelines` and `medical_references` using
 * case-insensitive text matching on title, content, and keywords.
 * Results are ranked by a simple relevance score and truncated for display.
 */
export async function searchGuidelines(
  db: DbClient,
  query: string,
  options?: SearchOptions,
): Promise<GuidelineSearchResponse> {
  const topK = options?.topK ?? DEFAULT_TOP_K;
  const sources = options?.sources;
  const category = options?.category;
  const queryTerms = parseQueryTerms(query);

  if (queryTerms.length === 0) {
    return { results: [], query, totalFound: 0 };
  }

  // ── Fetch from clinical_guidelines ──────────────────────────────────────────

  const guidelineWhere: Record<string, unknown> = {};
  if (sources && sources.length > 0) {
    guidelineWhere.source = { in: sources as GuidelineSource[] };
  }
  if (category) {
    guidelineWhere.category = category;
  }

  // We fetch broader than topK initially for accurate ranking via Prisma `contains`
  // Build conditions per-term using Prisma `contains` mode (maps to ILIKE)
  const guidelineTextFilters = queryTerms.map((term) => ({
    OR: [
      { title: { contains: term, mode: 'insensitive' as const } },
      { content: { contains: term, mode: 'insensitive' as const } },
      { keywords: { hasSome: [term] } },
    ],
  }));

  const guidelines = await db.clinicalGuideline.findMany({
    where: {
      ...guidelineWhere,
      AND: guidelineTextFilters.length > 0 ? guidelineTextFilters : undefined,
    },
    select: {
      id: true,
      title: true,
      source: true,
      category: true,
      content: true,
      summary: true,
      url: true,
      keywords: true,
      lastUpdated: true,
    },
    take: topK * 3, // fetch more for client-side ranking
  });

  // ── Fetch from medical_references ───────────────────────────────────────────

  const referenceWhere: Record<string, unknown> = {};
  if (sources && sources.length > 0) {
    referenceWhere.source = { in: sources };
  }

  const referenceTextFilters = queryTerms.map((term) => ({
    OR: [
      { topic: { contains: term, mode: 'insensitive' as const } },
      { content: { contains: term, mode: 'insensitive' as const } },
      { keywords: { hasSome: [term] } },
    ],
  }));

  const references = await db.medicalReference.findMany({
    where: {
      ...referenceWhere,
      AND: referenceTextFilters.length > 0 ? referenceTextFilters : undefined,
    },
    select: {
      id: true,
      topic: true,
      content: true,
      source: true,
      url: true,
      keywords: true,
    },
    take: topK * 3,
  });

  // ── Rank and merge ──────────────────────────────────────────────────────────

  const scored: GuidelineResult[] = [
    ...guidelines.map((g) =>
      mapGuideline(g, computeRelevanceScore(g.title, g.keywords, g.content, queryTerms), true),
    ),
    ...references.map((r) =>
      mapReference(r, computeRelevanceScore(r.topic, r.keywords, r.content, queryTerms), true),
    ),
  ];

  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

  const results = scored.slice(0, topK);

  return {
    results,
    query,
    totalFound: scored.length,
  };
}

/**
 * Returns full guideline content by ID from `clinical_guidelines`.
 * Returns `null` if not found.
 */
export async function getGuidelineById(
  db: DbClient,
  id: string,
): Promise<GuidelineResult | null> {
  const row = await db.clinicalGuideline.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      source: true,
      category: true,
      content: true,
      summary: true,
      url: true,
      keywords: true,
      lastUpdated: true,
    },
  });

  if (!row) return null;

  return mapGuideline(row, 100, false);
}

/**
 * Searches clinical guidelines by PostgreSQL array overlap on keywords.
 * Matches any guideline where `keywords && ARRAY[...]` (intersection non-empty).
 */
export async function searchByKeywords(
  db: DbClient,
  keywords: string[],
  options?: { topK?: number },
): Promise<GuidelineResult[]> {
  const topK = options?.topK ?? DEFAULT_TOP_K;

  if (keywords.length === 0) return [];

  const rows = await db.clinicalGuideline.findMany({
    where: {
      keywords: { hasSome: keywords },
    },
    select: {
      id: true,
      title: true,
      source: true,
      category: true,
      content: true,
      summary: true,
      url: true,
      keywords: true,
      lastUpdated: true,
    },
    take: topK,
  });

  // Score based on keyword overlap count
  const scored = rows.map((row) => {
    const overlap = row.keywords.filter((k) =>
      keywords.some((q) => q.toLowerCase() === k.toLowerCase()),
    ).length;
    return mapGuideline(row, overlap * 10, true);
  });

  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return scored;
}
