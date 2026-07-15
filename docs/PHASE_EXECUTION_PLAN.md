# ManaposeGP Healthcare MVP — Phase-by-Phase Agent Execution Plan

## Agent Assignment Matrix

| Agent | Role in Healthcare MVP |
|-------|----------------------|
| **website-zenstack-migration** | Healthcare schema extensions, pgvector enablement, enum generation |
| **website-db-migration** | Seed health education content, ensure healthcare tables exist |
| **website-api-migration** | All `/api/health/*` and `/api/gp/*` route handlers |
| **website-oop-domain-migration** | Domain services: health-profile, symptom, metrics, medication, consent, screening, risk-calculation |
| **website-redux-migration** | RTK Query slices: `healthApi`, `symptomSlice`, `healthMetricsSlice`, `clinicalSlice` |
| **website-dynamic-ui-migration** | Healthcare pages in `page-catalog.ts`, block types |
| **website-mui-migration** | MUI components for symptom journal, health dashboard, clinical tools |
| **website-auth-migration** | Tier enforcement for healthcare routes, consent-based access guards |
| **CoderAgent** | Individual file implementations (services, components, API routes) |
| **BatchExecutor** | Parallel execution of independent CoderAgent tasks (4+) |
| **BuildAgent** | Type-check + lint validation after each phase |
| **CodeReviewer** | Review against project standards at phase gates |
| **DocWriter** | Phase documentation, API specs |

---

## Navigation & Auth Architecture

### Role-Based Access Control

The platform has three distinct roles, each with isolated page access and different landing pages:

| Role | Auth Tier | Sign-in Method | Landing Page | Can See Pages |
|------|-----------|---------------|-------------|---------------|
| **Patient** | `google` | Google OAuth (NOT a verified GP) | `/health-dashboard` | `public` + `google` |
| **GP** | `google` | Google OAuth (verified GP in `gp_profiles`) | `/gp-dashboard` | `public` + `google` + `pin` |
| **GP** | `pin` | PIN verification | `/gp-dashboard` | `public` + `pin` |
| **Platform Admin** | `pin` | PIN verification (sub=`admin`) | `/gp-management` | `public` + `pin` |

**Key rule:** Patients must NEVER see GP or admin pages in the navigation drawer. GPs must NEVER see patient health data pages unless the patient has granted consent.

### Tier Isolation (page-catalog.ts)

`tierAllowsAccess(current, required)` enforces role-based isolation:
- `public` pages → visible to everyone (health library, terms, privacy)
- Non-public pages → require exact tier match (`pin` ↔ `google` are mutually exclusive)

**Exception:** Google-signed-in users who are verified GPs (`isGp=true`) may also see `pin` pages. This is determined at session bootstrap by checking `gp_profiles` in the `/me` endpoint.

### GP Detection Flow

1. User signs in via Google OAuth → JWT with `tier: 'google'`
2. `GET /api/auth?action=me` checks `gp_profiles` for verified GP record
3. Response includes `isGp: boolean`
4. `AuthProvider` saves `isGp` to Redux `authSlice`
5. `AppShell` calls `listNavPages(tier, isGp)` — if `isGp` is true, `pin`-tier pages are included
6. Landing page redirect: `google + isGp` → `/gp-dashboard`; `google` only → `/health-dashboard`

### Landing Page Redirect (src/app/page.tsx)

Root `/` is a client component that reads Redux auth state after bootstrap:
- `pin` tier → redirect to `/gp-management`
- `google + isGp` → redirect to `/gp-dashboard`
- `google` (patient) → redirect to `/health-dashboard`
- `public` → redirect to `/health-education`

### Navigation Filtering (app-shell.tsx)

The left drawer's `listNavPages(tier, isGp)` filters `PAGE_CATALOG`:
1. Exclude pages with `showInNav === false`
2. Include pages where `tierAllowsAccess(tier, authTier)` is true
3. Additionally include `pin` pages if `isGp && tier === 'google'`

Config link (`/config`) visibility: `tierAllowsAccess(tier, 'pin') || (isGp && tier === 'google')`

### Implementation Files

| File | Purpose |
|------|---------|
| `src/lib/page-catalog.ts` | `tierAllowsAccess()`, `listNavPages()`, `PAGE_CATALOG` SSoT |
| `src/components/auth/auth-gate.tsx` | Client-side page gate (imports `tierAllowsAccess`) |
| `src/components/auth/auth-provider.tsx` | Session bootstrap — saves `isGp` to Redux |
| `src/components/layout/app-shell.tsx` | Drawer nav building + brand logo link |
| `src/app/page.tsx` | Role-based landing page redirect |
| `src/app/api/auth/route.ts` | `/me` returns `isGp` via `gp_profiles` check |
| `src/store/auth-slice.ts` | `AuthState` with `isGp`, `setSession`, `resetAuth` |
| `src/store/api-types.ts` | `SessionPayload` with `isGp?` |

### E2E Test Coverage

| Test | File |
|------|------|
| Patient nav — GP pages hidden | `e2e/auth-tiers.spec.ts` |
| PIN nav — patient pages hidden, GP pages visible | `e2e/auth-tiers.spec.ts` |
| Landing page redirect per role | `e2e/auth-tiers.spec.ts` |
| Public tier — sign-in gates | `e2e/auth-tiers.spec.ts` |

### Access Code Authentication

Platform admins sign in with a 6-digit access code (not a PIN). The code is validated server-side.

| Scenario | Behavior |
|----------|----------|
| No `ADMIN_PIN` stored in `secrets` table | Default code `454212` is accepted |
| `ADMIN_PIN` stored via `store-key` | Custom code takes precedence over default |
| Wrong code entered | Returns `"Incorrect code"` error |
| Code matches | Creates JWT session with `tier: 'pin'`, `sub: 'admin'` |

**Implementation:** `src/app/api/auth/route.ts` → `handleVerifyPin()`. The constant `DEFAULT_ADMIN_CODE = '454212'` is the hardcoded fallback. When an admin stores a custom code via `POST /api/auth?action=store-key` (requires `SETUP_TOKEN`), `getSecretPlaintext('ADMIN_PIN')` returns the encrypted value, which takes priority over the default.

