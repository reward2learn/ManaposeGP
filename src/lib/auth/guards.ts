import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { createClient } from '@/lib/db';
import type { SessionClaims } from '@/lib/auth/jwt';

export type GuardFailure = { ok: false; response: NextResponse };
export type GuardSuccess = { ok: true; session: SessionClaims };
export type GuardResult = GuardSuccess | GuardFailure;

function unauthorized(message = 'Unauthorized'): GuardFailure {
  return {
    ok: false,
    response: NextResponse.json({ success: false, error: message }, { status: 401 }),
  };
}

export async function requireSession(request: Request): Promise<GuardResult> {
  const session = await getSessionFromRequest(request);
  if (!session) return unauthorized('Sign in required');
  return { ok: true, session };
}

export async function requireWriteAuth(request: Request): Promise<GuardResult> {
  const session = await getSessionFromRequest(request);
  if (!session) return unauthorized();
  if (session.tier !== 'pin' && session.tier !== 'google') {
    return unauthorized();
  }
  return { ok: true, session };
}

export async function requirePin(request: Request): Promise<GuardResult> {
  const session = await getSessionFromRequest(request);
  if (!session) return unauthorized('Authentication required');

  // PIN tier always has access
  if (session.tier === 'pin') return { ok: true, session };

  // Google tier: check if user is a verified GP
  if (session.tier === 'google' && session.sub) {
    try {
      const db = createClient({ tier: 'google', sub: session.sub });
      const result = await db.$queryRawUnsafe<Array<{ verified: boolean }>>(
        `SELECT verified FROM gp_profiles WHERE user_id = $1 AND verified = true`,
        session.sub,
      );
      if (result.length > 0) return { ok: true, session };
    } catch {
      // DB check failed — fall through to unauthorized
    }
  }

  return unauthorized('GP access required. Please register as a GP or sign in with GP credentials.');
}

export async function requireGoogle(request: Request): Promise<GuardResult> {
  const session = await getSessionFromRequest(request);
  if (!session || session.tier !== 'google') {
    return unauthorized('Google sign-in required');
  }
  return { ok: true, session };
}
