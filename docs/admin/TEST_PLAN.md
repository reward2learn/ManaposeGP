# Admin Feature Test Plan

Test coverage plan for ManaposeGP admin platform features. Run via `bun run test` (Vitest + RTL).

## Existing Tests

| File | What it covers |
|------|---------------|
| `src/app/api/auth/route.test.ts` | UC-AUTH-01 through UC-AUTH-04 (Google OAuth, PIN sign-in, session, logout) |
| `src/lib/auth/guards.test.ts` | Auth guard logic (requireSession, requireWriteAuth, requirePin, requireGoogle) |
| `src/lib/auth/session.test.ts` | JWT session creation/verification |
| `src/lib/auth/google-oauth.test.ts` | Google OAuth credential management, URL builder |
| `src/components/auth/auth-gate.test.tsx` | AuthGate component rendering |
| `src/components/auth/sign-in-panel.test.tsx` | SignInPanel gate UI |
| `src/store/auth-slice.test.ts` | Auth Redux slice state |
| `e2e/auth-tiers.spec.ts` | E2E Playwright tests for auth tier enforcement |

## New Tests Needed: Admin API Routes

### `src/app/api/admin/dashboard/route.test.ts`

| Test ID | Scenario | Expected |
|---------|----------|----------|
| DASH-01 | GET without session | 401 |
| DASH-02 | GET with public tier | 401 |
| DASH-03 | GET with pin tier, all tables exist | 200, stats object with correct shape |
| DASH-04 | GET with pin tier, one stat fails | 200, failing stat = 0, others correct (Promise.allSettled) |
| DASH-05 | OpenAI key in DB | openAiKeyConfigured = true |
| DASH-06 | OpenAI key only in env var | openAiKeyConfigured = true (env fallback) |
| DASH-07 | OpenAI key neither DB nor env | openAiKeyConfigured = false |
| DASH-08 | GP count includes pending | totalGps > 0, pendingGps = count of PENDING |

### `src/app/api/admin/gp-verification/route.test.ts`

| Test ID | Scenario | Expected |
|---------|----------|----------|
| GPV-01 | GET without session | 401 |
| GPV-02 | GET with pin tier | 200, gps array |
| GPV-03 | GET returns GPs with verification fields | Each GP has id, name, verified, verificationStatus |
| GPV-04 | GET when verification_status column missing | 200, COALESCE returns 'PENDING' as default |
| GPV-05 | PATCH approve GP | 200, GP verified=true, verificationStatus='APPROVED' |
| GPV-06 | PATCH reject GP | 200, GP verified=false, verificationStatus='REJECTED' |
| GPV-07 | PATCH with notes | 200, verificationNotes saved |
| GPV-08 | Activity logged on approve/reject | ActivityLog entry created |

### `src/app/api/admin/feature-flags/route.test.ts`

| Test ID | Scenario | Expected |
|---------|----------|----------|
| FF-01 | GET without session | 401 |
| FF-02 | GET with pin tier, table exists | 200, flags object |
| FF-03 | GET with pin tier, table missing | 200, empty flags {} (fallback) |
| FF-04 | PATCH toggle flag | 200, flag updated |
| FF-05 | PATCH when DDL fails | 200, returns toggled flags even if DB write failed |

### `src/app/api/config/settings/route.test.ts`

| Test ID | Scenario | Expected |
|---------|----------|----------|
| SET-01 | GET without session | 401 |
| SET-02 | PATCH with pin tier | 200, webSearchEnabled updated |
| SET-03 | PATCH with public tier | 401, descriptive error message |
| SET-04 | PATCH invalid body | 400, "webSearchEnabled boolean is required" |
| SET-05 | GET returns defaults when table missing | 200, webSearchEnabled=false |
| SET-06 | PATCH error returns proper message | 500, error.message in response |

### `src/app/api/config/openai-key/route.test.ts`

| Test ID | Scenario | Expected |
|---------|----------|----------|
| OK-01 | GET without session | 401 |
| OK-02 | GET with key in DB | 200, configured=true, source='db' |
| OK-03 | GET with key only in env | 200, configured=true, source='env' |
| OK-04 | GET no key anywhere | 200, configured=false, source=null |
| OK-05 | POST save key | 200, key encrypted in secrets table |
| OK-06 | POST key too short (< 20 chars) | 400, "API key is too short" |
| OK-07 | DELETE remove key | 200, key removed, falls back to env |

### `src/app/api/admin/crud/` (appointment-types, fee-schedule, providers, notification-templates, users)

| Test ID | Scenario | Expected |
|---------|----------|----------|
| CRUD-01 | GET without session | 401 |
| CRUD-02 | GET with pin tier | 200, data array |
| CRUD-03 | POST create new | 200, created entity returned |
| CRUD-04 | DELETE remove | 200, entity deleted |
| CRUD-05 | Table auto-created on first access | No "relation does not exist" error |
| CRUD-06 | Activity logged on mutations | ActivityLog entry created |

