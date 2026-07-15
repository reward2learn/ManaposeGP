/**
 * Auth API — JWT session cookie (manaposegp.session).
 * Legacy reference: website/api/auth.js (read-only)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleStoreKey } from '@/lib/auth/store-key';
import { handleStoreGoogleOAuth } from '@/lib/auth/store-google-oauth';
import {
  buildGoogleAuthUrl,
  getGoogleOAuthCredentials,
  getGoogleOAuthPublicConfig,
} from '@/lib/auth/google-oauth';
import { signSession } from '@/lib/auth/jwt';
import {
  clearSessionCookie,
  getOrigin,
  getSessionFromRequest,
  setSessionCookie,
} from '@/lib/auth/session';
import { requireGoogle } from '@/lib/auth/guards';
import { getSecretPlaintext } from '@/lib/secrets';
import { createClient } from '@/lib/db';
import { PdfExportService } from '@/domain/pdf/pdf-export-service';
import { legacyError, jsonError } from '@/lib/api/response';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Ensure a platform_users row exists for this user (idempotent upsert).
 * Called on every successful sign-in so the admin users page is never empty.
 */
async function ensurePlatformUser(
  userId: string,
  email: string | undefined,
  name: string | undefined,
  tier: 'pin' | 'google',
): Promise<void> {
  try {
    const db = createClient();
    await db.$executeRawUnsafe(
      `INSERT INTO platform_users (id, email, name, tier, is_gp, role, status, last_login)
       VALUES ($1, $2, $3, $4, false, CASE WHEN $4 = 'pin' THEN 'ADMIN' ELSE 'USER' END, 'ACTIVE', NOW())
       ON CONFLICT (email) DO UPDATE SET name = COALESCE($3, platform_users.name), last_login = NOW(), tier = CASE WHEN platform_users.tier = 'pin' THEN platform_users.tier ELSE $4 END`,
      userId, email || `${userId}@unknown`, name || null, tier,
    );
  } catch (err) {
    console.warn('[auth] platform_users upsert failed (non-fatal):', err instanceof Error ? err.message : err);
  }
}

export const maxDuration = 60;

const verifyPinSchema = z.object({ pin: z.string().min(1) });

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action') ?? '';

  switch (action) {
    case 'google-config':
      return handleGoogleConfig();
    case 'google':
      return handleGoogleRedirect(request, url);
    case 'google-callback':
      return handleGoogleCallback(request, url);
    case 'me':
      return handleMe(request);
    case 'logout':
      return handleLogout(request);
    case 'logout-client':
      return handleLogoutClient();
    case 'pdf':
      return handlePdf(request, url);
    default:
      return jsonError('Unknown action — use google|google-callback|google-config|me|logout|logout-client|pdf|verify-pin|store-key|store-google-oauth', 400);
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action') ?? '';

  if (action === 'store-key') {
    const result = await handleStoreKey(request);
    const status = result.success ? 200 : result.error?.includes('Unauthorized') ? 401 : 400;
    return NextResponse.json(result, { status });
  }

  if (action === 'store-google-oauth') {
    const result = await handleStoreGoogleOAuth(request);
    const status = result.success ? 200 : result.error?.includes('Unauthorized') ? 401 : 400;
    return NextResponse.json(result, { status });
  }

  if (action === 'verify-pin') {
    return handleVerifyPin(request);
  }

  return jsonError('Unknown action', 400);
}

async function handleGoogleConfig(): Promise<NextResponse> {
  const config = await getGoogleOAuthPublicConfig();
  if (!config) {
    return jsonError('Google OAuth not configured', 503);
  }
  return NextResponse.json({
    success: true,
    data: {
      clientId: config.clientId,
      projectId: config.projectId,
      authUri: config.authUri,
    },
  });
}

async function handleGoogleRedirect(request: Request, url: URL): Promise<NextResponse> {
  const config = await getGoogleOAuthCredentials();
  if (!config) {
    console.error('[auth] Google OAuth not configured');
    return NextResponse.redirect(new URL('/ops-admin?auth=error', getOrigin(request)));
  }

  const redirectTo = url.searchParams.get('redirect') || '/';
  const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const state = `${redirectTo}::${nonce}`;
  const origin = getOrigin(request);
  const redirectUri = `${origin}/api/auth/callback/google`;

  const authUrl = buildGoogleAuthUrl(config, { redirectUri, state });
  return NextResponse.redirect(authUrl);
}

