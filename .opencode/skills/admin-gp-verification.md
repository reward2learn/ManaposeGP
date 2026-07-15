# Admin GP Verification Skill

GP registration approval/rejection workflow. Displays all GPs with their verification status, practice details, AHPRA numbers, and indemnity info.

## API Routes

- `GET /api/admin/gp-verification` — list all GPs with verification fields
- `PATCH /api/admin/gp-verification` — approve/reject with status and notes
- File: `src/app/api/admin/gp-verification/route.ts`

## Critical: Raw SQL Required

The `gp_profiles` table was created via raw SQL INSERT (not Prisma migration). The `verification_status`, `verification_notes`, and `updated_at` columns may not exist. **Always use raw SQL**, never Prisma ORM queries for GP verification.

### GET (list GPs)

```typescript
await ensureGpProfileColumns(db); // Adds missing columns if needed
const gps = await listGpsForVerification(db); // Raw SQL with COALESCE
```

Fallback: if column addition fails, query without verification columns (hardcodes 'PENDING').

### PATCH (approve/reject)

```typescript
await ensureGpProfileColumns(db);
await db.$queryRawUnsafe(
  `UPDATE gp_profiles SET verified = $1, verification_status = $2, verification_notes = $3, updated_at = NOW() WHERE id = $4`,
  verified, status, notes, gpId,
);
```

## Data Flow

1. GP registers via `/api/gp/onboard` → raw SQL INSERT into `gp_profiles`
2. Admin views list at `/admin/gp-verification`
3. Admin approves/rejects → raw SQL UPDATE with verification_status
4. Activity logged via `logActivity(db, sub, 'VERIFY_GP_APPROVED', gpId)`

## GP Profile Service

- File: `src/domain/health/gp-profile-service.ts`
- `listGpsForVerification(db)` — raw SQL with verification fields
- `listGps(db)` — raw SQL without verification fields (for other consumers)
- `ensureGpProfileColumns(db)` — ALTER TABLE for missing columns
- `isVerifiedGp(db, userId)` — boolean check via raw SQL

## UI Page

- File: `src/app/(app)/admin/gp-verification/page.tsx`
- Table with Name, Practice, AHPRA, Email, Indemnity, Status, Actions
- Approve/Reject dialog with optional notes
- `AuthGate requiredTier="pin"`
