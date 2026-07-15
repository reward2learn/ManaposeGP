# Admin CRUD Operations Skill

CRUD management for practice configuration entities: appointment types, fee schedule, provider directory, notification templates, and platform users.

## Tables and Routes

| Entity | Table | Route | Service Functions |
|--------|-------|-------|-------------------|
| Appointment Types | `appointment_types` | `/api/admin/appointment-types` | `getAppointmentTypes`, `upsertAppointmentType`, `deleteAppointmentType` |
| Fee Schedule | `fee_schedule_items` | `/api/admin/fee-schedule` | `getFeeSchedule`, `upsertFeeScheduleItem`, `deleteFeeScheduleItem` |
| Provider Directory | `provider_directory` | `/api/admin/providers` | `getProviders`, `upsertProvider`, `deleteProvider` |
| Notification Templates | `notification_templates` | `/api/admin/notification-templates` | `getNotificationTemplates`, `upsertNotificationTemplate` |
| Platform Users | `platform_users` | `/api/admin/users` | `getPlatformUsers`, `updateUser` |
| Activity Log | `activity_logs` | `/api/admin/activity-log` | `getActivityLogs` |

## Service File

- File: `src/domain/admin/admin-config-service.ts`
- All Prisma queries use ZenStack-enhanced client

## Required: `ensureAdminTables(db)` before queries

Every admin CRUD route MUST call `ensureAdminTables(db)` before any Prisma operation. This creates the tables if they don't exist (Neon Postgres may not have run migrations).

```typescript
import { ensureAdminTables } from '@/domain/admin/admin-config-service';

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ...
  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
  await ensureAdminTables(db);
  const data = await getAppointmentTypes(db);
  return NextResponse.json({ success: true, types: data });
}
```

## Activity Logging

All admin mutations log to `activity_logs` table:

```typescript
await logActivity(db, guard.session.sub, 'ACTION_TYPE', targetId, details);
```

- Best-effort (silently fails if audit write fails)
- File: `src/domain/admin/activity-log-service.ts`
- Actions: `VERIFY_GP_APPROVED`, `VERIFY_GP_REJECTED`, `UPDATE_SETTINGS`, `UPSERT_APPOINTMENT_TYPE`, etc.

## UI Pages

All under `src/app/(app)/admin/`:
- `gp-verification/page.tsx` — Approve/reject table with dialog
- `practice-settings/page.tsx` — Form with hours, timezone, billing
- `appointment-types/page.tsx` — CRUD table with color picker
- `fee-schedule/page.tsx` — MBS items with practice fees
- `providers/page.tsx` — Pathology/radiology directory
- `feature-flags/page.tsx` — Toggle switches
- `notification-templates/page.tsx` — Email/SMS templates
- `users/page.tsx` — User tier/role management
- `activity-log/page.tsx` — Audit trail with filters

All pages use `AuthGate requiredTier="pin"`.
