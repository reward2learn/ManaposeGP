import { NextRequest, NextResponse } from 'next/server';
import { requireWriteAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';

function jsonError(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

/**
 * GET /api/consent/audit?consentId=xxx
 *
 * Returns the audit log for a specific consent record.
 * Access: PIN tier (GP/admin) only.
 */
export async function GET(request: NextRequest) {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
  const { searchParams } = new URL(request.url);
  const consentId = searchParams.get('consentId');

  try {
    const rows = await db.$queryRawUnsafe<Array<{
      id: string;
      consent_id: string;
      action: string;
      actor_type: string;
      actor_id: string;
      previous_status: string | null;
      new_status: string | null;
      metadata: unknown;
      created_at: string;
    }>>(
      `SELECT id, consent_id, action, actor_type, actor_id, previous_status, new_status, metadata::text, created_at::text
       FROM consent_audit_logs
       WHERE ${consentId ? "consent_id = $1" : "1=1"}
       ORDER BY created_at DESC
       LIMIT 200`,
      ...(consentId ? [consentId] : []),
    );

    return NextResponse.json({
      success: true,
      auditLogs: rows,
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed', 500);
  }
}