### Sign-Out & Data Clear

Sign-out clears **all** state on the client:

1. `localStorage.clear()` — clears voice preferences, chat consent, volume settings, etc.
2. `dispatch(resetAuth())` — resets Redux auth slice to `public` tier
3. `GET /api/auth?action=logout-client` — clears `manaposegp.session` cookie server-side
4. Navigation to `/health-education` (public landing page)

**Google re-auth:** The OAuth URL now includes `prompt=select_account`, forcing Google to show the account picker on every sign-in. No cached Google session leaks between users.

**Implementation:** `src/components/layout/app-shell.tsx` (`handleSignOut` callback), `src/lib/auth/google-oauth.ts` (`buildGoogleAuthUrl` adds `prompt=select_account`), `src/app/api/auth/route.ts` (`handleLogoutClient` returns JSON instead of redirecting).

---

## Phase 0: Foundation (Tasks P0-001 → P0-010)

### P0-001: Enable pgvector extension + run db:migrate

| Field | Value |
|-------|-------|
| **Agent** | website-db-migration |
| **Priority** | P0 |
| **Depends on** | Nothing |
| **Files** | `scripts/enable-pgvector.mjs` (new), `scripts/db-migrate.mjs` (run) |
| **Spec** | Create a script that runs `CREATE EXTENSION IF NOT EXISTS vector;` on Neon. Then run `bun run db:migrate` to create healthcare tables from `zenstack/healthcare-schema.zmodel`. Ensure `health_profiles`, `symptom_journals`, `health_metrics`, `medications`, `lab_results`, `gp_consultations`, `patient_consents`, `clinical_guidelines`, `medical_references`, `health_education`, `screening_results` all exist. |
| **Acceptance** | `SELECT tablename FROM pg_tables WHERE schemaname='public'` shows all 11 healthcare tables |

### P0-002: Generate ZenStack client from extended schema

| Field | Value |
|-------|-------|
| **Agent** | website-zenstack-migration |
| **Priority** | P0 |
| **Depends on** | P0-001 |
| **Files** | `zenstack/schema.zmodel` (update — include healthcare schema), `zenstack/prisma/schema.prisma` (generated), `src/generated/prisma/` (generated) |
| **Spec** | Merge `zenstack/healthcare-schema.zmodel` content into `zenstack/schema.zmodel`. Add the healthcare enums (MenopauseStatus, SymptomType, MetricSource, GuidelineSource, ConsultationType, MedicationStatus, ConsentStatus) and 10 healthcare models. Run `bun run zen:generate` to regenerate Prisma client with healthcare types. |
| **Acceptance** | `bun run type-check` produces no new errors; Prisma client exposes `healthProfile`, `symptomJournal`, `healthMetric` etc. |

### P0-003: Health Profile domain service

| Field | Value |
|-------|-------|
| **Agent** | CoderAgent |
| **Priority** | P0 |
| **Depends on** | P0-002 |
| **Files** | `src/domain/health/health-profile-service.ts` (new) |
| **Spec** | Domain service with methods: `getOrCreateProfile(userId: string)`, `updateProfile(userId, data)`, `getProfile(userId)`. Uses `createClient()` from `src/lib/db.ts`. Returns `HealthProfile` with all fields: dateOfBirth, sexAtBirth, menopauseStatus, heightCm, weightKg, chronicConditions, currentMedications, smokingStatus, familyHistory, etc. Handles the case where profile doesn't exist by creating a default one. |
| **Acceptance** | `import { getHealthProfile } from '@/domain/health/health-profile-service'` works; creates profile on first call |

### P0-004: Symptom Journal domain service

| Field | Value |
|-------|-------|
| **Agent** | CoderAgent |
| **Priority** | P0 |
| **Depends on** | P0-002 |
| **Files** | `src/domain/health/symptom-service.ts` (new) |
| **Spec** | Domain service with methods: `logSymptom(profileId, data: { date, symptomType, severity, duration?, frequency?, triggers?, reliefFactors?, impactOnDaily?, notes? })`, `getSymptoms(profileId, from?, to?)`, `getSymptomTrends(profileId, symptomType?, days?)`. The `getSymptomTrends` method returns aggregated data: average severity per day, frequency per week, most common triggers, trend direction (improving/worsening/stable). |
| **Acceptance** | Can log a hot flush with severity 7, retrieve it, and see it in trends |

### P0-005: Patient health API routes

| Field | Value |
|-------|-------|
| **Agent** | website-api-migration |
| **Priority** | P0 |
| **Depends on** | P0-003, P0-004 |
| **Files** | `src/app/api/health/profile/route.ts` (new), `src/app/api/health/symptoms/route.ts` (new) |
| **Spec** | **`POST /api/health/profile`**: Accepts `{ dateOfBirth?, sexAtBirth?, menopauseStatus?, heightCm?, weightKg?, chronicConditions?, currentMedications?, smokingStatus?, alcoholUnitsPerWeek?, exerciseMinutesPerWeek?, familyHistory? }`. Creates or updates health profile for authenticated user. Returns profile. Auth: `google` tier. **`GET /api/health/profile`**: Returns the authenticated user's health profile. **`POST /api/health/symptoms`**: Accepts `{ date, symptomType, severity, duration?, frequency?, triggers?, reliefFactors?, impactOnDaily?, notes? }`. Creates symptom journal entry. Returns entry. **`GET /api/health/symptoms?from={date}&to={date}`**: Returns symptom journal entries for date range. |
| **Acceptance** | `curl -X POST localhost:3000/api/health/profile -H 'Cookie: ...' -d '{...}'` creates/returns profile. Symptoms endpoint logs and retrieves entries. |

### P0-006: Daily Symptom Form UI component

