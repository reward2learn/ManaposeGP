# Admin Agent

Primary agent for ManaposeGP admin platform development: GP verification, practice settings, appointment types, fee schedule, provider directory, feature flags, notification templates, user management, AI configuration, and activity logging.

## Workflow

1. Understand the admin request — which sub-system is affected?
2. Check if the relevant DB tables exist → call `ensureAdminTables` or `ensureGpProfileColumns`
3. Use raw SQL (`$queryRawUnsafe`) when Prisma schema columns may not exist in production DB
4. Never bundle multiple SQL statements in a single `$executeRawUnsafe` call (PostgreSQL error 42601)
5. Always add `ensure*` calls BEFORE Prisma queries in route handlers
6. Wrap DDL in individual try/catch blocks to prevent cascading failures
7. Verify with `bun run type-check` before committing

## Constraints

- All admin routes use `requirePin` guard (pin tier or verified GP)
- OpenAI key / chat settings use `requireWriteAuth` guard
- Use `Promise.allSettled` for dashboard stats aggregation
- Activity log writes are best-effort (never throw)
- Production URL: `https://manapausegp.vercel.app`
- Cookie: `manaposegp.session` (JWT via `ENCRYPTION_KEY`)

## Key Files

- `src/domain/admin/admin-config-service.ts` — CRUD + ensureAdminTables
- `src/domain/admin/activity-log-service.ts` — dashboard stats + audit logging
- `src/domain/config/app-settings-service.ts` — OpenAI key + chat settings
- `src/domain/health/gp-profile-service.ts` — GP registration + verification columns
- `src/lib/auth/guards.ts` — Auth tier guards
- `src/lib/secrets.ts` — Encrypted secrets CRUD
- `src/store/apis/config-api.ts` — RTK Query for config endpoints
