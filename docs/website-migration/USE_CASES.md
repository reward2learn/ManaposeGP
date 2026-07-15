# Rosalita Website — Use Cases (Migration v2)

**Plan version:** 2.0  
**Sources:** Cashflow Excel, Business Review MD, Executive Summary MD, legacy `website/api/*.js`, HTML pages  
**Schema SSoT:** `website/zenstack/schema.zmodel`  
**Page SSoT (MVP runtime):** `website/src/lib/page-catalog.ts` (DB `AppPage`/`PageSection` seeded in P6, catalog wins at runtime)

## Auth tiers

| Tier | How obtained | Write APIs | Read scope |
|------|--------------|------------|------------|
| `public` | No session | None | Public pages, read-only metrics list |
| `pin` | `POST /api/auth?action=verify-pin` | Z-reports, imports, monthly actuals, POS | ops-admin, partial dashboard |
| `google` | Google OAuth | All write APIs | Full app including review, chat, PDF |

**v2 write auth:** JWT in cookie `rosalita.session` — claims include `tier`. **No `x-admin-key` in client.**

---

## Data sources (P0 verified)

| Source | Key entities | IDR format |
|--------|--------------|------------|
| `Rosallita Cashflow May 24th 2026.xlsx` | `FinancialProjection` 2026–2030 | Full integers via `load_financial_data.mjs` |
| `Rosalita Executive Summary — June 2026.md` | 5 Levers, P0/P1/P2 actions, KPI targets | May 2026: revenue 411M, EBITDA 434K |
| `Rosalita Business Review — June 2026.md` | Parts A–O (`BusinessReviewPart`) | Staff cost 40%→22% target |
| `website/lib/knowledge-base.js` | `KnowledgeSnippet`, `MONTHLY_TARGETS[]` | `MONTHLY_TARGETS` → `monthly_targets` table |
| `website/api/schema.sql` | `daily_metrics`, `monthly_targets` | Not auto-created by legacy migrate |

**Review routing:** `/review/[partSlug]` from seeded MD — **no `review.html` port** (5344 lines).

---

## Use case table

### Legal & static content

| ID | Use case | Auth | Route | Block types | Source | Acceptance |
|----|----------|------|-------|-------------|--------|------------|
| UC-LEGAL-01 | View terms of service | public | `/terms-of-service` | `doc_markdown` | `terms-of-service.html` | Public; footer link from all pages |
| UC-LEGAL-02 | View privacy policy | public | `/privacy-policy` | `doc_markdown` | `privacy-policy.html` | Public; GDPR-style sections preserved |

### Authentication & session (JWT)

| ID | Use case | Auth | Route / API | Models | Source | Acceptance |
|----|----------|------|-------------|--------|--------|------------|
| UC-AUTH-01 | Google OAuth sign-in | public→google | `GET /api/auth?action=google` | — | `auth.js` | Cookie set; tier `google` |
| UC-AUTH-02 | PIN sign-in for ops | public→pin | `POST /api/auth?action=verify-pin` | `Secret` | `auth.js`, `ops-admin.html` | tier `pin`; limited nav |
| UC-AUTH-03 | Session bootstrap | any | `GET /api/auth?action=me` | — | `auth.js` | RTK `authApi.getSession`; no raw fetch in components |
| UC-AUTH-04 | Logout | any | `GET /api/auth?action=logout` | — | `auth.js` | Cookie cleared; tier `public` |
| UC-AUTH-05 | JWT-gated metrics write | pin/google | `POST/DELETE /api/metrics` | `DailyZReport` | `metrics.js` | 401 without valid JWT write tier; no admin header |
| UC-AUTH-06 | JWT-gated monthly actuals write | pin/google | `POST financial-overview?resource=monthly-actuals` | `MonthlyActualDepartment` | `monthly-actuals.js` | Same JWT guard |
| UC-AUTH-07 | JWT-gated POS OCR | pin/google | `POST /api/pos` | — | `pos.js` | Write tier required |
| UC-AUTH-08 | Store encrypted secret (setup) | SETUP_TOKEN | `POST /api/auth?action=store-key` | `Secret` | `auth.js` (handleStoreKey **undefined in legacy**) | Bearer SETUP_TOKEN; scaffold in `src/lib/auth/store-key.ts` P3 |
| UC-AUTH-09 | PDF export (authenticated) | google | `GET /api/auth?action=pdf` | `PdfJob` / `job_queue` | `auth.js` | Job queue + poll; server Puppeteer |

