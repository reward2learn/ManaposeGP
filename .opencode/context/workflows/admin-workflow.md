# Admin Workflow

Step-by-step workflows for common admin development tasks.

## Adding a new admin feature

1. Define the Prisma/ZenStack model in `zenstack/schema.zmodel`
2. Create route handler in `src/app/api/admin/{feature}/route.ts`
   - Import `ensureAdminTables` from `@/domain/admin/admin-config-service`
   - Call `await ensureAdminTables(db)` before Prisma queries
   - Use `requirePin` guard
   - Log activities with `logActivity(db, sub, 'ACTION', targetId, details)`
3. Create UI page in `src/app/(app)/admin/{feature}/page.tsx`
   - Wrap with `AuthGate requiredTier="pin"`
   - Use `fetch` with `credentials: 'include'`
4. Add quick-link card to admin dashboard (`src/app/(app)/admin/page.tsx`)
5. Add DDL to `ADMIN_TABLE_DDL` array in `admin-config-service.ts`
6. Run `bun run type-check` and `bun run lint`

## Fixing a missing column error

1. Identify the missing column from the Prisma error message
2. Add `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` to the relevant ensure function
3. Wrap each ALTER TABLE in its own `$executeRawUnsafe` call (one statement per call)
4. Call the ensure function BEFORE the Prisma query in the route handler
5. Optionally add a raw SQL fallback if ALTER TABLE might fail

## Debugging a 500 on an admin API

1. Check Vercel function logs for the specific error message
2. Verify `ensureAdminTables` / `ensureAppSettingsTable` is called before Prisma queries
3. Check for multi-statement DDL (PostgreSQL error 42601)
4. Verify `NEXT_PUBLIC_APP_URL` / `PRODUCTION_APP_URL` matches actual domain
5. Check `ENCRYPTION_KEY` is 64 hex chars
6. Verify the route uses `requirePin` (not `requireWriteAuth`)

## Deploying when CLI rate-limited

1. Push to GitHub: `git push origin masterbranch`
2. Trigger deploy from Vercel Dashboard → Deployments → Redeploy
3. Or enable GitHub auto-deploy in Vercel Project Settings → Git
