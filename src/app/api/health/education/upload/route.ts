import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { requirePin } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';

const articleSchema = z.object({
  title: z.string().min(1),
  category: z.string().min(1),
  content: z.string().min(1),
  summary: z.string().optional(),
  source: z.string().optional(),
  url: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

function jsonError(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

export async function POST(request: NextRequest) {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });

  try {
    const body = await request.json();
    const parsed = articleSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues.map(i => i.message).join('; '));
    }

    const { title, category, content, summary, source, url, tags } = parsed.data;

    // Insert into health_education
    await db.$queryRawUnsafe(
      `INSERT INTO health_education (id, title, category, content, summary, source, language, reading_level, published_at, reviewed_at, tags, url)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, 'en', 'standard', NOW(), NOW(), $6, $7)`,
      title, category, content, summary ?? content.slice(0, 200), source ?? 'admin', tags ?? [], url ?? null,
    );

    // Also create knowledge snippet for chatbot reference
    const snippetKey = `admin_${title.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 60)}`;
    await db.$queryRawUnsafe(
      `INSERT INTO knowledge_snippets (id, key, category, content)
       VALUES (gen_random_uuid()::text, $1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET content = EXCLUDED.content, category = EXCLUDED.category`,
      snippetKey, `health_${category}`, `${title}\n\n${summary ?? ''}\n\n${content}`,
    );

    return NextResponse.json({ success: true, message: 'Article added and indexed for chatbot' }, { status: 201 });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed to add article', 500);
  }
}