### Financial operations

| ID | Use case | Auth | Route / API | Models | Source | Acceptance |
|----|----------|------|-------------|--------|--------|------------|
| UC-FIN-01 | Record daily POS Z-report | pin/google | ops-admin block `z_report_form` | `DailyZReport` | Excel + `metrics.js` | Receipt images required; full IDR integers |
| UC-FIN-02 | OCR scan/parse POS receipts | pin/google | `/api/pos?action=scan\|parse` | — | `pos.js` | Parsed fields populate form |
| UC-FIN-03 | Enter monthly department costs | pin/google | `monthly-actuals` resource | `MonthlyActualDepartment`, `MonthlyActualInput` | `monthly-actuals.js` | Dept schema validation |
| UC-FIN-04 | View multi-scenario P&L projections | google (charts) | dashboard / ops-tracking | `FinancialProjection` | Excel 2026–2030 | `data_type` + `scenario` preserved |
| UC-FIN-05 | Track monthly KPI targets | google | ops-tracking | `MonthlyTarget` | Executive Summary + `knowledge-base.js` MONTHLY_TARGETS | Targets vs actuals; `monthly_targets` table |
| UC-FIN-06 | Bulk XLSX import Z-reports | pin/google | `POST metrics action=import` | `DailyZReport.entrySource` | `metrics.js` | `xlsx_daily`, `xlsx_prorate` sources |
| UC-FIN-07 | P&L drill-down by month | google | `?period=YYYY-MM` on financial-overview | `FinancialProjection.pnlLines` | `financial-overview.js` | All 4 scenario keys in response |
| UC-FIN-08 | Delete Z-report or month import | pin/google | `DELETE /api/metrics` | `DailyZReport` | `metrics.js` | Cascade resync monthly actuals |
| UC-FIN-09 | Z-report schema for dynamic form | pin/google | `GET metrics?schema=1` | — | `z-report-schema.js` | Department-specific required fields |

### Executive dashboard

| ID | Use case | Auth | Route | Blocks | Source | Acceptance |
|----|----------|------|-------|--------|--------|------------|
| UC-DASH-01 | 5 Levers overview | public/partial | `/` slug `dashboard` | `lever_accordion` | Executive Summary | Tiered visibility |
| UC-DASH-02 | Scenario target cards | public/partial | `/` | `metric_grid` | Executive Summary | Conservative/realistic/aspirational |
| UC-DASH-03 | P0/P1/P2 action checklists | google | `/` | `action_checklist` | Executive Summary | `ActionItem.priority` enum |
| UC-DASH-04 | Profitability chart | public/partial | `/` | `chart_financial` | `index.html` | RTK `financialApi`; month click |
| UC-DASH-05 | Key numbers to watch | public/partial | `/` | `kpi_cards` | Executive Summary | IDR formatting UI-only K |

### Business review content

| ID | Use case | Auth | Route | Models / blocks | Source | Acceptance |
|----|----------|------|-------|-----------------|--------|------------|
| UC-DOC-01 | Full review navigation Parts A–O | google | `/review/[partSlug]` | `BusinessReviewPart` | Business Review MD Parts A–O | Seeded P6; **no review.html port** |
| UC-DOC-02 | Part content rendering | google | `/review/[partSlug]` | `doc_markdown` | MD sections | No 5344-line HTML port |
| UC-DOC-03 | Executive summary page | google | `/summary` | `AppPage` | `summary.html` | PIN denied overlay |
| UC-DOC-04 | Tax loss notes | public | `/tax-structure` | `doc_markdown` | Part O / `tax-structure.html` | Static tables |

