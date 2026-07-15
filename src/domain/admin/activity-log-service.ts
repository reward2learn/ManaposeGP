import type { DbClient } from '@/lib/db';
import { getOpenAiKeyStatus } from '@/lib/secrets';

export async function logActivity(
  db: DbClient,
  actorId: string,
  action: string,
  target?: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.activityLog.create({
      data: {
        actorId,
        action,
        target: target ?? null,
        details: (details ?? {}) as Record<string, unknown> & Parameters<typeof db.activityLog.create>[0]['data']['details'],
      },
    });
  } catch {
    // Best-effort logging — don't throw if audit fails
    console.warn('[activity-log] Failed to write log entry', { action, actorId, target });
  }
}

export async function getActivityLogs(
  db: DbClient,
  limit = 50,
  action?: string,
): Promise<Array<{ id: string; actorId: string; action: string; target: string | null; details: Record<string, unknown>; createdAt: string }>> {
  const where: Record<string, unknown> = {};
  if (action) where.action = action;

  const rows = await db.activityLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    actorId: r.actorId as string,
    action: r.action as string,
    target: (r.target as string) ?? null,
    details: (r.details as Record<string, unknown>) ?? {},
    createdAt: (r.createdAt as Date).toISOString(),
  }));
}

export async function getDashboardStats(db: DbClient): Promise<{
  totalGps: number;
  pendingGps: number;
  totalPatients: number;
  appointmentsToday: number;
  consultationsThisMonth: number;
  openAiKeyConfigured: boolean;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  // Use allSettled so one failing stat doesn't zero the entire dashboard.
  const results = await Promise.allSettled([
    db.gPProfile.count(),
    db.gPProfile.count({ where: { verificationStatus: 'PENDING' } }),
    db.healthProfile.count(),
    db.appointment.count({
      where: { date: { gte: today }, status: { in: ['BOOKED', 'CONFIRMED'] } },
    }),
    db.gPConsultation.count({
      where: { createdAt: { gte: monthStart } },
    }),
    getOpenAiKeyStatus(),
  ]);

  const num = (result: PromiseSettledResult<unknown>, fallback = 0): number =>
    result.status === 'fulfilled' ? (result.value as number) : fallback;

  const keyResult = results[5];
  const keyConfigured =
    keyResult.status === 'fulfilled'
      ? (keyResult.value as { configured: boolean }).configured
      : false;

  return {
    totalGps: num(results[0]),
    pendingGps: num(results[1]),
    totalPatients: num(results[2]),
    appointmentsToday: num(results[3]),
    consultationsThisMonth: num(results[4]),
    openAiKeyConfigured: keyConfigured,
  };
}