| Field | Value |
|-------|-------|
| **Agent** | website-mui-migration |
| **Priority** | P0 |
| **Depends on** | P0-005 |
| **Files** | `src/components/health/daily-symptom-form.tsx` (new) |
| **Spec** | MUI form component with: date picker (defaults to today), symptom type dropdown (15 SymptomType options with friendly labels e.g. "Hot Flush", "Night Sweat", "Sleep Disturbance"), severity slider (0-10 with emoji labels: 😊 0 → 😰 10), duration input (minutes, for hot flushes), frequency input (count per day), triggers multi-select (stress, spicy food, alcohol, caffeine, heat, exercise, none), relief factors textarea, impact on daily activities slider (0-10), notes textarea. Submit button calls `POST /api/health/symptoms`. Shows success snackbar. |
| **Acceptance** | User can log a complete symptom entry with all fields; data persists via API |

### P0-007: Health Dashboard page

| Field | Value |
|-------|-------|
| **Agent** | website-dynamic-ui-migration |
| **Priority** | P0 |
| **Depends on** | P0-006 |
| **Files** | `src/app/(app)/health-dashboard/page.tsx` (new) |
| **Spec** | Renders the `health-dashboard` page from `PAGE_CATALOG`. Layout: top section shows `health_metrics_cards` (placeholder for now — shows "Connect Apple Health to see metrics"), middle section renders `symptom_timeline` component showing last 30 days of symptoms as a horizontal scrollable timeline, bottom section shows `ai_insights_panel` with placeholder text "Start logging symptoms to unlock AI insights." Uses `AuthGate` wrapper with requiredTier="google". |
| **Acceptance** | Navigating to `/health-dashboard` shows the page with symptom timeline |

### P0-008: Seed health education content

| Field | Value |
|-------|-------|
| **Agent** | website-db-migration |
| **Priority** | P0 |
| **Depends on** | P0-002 |
| **Files** | `scripts/seed-health-education.ts` (new) |
| **Spec** | Creates a seed script that populates `health_education` table with 15-20 menopause education articles. Each entry has: title, category (menopause/mental_health/bone_health), content (2-3 paragraphs of educational text), summary, source ("jean_hailes"), language ("en"), readingLevel ("standard"), tags, url. Also creates corresponding `knowledge_snippets` entries for the chatbot. Topics must include: understanding perimenopause, managing hot flushes, MHT explained, sleep and menopause, mood changes, bone health, vaginal health, brain fog, nutrition, exercise, talking to your GP, menopause at work, premature menopause, non-hormonal treatments, sexual health. |
| **Acceptance** | `bun run seed-health-education` populates 15+ articles in `health_education` table |

### P0-009: Patient-mode chatbot with health knowledge

| Field | Value |
|-------|-------|
| **Agent** | website-api-migration |
| **Priority** | P0 |
| **Depends on** | P0-008 |
| **Files** | `src/app/api/chat/route.ts` (modify — add health mode) |
| **Spec** | Extend existing chat API to support `mode: 'health-patient'`. When mode is health-patient: system prompt includes content from `knowledge_snippets` where category matches health topics, plus a preamble: "You are ManaposeGP Health Assistant — an educational resource about women's health and menopause. You provide evidence-based information from Jean Hailes for Women's Health and the Australasian Menopause Society. You NEVER diagnose, prescribe, or replace medical advice. Always encourage users to discuss concerns with their GP. If a user describes urgent symptoms (postmenopausal bleeding, chest pain, severe depression), advise immediate medical attention." Uses existing `KnowledgeSnippet` table for context retrieval. |
| **Acceptance** | Chatting about menopause returns educational responses citing Jean Hailes/AMS sources. Asking for a diagnosis triggers safety guardrail. |

### P0-010: Phase 0 gate — type-check, lint, seed validation

| Field | Value |
|-------|-------|
| **Agent** | BuildAgent |
| **Priority** | P0 |
| **Depends on** | P0-001 → P0-009 |
| **Files** | All files from P0-001 through P0-009 |
| **Spec** | Run `bun run type-check`, `bun run lint`, and `bun run seed-health-education --dry-run`. Validate: type-check passes (no new errors beyond pre-existing 21), lint passes, seed can find health education content. |
| **Acceptance** | `bun run type-check` passes with ≤21 errors (all pre-existing). Seed `--dry-run` outputs article counts. |

---

## Phase 1: Intelligence (Tasks P1-001 → P1-010)

### P1-001: Health Metrics Sync API

| Field | Value |
|-------|-------|
| **Agent** | CoderAgent |
| **Priority** | P1 |
| **Depends on** | P0-010 |
| **Files** | `src/domain/health/health-metrics-service.ts` (new), `src/app/api/health/metrics/sync/route.ts` (new) |
| **Spec** | Domain service `syncHealthMetrics(profileId, metrics: Array<{ metricType, value, unit?, source?, sourceDevice?, recordedAt }>)`. Upserts metrics by (profileId, metricType, recordedAt). Deduplicates by timestamp. API route `POST /api/health/metrics/sync` accepts batch of up to 100 metrics. Validates metricType against allowed list. Returns `{ synced: number, duplicates: number }`. |
| **Acceptance** | Batch of 50 sleep metrics syncs in <2 seconds. Duplicate timestamps are ignored. |

### P1-002: Health Metrics Query API

| Field | Value |
|-------|-------|
| **Agent** | CoderAgent |
| **Priority** | P1 |
| **Depends on** | P1-001 |
| **Files** | `src/app/api/health/metrics/route.ts` (new) |
| **Spec** | `GET /api/health/metrics?type=heart_rate&from=2026-06-01&to=2026-07-01`. Returns metrics array filtered by type and date range. Supports `type` param that can be comma-separated. Returns `{ metrics: [{ metricType, value, unit, source, recordedAt }], dailyAverages: { date: avg } }`. |
| **Acceptance** | Querying heart rate returns time-series data with daily averages |

### P1-003: HealthKit Integration Library