### Operations & AI

| ID | Use case | Auth | Route | Blocks / API | Source | Acceptance |
|----|----------|------|-------|--------------|--------|------------|
| UC-OPS-01 | Ops admin tabbed workspace | pin/google | `/ops-admin` | `z_report_form`, `costs_form`, `calendar_import` | `ops-admin.html` | React Hook Form for Z-report |
| UC-OPS-02 | Financial tracking charts | google | `/ops-tracking` | `chart_financial`, `pnl_table` | `ops-tracking.html` | Scenario filter + drill-down |
| UC-AI-01 | AI chat with business context | google | `/ops-chat` | `chat_panel` | `chat.js`, `knowledge-base.js` | `chatStreamSlice` for SSE |
| UC-AI-02 | Voice TTS | google | `/api/chat?resource=voice` | — | `voice.js` | No API key in client |
| UC-AI-03 | Save conversation history | google | `/api/chat?resource=conversations` | `Conversation` | `conversations.js` | Session user name on insert |
| UC-RPT-01 | Legacy reports rollup | google | `?resource=reports` | — | `reports.js` | daily/weekly/monthly periods |
| UC-RPT-02 | Server-side PDF export | google | PDF job flow | `PdfJob` | `pdf-lib.js` | Poll `vjobs/status` |

### Dynamic UI (code-first catalog)

| ID | Use case | Auth | Implementation | Acceptance |
|----|----------|------|----------------|------------|
| UC-UI-01 | Resolve page by slug | tier from catalog | `page-catalog.ts` → `DynamicPage` | Catalog overrides DB at MVP |
| UC-UI-02 | Render block registry | per block | `block-registry.ts` + Zod `BlockConfig` | Unknown block type fails type-check |
| UC-UI-03 | Seed DB pages for post-MVP CMS | — | P6 `seed-from-sources.ts` | DB mirrors catalog; runtime reads catalog first |

---

## UC → phase mapping

| Phase | Use cases delivered |
|-------|---------------------|
| P0 | All (documented) |
| P1 | UC-AUTH-03 scaffold |
| P2 | Domain services for UC-FIN-* |
| P3 | UC-AUTH-01–09, UC-FIN-* APIs |
| P4 | RTK Query + uiSlice + chatStreamSlice + RHF |
| P6 | UC-DOC-01–04, UC-DASH-* seed data, UC-AI KB snippets |
| P5 | UC-UI-01–03, UC-LEGAL-*, shell |
| P7 | UC-DASH-*, UC-DOC-03–04, UC-OPS-02 |
| P8 | UC-OPS-01, UC-AI-*, UC-DOC-01–02 |
| P9 | UC-AUTH-*, UC-RPT-*, E2E all tiers |

---

## Admin use cases (ManaposeGP Platform)

### Admin Dashboard

| ID | Use case | Auth | Route / API | Models | Acceptance |
|----|----------|------|-------------|--------|------------|
| UC-ADMIN-01 | View admin dashboard with stats | pin | `GET /api/admin/dashboard` | `GPProfile`, `HealthProfile`, `Appointment`, `GPConsultation`, `Secret` | 5 stats cards render with correct values; all cards clickable to relative routes |
| UC-ADMIN-02 | OpenAI key status reflects DB+env | pin | dashboard card → `getOpenAiKeyStatus()` | `Secret`, env var | Card shows "Configured" when key in DB or env, "Missing" otherwise |
| UC-ADMIN-03 | Resilient dashboard on partial failures | pin | `Promise.allSettled` in `getDashboardStats` | All | One failing stat doesn't zero entire dashboard |

### AI Configuration

