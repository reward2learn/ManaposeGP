# Google OAuth Skill

Google OAuth 2.0 sign-in configuration and troubleshooting for ManaposeGP.

## Configuration

### Required Google Cloud Console settings

1. **OAuth 2.0 Client ID** — Web application type
2. **Authorized JavaScript origins**: `https://manapausegp.vercel.app`
3. **Authorized redirect URIs**: `https://manapausegp.vercel.app/api/auth/callback/google`
4. Also add local: `http://localhost:3000/api/auth/callback/google`

### Production URL

```typescript
// src/lib/auth/session.ts
const PRODUCTION_APP_URL = 'https://manapausegp.vercel.app';
```

Override via `NEXT_PUBLIC_APP_URL` env var in Vercel.

### Credentials sources (priority order)

1. **Database** — `google_oauth_config` table (encrypted `client_secret`)
2. **Environment variables** — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_PROJECT_ID`, `GOOGLE_AUTH_URI`, `GOOGLE_TOKEN_URI`

### Seed credentials to DB

```bash
bun run scripts/seed-google-oauth.ts
```

Reads from env vars and stores encrypted in DB.

## Troubleshooting

### `redirect_uri_mismatch` (Error 400)

**Cause**: The redirect URI sent by the app doesn't match what's registered in Google Cloud Console.

**Check**:
1. The redirect URI: `{origin}/api/auth/callback/google`
2. The origin is `PRODUCTION_APP_URL` (or `NEXT_PUBLIC_APP_URL` if set)
3. Verify: `GET /api/auth?action=google-config` returns the client ID being used
4. Make sure the EXACT URI is in Google Cloud Console → Credentials → OAuth 2.0 Client → Authorized redirect URIs

**Common gotcha**: Domain typo (`manaposegp` vs `manapausegp`)

### Invalid credentials

- DB has different `client_id` than Google Cloud Console
- `ENCRYPTION_KEY` changed → can't decrypt DB-stored `client_secret`
- Fix: delete DB row and let it fall back to env vars, or re-seed

## Files

| File | Purpose |
|------|---------|
| `src/lib/auth/google-oauth.ts` | Credential management, OAuth URL builder, token exchange |
| `src/app/api/auth/route.ts` | Google redirect + callback handlers |
| `src/lib/auth/session.ts` | Origin resolution, PRODUCTION_APP_URL |
| `scripts/seed-google-oauth.ts` | Seed credentials to DB |

## Flow

1. User clicks "Sign in with Google" → `GET /api/auth?action=google&redirect=...`
2. App builds OAuth URL with `redirect_uri={origin}/api/auth/callback/google`
3. Google authenticates, redirects back to callback
4. App exchanges code for tokens, verifies, creates/updates session
5. JWT cookie `manaposegp.session` set with `tier: 'google'`