| Field | Value |
|-------|-------|
| **Agent** | CoderAgent |
| **Priority** | P1 |
| **Depends on** | P0-010 |
| **Files** | `src/lib/health/healthkit.ts` (new) |
| **Spec** | Client-side library (can't use native HealthKit in Next.js server — this is a bridge specification layer). Defines TypeScript interfaces for HealthKit data: `HealthKitMetric { type, value, unit, startDate, endDate, source, device }`. Export constants for supported metric types: `HEART_RATE`, `SLEEP_ANALYSIS`, `WRIST_TEMPERATURE`, `BODY_TEMPERATURE`, `STEP_COUNT`, `RESTING_HEART_RATE`, `HRV`, `MENSTRUAL_FLOW`, `WEIGHT`, `BLOOD_PRESSURE`. Export function `mapHealthKitToMetrics(healthkitData: HealthKitMetric[]): SyncMetric[]` that converts HealthKit format to API format. Export function `getMetricDisplayName(type: string): string` for UI labels. |
| **Acceptance** | `import { SUPPORTED_METRICS, mapHealthKitToMetrics } from '@/lib/health/healthkit'` exports correctly typed constants |

### P1-004: Health Metrics Cards UI

| Field | Value |
|-------|-------|
| **Agent** | website-mui-migration |
| **Priority** | P1 |
| **Depends on** | P1-002 |
| **Files** | `src/components/health/health-metrics-cards.tsx` (new) |
| **Spec** | MUI card grid component (3 columns on desktop, 1 on mobile). Each card shows: metric name (e.g., "🫀 Resting Heart Rate"), current value with unit, trend arrow (↑ ↓ →), sparkline chart (last 7 days, recharts `LineChart`). Fetches data from `GET /api/health/metrics`. Cards: Heart Rate, Sleep Duration, Wrist Temperature, Daily Steps, HRV. Empty state: "No data yet — connect Apple Health to see your metrics" with link to sync. Loading state: skeleton cards. Error state: retry button. |
| **Acceptance** | Component renders 5 metric cards. Each fetches real or shows empty state. Responsive 3-column → 1-column. |

### P1-005: AI Health Insights Engine

| Field | Value |
|-------|-------|
| **Agent** | CoderAgent |
| **Priority** | P1 |
| **Depends on** | P1-001, P0-004 |
| **Files** | `src/domain/health/health-insight-engine.ts` (new), `src/app/api/health/insights/route.ts` (new) |
| **Spec** | Domain service `generateInsights(profileId)` that: 1) Fetches last 30 days of symptoms + health metrics 2) Builds a data summary (sleep trends, HRV trends, symptom frequency changes, temperature patterns) 3) Sends to GPT-4o with prompt: "You are a health data analyst. Analyze this menopause symptom and health metric data. Identify correlations between sleep quality and symptom severity, HRV trends and hot flush frequency, temperature patterns. Provide 3-5 concrete, actionable insights. Use plain language. Never diagnose. Format as markdown bullets." 4) Returns insights array. API route `GET /api/health/insights` returns `{ insights: string[], dataSummary: {...}, generatedAt: string }`. Caches for 24 hours per profile. |
| **Acceptance** | Returns 3-5 insights about sleep↔symptom correlation, HRV trends, etc. |

### P1-006: AI Insights Panel UI + Symptom Timeline

| Field | Value |
|-------|-------|
| **Agent** | website-mui-migration |
| **Priority** | P1 |
| **Depends on** | P1-005 |
| **Files** | `src/components/health/ai-insights-panel.tsx` (new), `src/components/health/symptom-timeline.tsx` (new) |
| **Spec** | **AI Insights Panel**: MUI Paper component showing insights as cards with icon per insight (💤 sleep, 📊 trends, 🌡️ temperature, 🏃 activity). Each insight card has title, description, and "Learn more" link to relevant health education article. Loading skeleton. Empty state: "Log symptoms for 7+ days to unlock AI insights." **Symptom Timeline**: Horizontal scrollable calendar-like component. Each day shows a colored dot based on max severity (green 0-3, yellow 4-6, red 7-10). Clicking a day shows tooltip with symptom list and severities. Legend at bottom. Last 30 days by default, toggleable to 90 days. |
| **Acceptance** | Timeline shows colored dots. Insights panel shows 3-5 cards. Clicking an insight links to education. |

### P1-007: GP Consultation Prep Generator

| Field | Value |
|-------|-------|
| **Agent** | CoderAgent |
| **Priority** | P1 |
| **Depends on** | P0-004, P1-002 |
| **Files** | `src/domain/health/gp-prep-service.ts` (new), `src/app/api/health/export/summary/route.ts` (new) |
| **Spec** | Domain service `generateGpSummary(profileId)` that: 1) Collects: health profile demographics, symptom journal last 90 days (aggregated: average severity per type, trend direction, most frequent symptom, worst symptom), health metrics last 30 days (sleep average, HR average, temperature range), current medications, chronic conditions, family history 2) Generates GPT-4o structured summary in SOAP format: Subjective (patient-reported symptoms and concerns), Objective (metrics, lab results), Assessment (AI suggests possible focus areas — always prefixed "Consider discussing with patient:"), Plan (blank section for GP to fill). API route returns JSON + PDF option. PDF uses existing Puppeteer setup. |
| **Acceptance** | Returns structured SOAP-format summary with symptom trends and metrics. PDF exports correctly. |

### P1-008: GP Prep Checklist UI

| Field | Value |
|-------|-------|
| **Agent** | website-mui-migration |
| **Priority** | P1 |
| **Depends on** | P1-007 |
| **Files** | `src/components/health/consultation-checklist.tsx` (new), `src/components/health/gp-summary-generator.tsx` (new) |
| **Spec** | **Consultation Checklist**: MUI checklist component with items: "□ Tracked symptoms for 30+ days", "□ Completed symptom severity log", "□ Noted top 3 concerns for GP", "□ Listed current medications", "□ Recorded family history", "□ Prepared questions for GP". Each item has a check mark based on data completeness. Progress bar at top (X/6 complete). **GP Summary Generator**: Button "Generate GP Summary" → loading state → displays summary preview with sections: Demographics, Symptom Summary, Health Metrics, Current Medications, Questions to Ask. "Download PDF" and "Copy to Clipboard" buttons. |
| **Acceptance** | Checklist shows completion progress. Generate button produces summary. PDF downloads. |

### P1-009: Clinical Guidelines Ingestion + RAG Search

