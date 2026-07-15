import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { requireWriteAuth, requireGoogle } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import { getOrCreateProfile } from '@/domain/health/health-profile-service';
import {
  grantConsent,
  acceptConsent,
  revokeConsent,
  getActiveConsents,
} from '@/domain/health/consent-service';

// ── Zod schemas ─────────────────────────────────────────────────────────────

const grantSchema = z.object({
  gpId: z.string().min(1, 'gpId is required'),
  consentType: z.enum([
    'full_access',
    'summary_only',
    'symptom_data',
    'metrics_data',
    'medication_data',
  ], {
    errorMap: () => ({
      message:
        'consentType must be one of: full_access, summary_only, symptom_data, metrics_data, medication_data',
    }),
  }),
  expiresAt: z.string().optional(),
});

const patchSchema = z.object({
  consentId: z.string().min(1, 'consentId is required'),
  action: z.enum(['accept', 'revoke'], {
    errorMap: () => ({ message: 'action must be either "accept" or "revoke"' }),
  }),
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function jsonError(
  error: string,
  status = 400,
): NextResponse<{ success: false; error: string }> {
  return NextResponse.json({ success: false, error }, { status });
}

// ── POST: Grant consent (patient grants access to a GP) ─────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requireGoogle(request);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = grantSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      `Validation failed: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
    );
  }

  const userId = guard.session.sub;
  const db = createClient({
    tier: guard.session.tier,
    sub: userId,
  });

  try {
    const profile = await getOrCreateProfile(db, userId);
    const consent = await grantConsent(
      db,
      profile.id,
      parsed.data.gpId,
      parsed.data.consentType,
      userId,
      parsed.data.expiresAt,
    );

    return NextResponse.json({ success: true, consent }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to grant consent';
    return jsonError(message, 500);
  }
}

// ── GET: List my consents ───────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requireGoogle(request);
  if (!guard.ok) return guard.response;

  const userId = guard.session.sub;
  const db = createClient({
    tier: guard.session.tier,
    sub: userId,
  });

  try {
    const profile = await getOrCreateProfile(db, userId);
    const consents = await getActiveConsents(db, profile.id);

    return NextResponse.json({ success: true, consents });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to retrieve consents';
    return jsonError(message, 500);
  }
}

// ── PATCH: Accept or revoke a consent ──────────────────────────────────────

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      `Validation failed: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
    );
  }

  const db = createClient({
    tier: guard.session.tier,
    sub: guard.session.sub,
  });

  try {
    const { consentId, action } = parsed.data;
    const actorId = guard.session.sub;

    const consent =
      action === 'accept'
        ? await acceptConsent(db, consentId, actorId)
        : await revokeConsent(db, consentId, 'GP', actorId);

    return NextResponse.json({ success: true, consent });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to update consent';
    return jsonError(message, 500);
  }
}