## New Tests Needed: Domain Services

### `src/domain/admin/activity-log-service.test.ts`

| Test ID | Scenario | Expected |
|---------|----------|----------|
| ALS-01 | getDashboardStats returns correct shape | Object with 6 keys |
| ALS-02 | getDashboardStats with Promise.allSettled | Individual failures don't crash |
| ALS-03 | getOpenAiKeyStatus used (not raw DB query) | Checks both DB and env |
| ALS-04 | logActivity best-effort | Never throws on DB failure |
| ALS-05 | getActivityLogs with action filter | Returns filtered logs |

### `src/domain/config/app-settings-service.test.ts`

| Test ID | Scenario | Expected |
|---------|----------|----------|
| ASS-01 | ensureAppSettingsTable creates table | Table exists after call |
| ASS-02 | ensureAppSettingsTable adds feature_flags | ALTER TABLE runs separately, no 42601 error |
| ASS-03 | getAppSettings returns defaults on first call | webSearchEnabled=false, id='default' |
| ASS-04 | updateAppSettings persists | webSearchEnabled=true saved |
| ASS-05 | DDL failures don't cascade | Each statement has own try/catch |

### `src/domain/health/gp-profile-service.test.ts`

| Test ID | Scenario | Expected |
|---------|----------|----------|
| GPS-01 | ensureGpProfileColumns adds columns | 3 separate ALTER TABLE calls, no multi-statement |
| GPS-02 | listGpsForVerification returns GPs | COALESCE handles missing verification_status |
| GPS-03 | listGps returns basic fields | Works without verification columns |
| GPS-04 | registerGp creates profile | Raw SQL INSERT with gen_random_uuid |

## New Tests Needed: Components

### `src/components/config/chat-settings-form.test.tsx`

| Test ID | Scenario | Expected |
|---------|----------|----------|
| CSF-01 | Renders with loading state | Shows CircularProgress |
| CSF-02 | Renders with webSearchEnabled=true | Switch checked |
| CSF-03 | Toggle triggers PATCH | RTK mutation called |
| CSF-04 | PATCH error shows server message | Error message from err.data.error displayed |
| CSF-05 | PATCH error fallback | "Could not update chat settings." if no data.error |

### `src/components/config/openai-key-form.test.tsx`

| Test ID | Scenario | Expected |
|---------|----------|----------|
| OKF-01 | Renders configured state | "Configured" chip, source label |
| OKF-02 | Renders unconfigured state | "Not configured" chip |
| OKF-03 | Save button disabled when input empty | Button disabled |
| OKF-04 | Save triggers POST | RTK mutation called with apiKey |
| OKF-05 | Remove button disabled when source != db | Button disabled for env source |
| OKF-06 | Remove triggers DELETE | RTK mutation called |

### `src/app/(app)/admin/page.test.tsx`

| Test ID | Scenario | Expected |
|---------|----------|----------|
| ADM-01 | Renders 5 stats cards | Total GPs, Patients, Appointments, Consultations, OpenAI Key |
| ADM-02 | Renders 10 quick-link cards | All sub-page links present |
| ADM-03 | Cards are clickable | onClick navigates to correct route |
| ADM-04 | Loading state shows skeletons | Skeleton variant="rounded" during fetch |
| ADM-05 | Error state shows zeros | All values 0 when fetch fails |
| ADM-06 | OpenAI card shows "Click to configure" when missing | Subtitle text correct |

## E2E Tests (Playwright)

### `e2e/admin-flows.spec.ts`

| Test ID | Scenario | Expected |
|---------|----------|----------|
| E2E-01 | Pin user lands on /admin | Dashboard renders with stats |
| E2E-02 | Navigate to GP Verification | GPs listed (or empty state) |
| E2E-03 | Approve a GP | Status changes, activity logged |
| E2E-04 | Navigate to AI Configuration | OpenAiKeyForm + ChatSettingsForm visible |
| E2E-05 | Save OpenAI key | Key saved, status updates to "Configured" |
| E2E-06 | Toggle feature flag | Flag toggles without 500 error |
| E2E-07 | Create appointment type | New type appears in table |
| E2E-08 | Settings PATCH succeeds | webSearchEnabled toggle works |
| E2E-09 | Google OAuth sign-in | Redirect URI matches Google Cloud Console |
| E2E-10 | Dashboard cards navigate correctly | Click card → correct sub-page loads |

## Non-Testable (Requires Production Environment)

| Area | Reason |
|------|--------|
| Neon Postgres ALTER TABLE permissions | Environment-specific; unit tests mock DB |
| Vercel serverless cold starts | E2E only |
| Google OAuth redirect_uri_mismatch | Requires Google Cloud Console registration |
| DDL multi-statement 42601 error | Tested via unit mock — actual behavior depends on Prisma/PostgreSQL version |
| Vercel deployment rate limits | Platform-level |