| Field | Value |
|-------|-------|
| **Agent** | CoderAgent |
| **Priority** | P1 |
| **Depends on** | P0-010 |
| **Files** | `scripts/ingest-guidelines.ts` (new), `src/domain/health/clinical-guideline-service.ts` (new), `src/app/api/gp/guidelines/route.ts` (new) |
| **Spec** | **Ingestion script**: Reads guidelines from a local `data/guidelines/` directory. Parses MD files with frontmatter (source, title, category, url, keywords). Creates embeddings via OpenAI `text-embedding-3-small` (1536-dim). Stores in `clinical_guidelines` table with pgvector. **Domain service**: `searchGuidelines(query: string, topK: number = 5)` — embeds query, performs cosine similarity search via pgvector, returns top matches with source citation. **API route**: `GET /api/gp/guidelines?query=MHT+dosing+52+year+old` → returns `{ results: [{ title, source, category, content, url, similarity }] }`. Auth: `pin` tier. |
| **Acceptance** | Searching "MHT contraindications" returns relevant AMS/RACGP guideline excerpts with sources |

### P1-010: Phase 1 Gate

| Field | Value |
|-------|-------|
| **Agent** | BuildAgent |
| **Priority** | P1 |
| **Depends on** | P1-001 → P1-009 |
| **Spec** | Run `bun run type-check`, `bun run lint`, `bun run test`. Validate: type-check ≤21 pre-existing errors, lint passes, all new tests pass. Run seed scripts. Verify: health metrics sync works, insights engine returns results, GP summary generates, guideline search returns results. |
| **Acceptance** | Full P0+P1 integration test passes: create profile → log symptoms → sync metrics → get insights → generate GP summary |

---

## Phase 2: Clinical Tools (Tasks P2-001 → P2-010)

### P2-001: Medication Tracking Service + API

| Field | Value |
|-------|-------|
| **Agent** | CoderAgent |
| **Priority** | P2 |
| **Depends on** | P1-010 |
| **Files** | `src/domain/health/medication-service.ts` (new), `src/app/api/health/medications/route.ts` (new) |
| **Spec** | Domain service: `addMedication(profileId, data)`, `getMedications(profileId)`, `updateMedicationStatus(id, status)`, `logAdherence(id, date)`. API: `POST /api/health/medications` (create), `GET /api/health/medications` (list), `PATCH /api/health/medications/{id}` (update status/adherence). Supports medication types: mht, supplement, prescription, otc. Routes: oral, transdermal, vaginal, injection, implant. |
| **Acceptance** | Can add estradiol patch, view medication list, mark dose taken |

### P2-002: Patient Consent Management

| Field | Value |
|-------|-------|
| **Agent** | website-auth-migration |
| **Priority** | P2 |
| **Depends on** | P1-010 |
| **Files** | `src/domain/health/consent-service.ts` (new), `src/app/api/health/consent/route.ts` (new) |
| **Spec** | `POST /api/health/consent` — Patient grants GP access. Body: `{ gpId, consentType: 'full_access'|'summary_only'|'symptom_data'|'metrics_data'|'medication_data', expiresAt? }`. Creates `PatientConsent` with status PENDING. `GET /api/health/consent` — Lists patient's active consents. `PATCH /api/health/consent/{id}` — GP can accept (status=ACTIVE) or patient can revoke (status=REVOKED). Consent guard middleware: `requirePatientConsent(gpId, profileId, requiredType)` checks active consent before data access. |
| **Acceptance** | Patient can grant consent, GP can accept, consent is checked on data access |

### P2-003: GP Patient Dashboard

| Field | Value |
|-------|-------|
| **Agent** | website-api-migration |
| **Priority** | P2 |
| **Depends on** | P2-002 |
| **Files** | `src/app/api/gp/patients/route.ts` (new), `src/app/api/gp/patients/[id]/dashboard/route.ts` (new) |
| **Spec** | `GET /api/gp/patients` — Returns list of patients with active consents for this GP. Returns: `[{ profileId, patientName?, menopauseStatus, lastSymptomDate, consentType, nextFollowUp? }]`. `GET /api/gp/patients/{id}/dashboard` — Returns full patient dashboard data: demographics, symptom trends (30d), health metrics summary, current medications, recent lab results, last consultation summary, AI-generated insights. All gated by consent check. |
| **Acceptance** | GP can see consented patient list, click into full dashboard with all health data |

### P2-004: GP Clinical Support Chat

| Field | Value |
|-------|-------|
| **Agent** | website-api-migration |
| **Priority** | P2 |
| **Depends on** | P1-009 |
| **Files** | `src/app/api/gp/chat/route.ts` (new) |
| **Spec** | Extends existing chat SSE streaming to support `mode: 'gp-clinical'`. System prompt: "You are ManaposeGP Clinical Assistant — an evidence-based decision support tool for Australian GPs. You provide information from RACGP guidelines, AMS information sheets, Therapeutic Guidelines (eTG), and Jean Hailes for Women's Health. Always cite specific sources. Provide drug interaction information but always recommend checking the TGA ARTG and consulting the patient's full medication history. For treatment decisions, present evidence-based options with confidence levels (Strong/Moderate/Emerging). Never make the final clinical decision — that remains the GP's responsibility." Context: injects top-3 guideline search results for each query automatically. Available function calls: `searchGuidelines(query)`, `checkDrugInteraction(medications)`, `calculateRiskScore(model, patientData)`. |
| **Acceptance** | GP asks "MHT options for 52yo with intact uterus and migraine history" → returns evidence-based options with AMS/RACGP citations |

### P2-005: SOAP Note Generator