| ID | Use case | Auth | Route / API | Models | Acceptance |
|----|----------|------|-------------|--------|------------|
| UC-AI-01 | View OpenAI key status | pin | `GET /api/config/openai-key` | `Secret` | Shows configured/not-configured + source (db/env) |
| UC-AI-02 | Save OpenAI key (encrypted) | pin | `POST /api/config/openai-key` | `Secret` | AES-256-GCM encrypted; key never shown after save |
| UC-AI-03 | Remove OpenAI key from DB | pin | `DELETE /api/config/openai-key` | `Secret` | Falls back to env var if set |
| UC-AI-04 | Toggle chat web search | pin | `PATCH /api/config/settings` | `AppSetting` | `webSearchEnabled` persisted; 401 with descriptive error if auth fails |
| UC-AI-05 | Configure via consolidated admin route | pin | `/admin/ai-config` | — | `OpenAiKeyForm` + `ChatSettingsForm` under admin; `/config` redirects |

### GP Verification

| ID | Use case | Auth | Route / API | Models | Acceptance |
|----|----------|------|-------------|--------|------------|
| UC-GPV-01 | List all registered GPs | pin | `GET /api/admin/gp-verification` | `GPProfile` | Raw SQL query; works even if `verification_status` column missing (COALESCE fallback) |
| UC-GPV-02 | Approve GP registration | pin | `PATCH /api/admin/gp-verification` | `GPProfile` | Sets `verified=true`, `verification_status='APPROVED'` via raw SQL |
| UC-GPV-03 | Reject GP registration | pin | `PATCH /api/admin/gp-verification` | `GPProfile` | Sets `verified=false`, `verification_status='REJECTED'`, optional notes |
| UC-GPV-04 | GP columns auto-created | pin (on access) | `ensureGpProfileColumns(db)` | `GPProfile` | ALTER TABLE adds `verification_status`, `verification_notes`, `updated_at` if missing |

### Admin CRUD

| ID | Use case | Auth | Route / API | Models | Acceptance |
|----|----------|------|-------------|--------|------------|
| UC-CRUD-01 | Manage appointment types | pin | `/api/admin/appointment-types` | `AppointmentType` | CRUD with name, duration, color; table auto-created |
| UC-CRUD-02 | Manage fee schedule | pin | `/api/admin/fee-schedule` | `FeeScheduleItem` | MBS item numbers with practice fees; table auto-created |
| UC-CRUD-03 | Manage provider directory | pin | `/api/admin/providers` | `ProviderDirectory` | Pathology/radiology filter; table auto-created |
| UC-CRUD-04 | Manage notification templates | pin | `/api/admin/notification-templates` | `NotificationTemplate` | Email/SMS templates with `{{variables}}`; table auto-created |
| UC-CRUD-05 | Manage platform users | pin | `/api/admin/users` | `PlatformUser` | Update tier, role, status |
| UC-CRUD-06 | View activity log | pin | `/api/admin/activity-log` | `ActivityLog` | Audit trail with action filter; table auto-created |
| UC-CRUD-07 | Tables auto-created on first access | pin (on access) | `ensureAdminTables(db)` | All above | `CREATE TABLE IF NOT EXISTS` for 6 tables; no migration needed |

### Feature Flags

| ID | Use case | Auth | Route / API | Models | Acceptance |
|----|----------|------|-------------|--------|------------|
| UC-FF-01 | View feature flags | pin | `GET /api/admin/feature-flags` | `AppSetting.featureFlags` | Returns JSON of boolean flags; empty `{}` if table missing |
| UC-FF-02 | Toggle feature flags | pin | `PATCH /api/admin/feature-flags` | `AppSetting` | Upserts `feature_flags` column; resilient to DDL failures |
| UC-FF-03 | DDL split into single statements | — | `ensureAppSettingsTable(db)` | — | No 42601 "multiple commands into prepared statement" error |

### Practice Settings

