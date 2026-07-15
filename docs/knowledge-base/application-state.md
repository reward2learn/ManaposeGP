# ManaposeGP — Current Application State (July 2026)

Comprehensive reference for agents and developers working on the platform.

## Deployment

- **Production URL**: `https://manaposegp.vercel.app`
- **Vercel project**: `ilishaps-projects/manaposegp`
- **GitHub**: `reward2learn/ManaposeGP` (branch `masterbranch`)
- **Deploy**: `vercel deploy --prod` or push to GitHub (auto-deploy if configured)
- **Auth cookie**: `manaposegp.session` (JWT HS256, first 32 chars of `ENCRYPTION_KEY`)
- **Routes**: 67 total (27 static + 40 dynamic)

## Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 App Router (Turbopack) |
| Language | TypeScript strict |
| Schema / ORM | ZenStack v2.22.3 (`zenstack/schema.zmodel`) |
| UI | MUI v7 (dark theme) |
| State | RTK Query + uiSlice + chatStreamSlice + authSlice |
| Database | Neon Postgres |
| Testing | Vitest + RTL |
| Build | `bun run build` (zenstack generate → next build) |

## Admin Platform (16 sub-pages)

| Route | Function | API |
|-------|----------|-----|
| `/admin` | Dashboard with 5 stats cards + 11 quick links | `/api/admin/dashboard` |
| `/admin/gp-verification` | List, view, edit, approve/reject GPs | `/api/admin/gp-verification` |
| `/admin/patients` | View patients, assign to GPs | `/api/admin/patients` |
| `/admin/blog` | Blog management: edit, publish, view | `/api/blog/admin` |
| `/admin/health-education` | List, edit, delete health articles | `/api/admin/health-education` |
| `/admin/ai-config` | OpenAI key + chat settings | `/api/config/openai-key`, `/api/config/settings` |
| `/admin/appointment-types` | Auto-seeded (10 types), CRUD | `/api/admin/appointment-types` |
| `/admin/fee-schedule` | Auto-seeded (33 MBS items), edit fees | `/api/admin/fee-schedule` |
| `/admin/practice-settings` | Hours, timezone, billing | `/api/admin/practice-settings` |
| `/admin/feature-flags` | 10 toggle switches | `/api/admin/feature-flags` |
| `/admin/providers` | Pathology/radiology directory | `/api/admin/providers` |
| `/admin/notification-templates` | Email/SMS templates | `/api/admin/notification-templates` |
| `/admin/users` | User management | `/api/admin/users` |
| `/admin/activity-log` | Audit trail | `/api/admin/activity-log` |

## Key Architecture Patterns

### DDL Pattern
- Always split multi-statement DDL into individual `$executeRawUnsafe` calls (PostgreSQL error 42601)
- Use `ALTER TABLE ADD COLUMN IF NOT EXISTS` for migrations
- Call ensure functions in **every function** that queries the table — read + write + find — not just route handlers
- Runtime DDL columns exist in PostgreSQL but NOT in the Prisma/ZenStack schema; a `$queryRawUnsafe` SELECT referencing them will fail on cold start if the DDL hasn't been called first
- Wrap DDL in try/catch for resilience

### Raw SQL Fallback
- Used when Prisma schema columns don't exist in production DB
- GP verification: `listGpsForVerification()` uses raw SQL with `COALESCE`
- Patient listing: `patient-service.ts` uses raw SQL joins
- Blog posts: All CRUD uses `$queryRawUnsafe` and `$executeRawUnsafe`

### Auth Guards
- `requirePin`: pin tier or verified GP (admin routes)
- `requireWriteAuth`: pin or google tier (config routes)
- `requireSession`: any valid JWT
- `requireGoogle`: google tier only

### Dashboard Stats
- `Promise.allSettled` for resilience
- OpenAI key check: DB → env var fallback via `getOpenAiKeyStatus()`
- GP counts, patient counts, appointment/consultation counts

## Health Education System

| Feature | Status |
|---------|--------|
| Public listing | `GET /api/health/education` — search/filter by category, language |
| Article upload | `POST /api/health/education/upload` — creates article + knowledge snippet |
| Admin CRUD | `GET/PATCH/DELETE /api/admin/health-education` — full lifecycle |
| Chatbot indexing | `knowledge_snippets` table — key=`admin_{slug}`, updated on edit/delete |
| Domain service | `health-education-service.ts` — Prisma reads, raw SQL writes |
| Admin page | `/admin/health-education` — table + edit dialog + delete confirmation |
| Categories (9) | menopause, mental_health, bone_health, cardiovascular, sexual_health, nutrition, exercise, sleep, general |
| Sources (10) | jean_hailes, ams, healthdirect, beyond_blue, racgp, nps, pubmed, etg, osteoporosis_australia, admin |
| Languages | en, es, fr, zh, ar, hi, pt |
| Reading levels | easy_read, standard, clinical |

## Blog System

| Feature | Status |
|---------|--------|
| URL scraping (health articles) | Cheerio-based `scrapeUrl()` |
| Instagram oEmbed | `fetchPostViaOembed()` →
 `fetchPostViaHtml()` fallback |
| AI enhancement | `enhanceContent()` — rephrases, formats, adds headings |
| Draft/published | Admin-created = draft; automated = published |
| Image support | `imageUrl` (card/header) + `sectionImages` (JSONB body) |
| Paste content | HTML/text → extract images → AI rephrase |
| Duplicate prevention | `findPostBySourceUrl()` before creation |
| AI indexing | `indexBlogPost()` → `blog_embeddings` → RAG via `searchKnowledgeBase()` |
| Blog management | `/admin/blog` — edit, publish, view |

## Automated Systems

| System | Route | Trigger |
|--------|-------|---------|
| Instagram cron | `/api/cron/instagram` | Vercel Cron (13:00 UTC) or manual Run Now |
| Content extraction | `/config/automation` | Instagram URL, health article URL, pasted content |

## Sessions & Auth

- Cookie: `manaposegp.session` (HttpOnly, SameSite=Lax, Secure in prod)
- JWT: HS256, first 32 chars of `ENCRYPTION_KEY` (64 hex chars)
- Tiers: `public`, `pin` (admin), `google` (OAuth)
- Google OAuth redirect URI: `https://manaposegp.vercel.app/api/auth/callback/google`
- `NEXT_PUBLIC_APP_URL` overrides hardcoded `PRODUCTION_APP_URL`
