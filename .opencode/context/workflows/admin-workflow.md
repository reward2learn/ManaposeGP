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

## Blog Management Workflow

### Creating a blog post
1. User submits URL via `/blog/create` or `/config/automation`
2. Content scraped via `scrapeUrl()` (cheerio) or Instagram scraper
3. Images extracted from og:image + article `<img>` tags
4. AI enhances via `enhanceContent()` — rephrases, formats, adds headings
5. Post created via `createBlogPost()` with `published` flag
6. If pasted content: HTML images extracted, plaintext sent to AI
7. `indexBlogPost()` called (fire-and-forget) for AI embedding

### Editing a blog post
1. Admin opens `/admin/blog` → clicks Edit on a post
2. Edit dialog shows title, content (markdown), excerpt, image URL, section images (JSON), publish toggle
3. Save calls `PATCH /api/blog/admin` → `updateBlogPost()`
4. If content changed, re-indexes via `indexBlogPost()`

### Publishing flow
- Admin-created posts: draft by default → admin reviews → clicks "Draft" chip → toggles to "Published"
- Automated posts (Instagram cron): published immediately
- Public blog page (`/blog`) only shows `published = true`
- AI knowledge base searches all posts (draft + published)

## Fixing a missing column error

1. Identify the missing column from the Prisma error message
2. Add `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` to the relevant ensure function
3. Wrap each ALTER TABLE in its own `$executeRawUnsafe` call (one statement per call)
4. **Call the ensure function in EVERY function that queries the table** — not just write functions, not just route handlers. When a column is added via runtime DDL (ALTER TABLE), it exists in PostgreSQL but not in the Prisma/ZenStack schema. Any `$queryRawUnsafe` that references the column (even via `COALESCE`) will throw if the DDL hasn't run first on that serverless cold start. This is the most common cause of "page shows zero results" bugs.
5. Optionally add a raw SQL fallback if ALTER TABLE might fail

### Checklist when adding a runtime DDL column:
- [ ] ensure function itself (`ensureXColumns`)
- [ ] create/insert function ✅
- [ ] update function ✅
- [ ] list/find functions (read queries) ← **most commonly missed**
- [ ] getById functions ← **most commonly missed**
- [ ] search/duplicate-check functions ← **most commonly missed**

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