| Field | Value |
|-------|-------|
| **Agent** | CoderAgent |
| **Priority** | P2 |
| **Depends on** | P2-003 |
| **Files** | `src/domain/health/consultation-service.ts` (new), `src/app/api/gp/consultations/route.ts` (new) |
| **Spec** | `POST /api/gp/consultations` — Creates consultation record. Body: `{ patientId, date, consultationType, duration?, treatmentPlan?, prescriptions?, referrals?, followUp?, mbsItems?, notes? }`. If `aiGenerated: true`, uses GPT-4o to fill SOAP fields from patient data + notes. Domain service `generateSOAPNote(patientId, gpNotes, consultationData)` returns: Subjective (pulled from symptom journal + patient concerns), Objective (pulled from health metrics + lab results), Assessment (AI-generated — cites relevant guidelines, note: "AI-assisted assessment — requires GP review"), Plan (populated from GP's treatment plan input). `GET /api/gp/consultations?patientId={id}` returns consultation history. |
| **Acceptance** | GP enters consult notes, clicks "Generate SOAP" → full SOAP note populated. Can edit before saving. |

### P2-006: Clinical Risk Calculator

| Field | Value |
|-------|-------|
| **Agent** | CoderAgent |
| **Priority** | P2 |
| **Depends on** | P2-001 |
| **Files** | `src/lib/health/clinical-scoring.ts` (new), `src/app/api/gp/risk-calculator/route.ts` (new) |
| **Spec** | Library `clinical-scoring.ts` with functions: `calculateFRAX(age, sex, weight, height, previousFracture, parentHipFracture, currentSmoking, glucocorticoids, rheumatoidArthritis, secondaryOsteoporosis, alcohol3PerDay, femoralNeckBMD?)` → `{ tenYearMajorOsteoporotic, tenYearHipFracture, riskCategory }`. `calculateQRISK3(age, sex, ethnicity, smoking, diabetes, familyHistoryCVD, chronicKidneyDisease, atrialFibrillation, bloodPressureTreatment, migraine, rheumatoidArthritis, systemicLupus, severeMentalIllness, atypicalAntipsychotics, corticosteroids, bmi, systolicBP, totalCholesterol, hdlCholesterol)` → `{ qriskScore, riskCategory, heartAge }`. `calculateGailModel(age, ageAtMenarche, ageAtFirstBirth, firstDegreeRelatives, previousBiopsies, atypicalHyperplasia, race)` → `{ fiveYearRisk, lifetimeRisk, riskCategory }`. API route `POST /api/gp/risk-calculator` accepts `{ model: 'frax'|'qrisk3'|'gail', patientData: {...} }`. Returns calculated risk.
| **Acceptance** | FRAX calculation for 55yo postmenopausal woman returns accurate risk scores |

### P2-007: Drug Interaction Checker

| Field | Value |
|-------|-------|
| **Agent** | CoderAgent |
| **Priority** | P2 |
| **Depends on** | P2-001 |
| **Files** | `src/domain/health/drug-interaction-checker.ts` (new), `src/app/api/gp/drug-interactions/route.ts` (new) |
| **Spec** | Domain service `checkInteractions(medications: string[])`: Sends medication list to GPT-4o with prompt: "You are checking drug interactions for an Australian GP. The patient is taking these medications: [list]. Identify potential interactions, classify severity (Contraindicated / Major / Moderate / Minor / Theoretical), provide mechanism, clinical consequences, and management recommendations. Reference TGA and AMS guidelines where relevant. Focus on MHT interactions." API `POST /api/gp/drug-interactions` returns `{ interactions: [{ pair: [drugA, drugB], severity, mechanism, recommendation, source }], noInteractionsFound: boolean }`. |
| **Acceptance** | Querying "estradiol + venlafaxine" returns interaction info. "estradiol + paracetamol" returns no interactions. |

### P2-008: Mental Health Screening

| Field | Value |
|-------|-------|
| **Agent** | CoderAgent |
| **Priority** | P2 |
| **Depends on** | P1-010 |
| **Files** | `src/lib/health/screening-tools.ts` (new), `src/domain/health/screening-service.ts` (new), `src/app/api/health/screening/route.ts` (new) |
| **Spec** | Library `screening-tools.ts`: `scoreK10(responses: number[])` returns `{ score, interpretation, severity }`. `scorePHQ9(responses)` returns `{ score, depressionSeverity, suicideRiskFlag }`. `scoreGAD7(responses)` returns `{ score, anxietySeverity }`. `scoreMRS(responses)` returns `{ score, menopauseSymptomSeverity }`. API `POST /api/health/screening` accepts `{ screeningType, responses: number[] }`. Returns scored result. `GET /api/health/screening?type={type}` returns screening history. Flags: if PHQ-9 item 9 > 0 → suicide risk alert. If score is severe → recommend urgent GP review. |
| **Acceptance** | Patient completes K10 → returns score + interpretation. PHQ-9 item 9 triggers alert. |

### P2-009: GP Clinical Dashboard UI Components

| Field | Value |
|-------|-------|
| **Agent** | BatchExecutor |
| **Priority** | P2 |
| **Depends on** | P2-003, P2-004, P2-005, P2-006, P2-007 |
| **Files** | `src/components/health/patient-list.tsx` (new), `src/components/health/clinical-alerts.tsx` (new), `src/components/health/guideline-browser.tsx` (new), `src/components/health/drug-interaction-checker.tsx` (new), `src/components/health/risk-calculator.tsx` (new), `src/components/health/soap-note-generator.tsx` (new) |
| **Spec** | Batch of component implementations delegated to BatchExecutor (4+ parallel CoderAgents). Each component spec: MUI, responsive, loading/empty/error states, RTK Query for data fetching, accessible. |
| **Acceptance** | All 6 components render, fetch data from APIs, handle states correctly |

### P2-010: Phase 2 Gate

| Field | Value |
|-------|-------|
| **Agent** | BuildAgent + CodeReviewer |
| **Priority** | P2 |
| **Depends on** | P2-001 → P2-009 |
| **Spec** | `bun run type-check && bun run lint && bun run test`. Full integration: GP logs in → sees patient list → clicks patient → views dashboard → queries guidelines → checks drug interactions → creates consultation with SOAP → saves record. |
| **Acceptance** | Complete GP workflow tested end-to-end |

---

## Phase 3: Ecosystem (Tasks P3-001 → P3-010)

### P3-001: Referral Letter Generator

| Field | Value |
|-------|-------|
| **Agent** | CoderAgent |
| **Priority** | P3 |
| **Depends on** | P2-010 |
| **Files** | `src/domain/health/referral-generator.ts` (new), `src/app/api/gp/referral-letter/route.ts` (new) |
| **Spec** | `POST /api/gp/referral-letter` — Accepts `{ patientId, specialistType, urgency, reasonForReferral, additionalNotes? }`. Uses GPT-4o + patient data to generate structured referral letter: Referring GP details, Patient demographics + key history, Reason for referral, Relevant clinical findings (symptoms, metrics, lab results), Current medications, Relevant family history, Urgency, Enclosures (symptom summary, lab results). Returns markdown. PDF export via existing Puppeteer. Australian-standard referral format. |
| **Acceptance** | GP clicks "Generate Referral" → populated letter → can edit → download PDF |

### P3-002: Evidence Digest Service

| Field | Value |
|-------|-------|
| **Agent** | CoderAgent |
| **Priority** | P3 |
| **Depends on** | P2-010 |
| **Files** | `src/domain/health/evidence-digest-service.ts` (new), `scripts/weekly-evidence-digest.ts` (new), `src/app/api/gp/evidence-digest/route.ts` (new) |
| **Spec** | Weekly cron (manual or Vercel Cron): `scripts/weekly-evidence-digest.ts` queries PubMed E-utilities for `(menopause OR perimenopause OR "menopausal hormone therapy") AND ("2025"[PDAT] OR "2026"[PDAT])` filtered to RCTs, meta-analyses, systematic reviews. Fetches abstracts for top 20 results. GPT-4o summarizes each with: title, journal, key findings, clinical implications, evidence strength. Stores in `medical_references` table. API `GET /api/gp/evidence-digest` returns latest digest. GP can mark articles as "read" or "save for later". |
| **Acceptance** | Running the script populates 15-20 summarized articles. GP sees digest in UI. |

### P3-003: Health Education Library UI

| Field | Value |
|-------|-------|
| **Agent** | website-mui-migration |
| **Priority** | P3 |
| **Depends on** | P0-008 |
| **Files** | `src/components/health/health-education-library.tsx` (new), `src/app/(app)/health-education/page.tsx` (new) |
| **Spec** | MUI component showing browsable health education library. Left sidebar: category filters (menopause, mental_health, bone_health, cardiovascular, sexual_health, nutrition, exercise, sleep). Main content: card grid showing articles with title, summary, category badge, reading time estimate. Search bar at top. Click card → expands to show full article content. "Was this helpful?" thumbs up/down at bottom. Related articles section. Public access (no auth required for browsing, but personalization requires login). |
| **Acceptance** | Public can browse 15+ health articles, search, filter by category |

### P3-004: Clinical Alerts System

| Field | Value |
|-------|-------|
| **Agent** | CoderAgent |
| **Priority** | P3 |
| **Depends on** | P1-005, P2-003 |
| **Files** | `src/domain/health/clinical-alert-service.ts` (new), `src/app/api/gp/patients/[id]/alerts/route.ts` (new) |
| **Spec** | Alert detection rules: 1) Sleep duration drop >20% over 7 days 2) HRV decline >15% over 14 days 3) Symptom severity increase >3 points (weekly avg) 4) Wrist temperature sustained elevation >0.5°C for 5+ days 5) 3+ consecutive days with severity 8+ symptoms 6) PHQ-9 score >15 7) No symptom journal entries for 10+ days (disengagement). Alerts stored with type, severity (info/warning/critical), message, triggered_at. API returns active alerts. Patient dashboard shows alerts. GP dashboard shows alerts for consented patients. Push notification integration (P3). |
| **Acceptance** | Patient with 4 days of 8+ severity hot flushes triggers critical alert. GP sees alert on dashboard. |