async function handleGoogleCallback(request: Request, url: URL): Promise<NextResponse> {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') ?? '';
  const oauthError = url.searchParams.get('error');

  let redirectTo = '/';
  if (state.includes('::')) {
    redirectTo = state.split('::')[0] || '/';
  }

  const origin = getOrigin(request);

  if (oauthError || !code) {
    return NextResponse.redirect(new URL(`${redirectTo}?auth=error`, origin));
  }

  const config = await getGoogleOAuthCredentials();
  if (!config) {
    console.error('[auth/google-callback] OAuth not configured');
    return NextResponse.redirect(new URL(`${redirectTo}?auth=error`, origin));
  }

  try {
    const tokenResp = await fetch(config.tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: `${origin}/api/auth/callback/google`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResp.ok) {
      console.error('[auth/google-callback] Token exchange failed:', tokenResp.status);
      return NextResponse.redirect(new URL(`${redirectTo}?auth=error`, origin));
    }

    const tokens = await tokenResp.json() as { access_token?: string };
    const userResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userResp.ok) {
      console.error('[auth/google-callback] Userinfo failed:', userResp.status);
      return NextResponse.redirect(new URL(`${redirectTo}?auth=error`, origin));
    }

    const user = await userResp.json() as {
      id: string;
      email?: string;
      name?: string;
      picture?: string;
    };

    const token = await signSession({
      sub: user.id,
      tier: 'google',
      email: user.email,
      name: user.name,
      picture: user.picture,
    });

    // Ensure user exists in platform_users for admin management
    await ensurePlatformUser(user.id, user.email, user.name, 'google');

    const response = NextResponse.redirect(new URL(`${redirectTo}?auth=success`, origin));
    setSessionCookie(response, token);
    return response;
  } catch (err) {
    console.error('[auth/google-callback] Error:', err instanceof Error ? err.message : err);
    return NextResponse.redirect(new URL(`${redirectTo}?auth=error`, origin));
  }
}

async function handleMe(request: Request): Promise<NextResponse> {
  try {
    const session = await getSessionFromRequest(request);
    let isGp = false;

    // For google-tier users, check if they're a verified GP
    if (session?.tier === 'google' && session.sub) {
      try {
        const db = createClient({ tier: 'google', sub: session.sub });
        const result = await db.$queryRawUnsafe<Array<{ verified: boolean }>>(
          `SELECT verified FROM gp_profiles WHERE user_id = $1 AND verified = true`,
          session.sub,
        );
        isGp = result.length > 0;
      } catch {
        // DB check failed — assume not GP
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        user: session
          ? {
              id: session.sub,
              email: session.email,
              name: session.name,
              picture: session.picture,
              authMethod: session.tier,
            }
          : null,
        tier: session?.tier ?? 'public',
        isGp,
      },
    });
  } catch {
    return NextResponse.json({ success: true, data: { user: null, tier: 'public', isGp: false } });
  }
}

function handleLogout(request: Request): NextResponse {
  const origin = getOrigin(request);
  const response = NextResponse.redirect(new URL('/dashboard', origin));
  clearSessionCookie(response);
  return response;
}

/** Client-friendly logout — clears cookie and returns JSON (no redirect). */
function handleLogoutClient(): NextResponse {
  const response = NextResponse.json({ ok: true, success: true });
  clearSessionCookie(response);
  return response;
}

const DEFAULT_ADMIN_CODE = '454212';

async function handleVerifyPin(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = verifyPinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Code is required' }, { status: 400 });
  }

  try {
    // Check DB-stored secret first; fall back to hardcoded default code
    const stored = await getSecretPlaintext('ADMIN_PIN');
    const validCode = stored ?? DEFAULT_ADMIN_CODE;

    if (parsed.data.pin.trim() !== validCode.trim()) {
      return NextResponse.json({ ok: false, error: 'Incorrect code' });
    }

    const token = await signSession({ sub: 'admin', name: 'Admin', tier: 'pin' });
    await ensurePlatformUser('admin', 'admin@manaposegp.id', 'Admin', 'pin');
    const response = NextResponse.json({ ok: true, success: true });
    setSessionCookie(response, token);
    return response;
  } catch (err) {
    console.error('[auth/verify-pin]', err);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}

async function handlePdf(request: Request, url: URL): Promise<NextResponse> {
  const guard = await requireGoogle(request);
  if (!guard.ok) return guard.response;

  try {
    const origin = getOrigin(request);
    const sessionCookie = request.headers.get('cookie') ?? '';
    const pagePath = url.searchParams.get('page') || '/';

    const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
    const pdfService = new PdfExportService(db);
    const jobId = await pdfService.queueJob(guard.session.sub, {
      origin,
      sessionCookie,
      pagePath,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          message: 'PDF generation job submitted successfully.',
          jobId,
          statusCheckUrl: `${origin}/api/vjobs/status/${jobId}`,
        },
      },
      { status: 202, headers: { 'Retry-After': '60' } },
    );
  } catch (err) {
    console.error('[auth/pdf]', err);
    return legacyError('Internal Server Error while queuing the PDF job.', 500);
  }
}
