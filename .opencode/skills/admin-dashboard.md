# Admin Dashboard Skill

The `/admin` landing page shows aggregated stats and quick-link cards to all admin sub-pages.

## API: `GET /api/admin/dashboard`

- Guard: `requirePin`
- Returns: `{ success: true, stats: { totalGps, pendingGps, totalPatients, appointmentsToday, consultationsThisMonth, openAiKeyConfigured } }`
- File: `src/app/api/admin/dashboard/route.ts`

## Stats Aggregation: `getDashboardStats()`

- File: `src/domain/admin/activity-log-service.ts`
- Uses `Promise.allSettled` for resilience — one failing stat doesn't zero the entire dashboard
- OpenAI key status uses `getOpenAiKeyStatus()` from `lib/secrets.ts` — checks DB then env var fallback

```typescript
const results = await Promise.allSettled([
  db.gPProfile.count(),
  db.gPProfile.count({ where: { verificationStatus: 'PENDING' } }),
  db.healthProfile.count(),
  db.appointment.count({ where: { date: { gte: today }, status: { in: ['BOOKED', 'CONFIRMED'] } } }),
  db.gPConsultation.count({ where: { createdAt: { gte: monthStart } } }),
  getOpenAiKeyStatus(),
]);

const num = (result: PromiseSettledResult<unknown>, fallback = 0): number =>
  result.status === 'fulfilled' ? (result.value as number) : fallback;
```

## Dashboard UI

- File: `src/app/(app)/admin/page.tsx`
- Auth: `AuthGate requiredTier="pin"`
- 5 stats cards (clickable), 10 quick-link cards
- Stats cards link to relevant admin sub-pages:
  - Total GPs → `/admin/gp-verification`
  - Patients → `/admin/users`
  - Today's Appointments → `/admin/appointment-types`
  - Consultations (Month) → `/admin/feature-flags`
  - OpenAI Key → `/admin/ai-config`

## Dependencies

- `ensureAdminTables(db)` — creates missing tables
- `ensureGpProfileColumns(db)` — adds verification columns to `gp_profiles`
- Both called in route handler before `getDashboardStats(db)`
