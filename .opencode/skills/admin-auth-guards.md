# Admin Auth Guards Skill

JWT session-based authentication with tier claims. All admin routes use `requirePin` or `requireWriteAuth` guards.

## Auth Tiers

| Tier | Source | Guard | Access |
|------|--------|-------|--------|
| `public` | No session | None | Public pages only |
| `pin` | `POST /api/auth?action=verify-pin` | `requirePin` | All admin routes, ops admin |
| `google` | Google OAuth | `requirePin` (if verified GP) or `requireWriteAuth` | Full app |

## Guards

```typescript
// src/lib/auth/guards.ts

// Session-agnostic: any valid JWT session
requireSession(request)

// Write access: pin OR google tier
requireWriteAuth(request)

// Admin access: pin tier, OR google tier + verified GP
requirePin(request)

// Google-only: google tier only
requireGoogle(request)
```

## Cookie Configuration

- Cookie name: `manaposegp.session`
- JWT secret: first 32 chars of `ENCRYPTION_KEY` env var (64 hex chars)
- Algorithm: HS256
- Max age: 30 days
- Flags: `HttpOnly; SameSite=Lax; Path=/; Secure` (production only)

## Adding auth to a new route

```typescript
import { requirePin } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response; // 401 + error message

  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
  // ...
}
```

## Production URL

```typescript
// src/lib/auth/session.ts
const PRODUCTION_APP_URL = 'https://manapausegp.vercel.app';
```

Override with `NEXT_PUBLIC_APP_URL` env var. Used for Google OAuth redirect URI construction.

## Error messages (diagnostic)

`requireWriteAuth` returns descriptive messages:
- "Write access requires authentication. Please sign in." — no session
- "Write access requires pin or google tier (current: public)." — wrong tier

## Testing pattern

```typescript
vi.mock('@/lib/auth/session', () => ({
  getSessionFromRequest: vi.fn().mockResolvedValue(null),
}));
// ...test 401 response
```