### P3-005: MBS Billing Assistant

| Field | Value |
|-------|-------|
| **Agent** | CoderAgent |
| **Priority** | P3 |
| **Depends on** | P2-005 |
| **Files** | `src/domain/health/mbs-assistant.ts` (new), part of consultation service |
| **Spec** | GPT-4o function that suggests MBS item numbers based on consultation type, duration, and complexity. Knowledge base: common menopause-related MBS items (Level B 23, Level C 36, Level D 44, health assessment 701/703/705/707, mental health care plan 2700/2701). Returns `{ suggestedItems: [{ itemNumber, description, fee }], notes: string }`. Integrated into SOAP Note Generator as optional "Suggest MBS Items" button. |
| **Acceptance** | GP completes 30-min menopause consult → suggests Level C (36) with mental health plan (2700) |

### P3-006: Population Health Analytics (GP Dashboard)

| Field | Value |
|-------|-------|
| **Agent** | CoderAgent |
| **Priority** | P3 |
| **Depends on** | P2-003 |
| **Files** | `src/domain/health/population-analytics.ts` (new), integrated into GP dashboard |
| **Spec** | Aggregated analytics across GP's consented patient panel: 1) Menopause status distribution (pie chart) 2) Average symptom severity by type (bar chart) 3) MHT prescription rate 4) Mental health screening prevalence 5) Average time from first symptom log to GP consultation 6) Patient engagement rate (% logging >3x/week). De-identified, aggregate only (no individual patient data in analytics). Updates daily via cron or on-demand. |
| **Acceptance** | GP sees practice-level analytics: "65% of your menopause patients are on MHT, 30% have completed PHQ-9 screening" |

### P3-007: Referral + GP Dashboard UI Components

| Field | Value |
|-------|-------|
| **Agent** | website-mui-migration |
| **Priority** | P3 |
| **Depends on** | P3-001, P3-002, P3-004 |
| **Files** | `src/components/health/referral-letter-generator.tsx` (new), GP dashboard update |
| **Spec** | Referral generator UI: dropdown for specialist type (gynaecologist, endocrinologist, psychiatrist, physiotherapist, dietitian), urgency selector (routine/semi-urgent/urgent), reason textarea. Preview panel showing generated letter. Edit mode. Download PDF button. Evidence digest widget on GP dashboard sidebar showing latest 3 digests. |
| **Acceptance** | Referral letter generates, edits, downloads. Evidence digest widget shows latest research. |

### P3-008: Full Build + Integration Testing

| Field | Value |
|-------|-------|
| **Agent** | BuildAgent |
| **Priority** | P3 |
| **Depends on** | P3-001 → P3-007 |
| **Spec** | `bun run build` — full production build. Run: `bun run type-check`, `bun run lint`, `bun run test`, `bun run enforce:redux`. Validate: new Redux slices follow conventions, all components have loading/empty/error states, all API routes have auth guards, seed scripts run successfully. |
| **Acceptance** | Production build succeeds. All tests pass. Full workflow demoable. |