| ID | Use case | Auth | Route / API | Models | Acceptance |
|----|----------|------|-------------|--------|------------|
| UC-PS-01 | View practice settings | pin | `GET /api/admin/practice-settings` | `PracticeSettings` | Singleton with smart defaults (Australia/Adelaide, 15-min slots, $85 bulk bill) |
| UC-PS-02 | Update practice settings | pin | `PATCH /api/admin/practice-settings` | `PracticeSettings` | Timezone, hours, billing defaults |

### Auth & Session

| ID | Use case | Auth | Route / API | Models | Acceptance |
|----|----------|------|-------------|--------|------------|
| UC-AUTH-10 | Pin-tier admin access | pin | All `/api/admin/*` | — | `requirePin` guard; descriptive error messages |
| UC-AUTH-11 | Write auth for config APIs | pin/google | `/api/config/*` | — | `requireWriteAuth` with tier-specific messages |
| UC-AUTH-12 | Google OAuth redirect URI match | — | `GET /api/auth?action=google` | — | URI matches Google Cloud Console; no redirect_uri_mismatch |
| UC-AUTH-13 | Production URL consistency | — | `PRODUCTION_APP_URL` | — | Matches `NEXT_PUBLIC_APP_URL` or hardcoded `manapausegp.vercel.app` |

---
### Blog Management

| ID | Use case | Auth | Route / API | Models | Acceptance |
|----|----------|------|-------------|--------|------------|
| UC-BLOG-01 | Create post from URL | pin | `POST /api/blog/create` | `BlogPost` | Scrapes URL, enhances with AI, indexes into knowledge base |
| UC-BLOG-02 | Create post from pasted content | pin | `POST /api/config/automation?action=paste-content` | `BlogPost` | Handles HTML/text, extracts images, AI rephrases |
| UC-BLOG-03 | Scrape Instagram post | pin | `POST /api/config/automation?action=scrape-url` | `BlogPost` | Instagram oEmbed + HTML fallback |
| UC-BLOG-04 | Auto-scrape Instagram profile | cron | `GET /api/cron/instagram` | `BlogPost` | Vercel scheduled + manual Run Now |
| UC-BLOG-05 | Scrape health article URL | pin | `POST /api/config/automation?action=scrape-url` | `BlogPost` | Cheerio-based; captures images as sectionImages |
| UC-BLOG-06 | Draft/published workflow | — | `published` field | `BlogPost` | Admin-created = draft; automated = published |
| UC-BLOG-07 | List all posts for admin | pin | `GET /api/blog/admin` | `BlogPost` | Shows drafts + published; table with edit/view |
| UC-BLOG-08 | Edit blog post | pin | `PATCH /api/blog/admin` | `BlogPost` | Update content, images, publish status; re-index |
| UC-BLOG-09 | Toggle publish/draft | pin | `PATCH /api/blog/admin` | `BlogPost` | One-click chip toggle on admin table |
| UC-BLOG-10 | Public blog listing | public | `GET /api/blog` | `BlogPost` | Only published posts shown |
| UC-BLOG-11 | AI blog knowledge search | any | `search_blog_knowledge` tool | `blog_embeddings` | RAG via `searchKnowledgeBase()`; works on drafts too |
| UC-BLOG-12 | Card image + section images | admin | `imageUrl` + `sectionImages` fields | `BlogPost` | Card thumbnail, header image, body section dividers |
| UC-BLOG-13 | Duplicate prevention | — | `findPostBySourceUrl()` | `BlogPost` | Skips posts with same source_url |
| UC-BLOG-14 | Blog admin page | pin | `/admin/blog` | — | Table, edit dialog, publish toggle, view link |

---

## Non-goals (MVP)

- Admin UI to edit `AppPage` in database (post-MVP P10)
- Client-side PDF generation
- `x-admin-key` in any client bundle
- Zustand stores
- Port of `review.html` (use MD seed + `/review/[partSlug]` only)
- Greenfield schema (introspection + `@@map` only)
