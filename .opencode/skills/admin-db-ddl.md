# Admin Database DDL Skill

Ensures PostgreSQL tables exist before Prisma/ZenStack ORM queries touch them. Used when models were added to `schema.zmodel` but migrations never ran.

## Key Pattern

```typescript
// ALWAYS split multi-statement DDL into individual $executeRawUnsafe calls.
// PostgreSQL rejects multiple commands in a single prepared statement (code 42601).

await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS ...`);
await db.$executeRawUnsafe(`ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`);
```

## Files

| File | Purpose |
|------|---------|
| `src/domain/config/app-settings-service.ts` | `ensureAppSettingsTable(db)` — creates `app_settings` + adds `feature_flags` column |
| `src/domain/admin/admin-config-service.ts` | `ensureAdminTables(db)` — creates 6 tables (`practice_settings`, `appointment_types`, `fee_schedule_items`, `provider_directory`, `notification_templates`, `activity_logs`) |
| `src/domain/health/gp-profile-service.ts` | `ensureGpProfileColumns(db)` — adds `verification_status`, `verification_notes`, `updated_at` to `gp_profiles` |

## Rules

1. **Never bundle multiple statements** in one `$executeRawUnsafe` call — PostgreSQL error 42601
2. **Always use `IF NOT EXISTS`** — idempotent, safe to call on every request
3. **Call ensure functions BEFORE Prisma queries** in route handlers
4. **Wrap in try/catch** — individual DDL failures should not cascade
5. **Use `$queryRawUnsafe` for reads, `$executeRawUnsafe` for writes** when avoiding Prisma ORM

## Pattern for adding a new table

```typescript
// In your service file:
const MY_TABLE_DDL = `CREATE TABLE IF NOT EXISTS my_table (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

export async function ensureMyTable(db: DbClient): Promise<void> {
  try {
    await db.$executeRawUnsafe(MY_TABLE_DDL);
  } catch (err) {
    console.warn('[my-service] DDL failed:', err instanceof Error ? err.message : err);
  }
}

// In your route handler:
import { ensureMyTable } from '@/domain/my-service';
// ...
await ensureMyTable(db);
const data = await db.myModel.findMany(...);
```

## Raw SQL fallback pattern

When Prisma ORM queries fail due to column mismatches (schema has columns DB doesn't), use `$queryRawUnsafe`:

```typescript
const rows = await db.$queryRawUnsafe(`
  SELECT id, name,
    COALESCE(verification_status, 'PENDING') as "verificationStatus",
    created_at as "createdAt"
  FROM gp_profiles ORDER BY created_at DESC
`);
```
