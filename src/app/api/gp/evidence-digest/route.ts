import { NextRequest, NextResponse } from 'next/server';
import { requirePin } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';

// ── GET: Fetch latest evidence digest entries ─────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  const db = createClient({
    tier: guard.session.tier,
    sub: guard.session.sub,
  });

  try {
    // Fetch the most recent digest date first
    const latestEntry = await db.medicalReference.findFirst({
      where: { topic: 'weekly_digest' },
      orderBy: { id: 'desc' },
      select: { subtopic: true, id: true },
    });

    const generatedAt = latestEntry?.subtopic ?? null;

    // Fetch all entries for the most recent digest date (or all if no date found)
    // Ordered by id DESC since no created_at column on MedicalReference
    const references = await db.medicalReference.findMany({
      where: {
        topic: 'weekly_digest',
        ...(generatedAt ? { subtopic: generatedAt } : {}),
      },
      orderBy: { id: 'desc' },
      take: 20,
      select: {
        id: true,
        content: true,
        url: true,
      },
    });

    // Parse JSON content back into digest entries
    const digest = references
      .map((ref) => {
        try {
          return JSON.parse(ref.content) as Record<string, unknown>;
        } catch {
          console.warn(`[evidence-digest] Failed to parse content for ref ${ref.id}`);
          return null;
        }
      })
      .filter((entry): entry is Record<string, unknown> => entry !== null);

    return NextResponse.json({
      success: true,
      digest,
      generatedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch evidence digest';
    console.error('[evidence-digest] GET error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