### P3-009: Security Review + Deployment

| Field | Value |
|-------|-------|
| **Agent** | CodeReviewer + website-deployment-migration |
| **Priority** | P3 |
| **Depends on** | P3-008 |
| **Spec** | CodeReviewer: audit all healthcare API routes for auth enforcement, consent checks, data isolation. website-deployment-migration: configure Vercel env vars (add NEXT_PUBLIC_APP_URL, verify POSTGRES_URL, OPENAI_API_KEY), deploy to Vercel, verify health endpoints respond correctly. |
| **Acceptance** | Security review passes. Vercel deployment live. Health API endpoints respond. |

### P3-010: Documentation Finalization

| Field | Value |
|-------|-------|
| **Agent** | DocWriter |
| **Priority** | P3 |
| **Depends on** | P3-009 |
| **Files** | `docs/API_REFERENCE.md` (new), `docs/DEPLOYMENT.md` (update) |
| **Spec** | Document all healthcare API routes with request/response schemas. Deployment guide with Vercel configuration. GDPR/privacy compliance documentation. User guide for patients and GPs. |
| **Acceptance** | Complete API reference, deployment guide, and user documentation. |

---

## Execution Order

```
P0-001 (pgvector + migrate) ──────────────────────────────────────────────────┐
P0-002 (zen:generate) ────────────────────────────────────────────────────┐   │
P0-003 (health-profile service) ──────────────────────────────────────┐   │   │
P0-004 (symptom service) ─────────────────────────────────────────┐   │   │   │
P0-005 (health API routes) ───────────────────────────────────┐   │   │   │   │
P0-006 (symptom form UI) ─────────────────────────────────┐   │   │   │   │   │
P0-007 (health dashboard page) ───────────────────────┐   │   │   │   │   │   │
P0-008 (seed education) ──────────────────────────┐   │   │   │   │   │   │   │
P0-009 (patient chatbot) ─────────────────────┐   │   │   │   │   │   │   │   │
P0-010 (gate) ───────────────────────────┐    │   │   │   │   │   │   │   │   │
                                         │    │   │   │   │   │   │   │   │   │
P1-001 (metrics sync) ───────────────┐   │    │   │   │   │   │   │   │   │   │
P1-002 (metrics query) ──────────┐   │   │    │   │   │   │   │   │   │   │   │
P1-003 (healthkit lib) ──────┐   │   │   │    │   │   │   │   │   │   │   │   │
P1-004 (metrics cards) ──┐   │   │   │   │    │   │   │   │   │   │   │   │   │
P1-005 (AI insights) ─┐  │   │   │   │   │    │   │   │   │   │   │   │   │   │
P1-006 (insights UI) ─┤  │   │   │   │   │    │   │   │   │   │   │   │   │   │
P1-007 (GP prep) ─────┤  │   │   │   │   │    │   │   │   │   │   │   │   │   │
P1-008 (GP prep UI) ──┤  │   │   │   │   │    │   │   │   │   │   │   │   │   │
P1-009 (guidelines) ──┤  │   │   │   │   │    │   │   │   │   │   │   │   │   │
P1-010 (gate) ────────┘  │   │   │   │   │    │   │   │   │   │   │   │   │   │
                         │   │   │   │   │    │   │   │   │   │   │   │   │   │
P2-001 (medications) ────┤   │   │   │   │    │   │   │   │   │   │   │   │   │
P2-002 (consent) ────────┤   │   │   │   │    │   │   │   │   │   │   │   │   │
P2-003 (GP dashboard) ───┤   │   │   │   │    │   │   │   │   │   │   │   │   │
P2-004 (GP chat) ────────┤   │   │   │   │    │   │   │   │   │   │   │   │   │
P2-005 (SOAP notes) ─────┤   │   │   │   │    │   │   │   │   │   │   │   │   │
P2-006 (risk calc) ──────┤   │   │   │   │    │   │   │   │   │   │   │   │   │
P2-007 (drug check) ─────┤   │   │   │   │    │   │   │   │   │   │   │   │   │
P2-008 (screening) ──────┤   │   │   │   │    │   │   │   │   │   │   │   │   │
P2-009 (GP UI batch) ────┤   │   │   │   │    │   │   │   │   │   │   │   │   │
P2-010 (gate) ───────────┘   │   │   │   │    │   │   │   │   │   │   │   │   │
                             │   │   │   │    │   │   │   │   │   │   │   │   │
P3-001 (referral) ──────────┤   │   │   │    │   │   │   │   │   │   │   │   │
P3-002 (evidence digest) ───┤   │   │   │    │   │   │   │   │   │   │   │   │
P3-003 (education UI) ──────┤   │   │   │    │   │   │   │   │   │   │   │   │
P3-004 (alerts) ────────────┤   │   │   │    │   │   │   │   │   │   │   │   │
P3-005 (MBS) ───────────────┤   │   │   │    │   │   │   │   │   │   │   │   │
P3-006 (analytics) ─────────┤   │   │   │    │   │   │   │   │   │   │   │   │
P3-007 (referral UI) ───────┤   │   │   │    │   │   │   │   │   │   │   │   │
P3-008 (full build) ────────┤   │   │   │    │   │   │   │   │   │   │   │   │
P3-009 (security+deploy) ───┤   │   │   │    │   │   │   │   │   │   │   │   │
P3-010 (docs) ──────────────┘   │   │   │    │   │   │   │   │   │   │   │   │
```

Task parallelism:
- P0-003, P0-004, P0-008 can run in parallel after P0-002
- P0-006, P0-007 can run in parallel after P0-005
- P1-001, P1-003 can run in parallel
- P1-004, P1-006, P1-008 can run in parallel after their service dependencies
- P2-001, P2-002, P2-008 can run in parallel after P1-010
- P2-003, P2-004, P2-006, P2-007 can run in parallel
- P2-009 uses BatchExecutor for 4+ parallel component builds
- P3-001, P3-002, P3-004, P3-005, P3-006 can run in parallel after P2-010
