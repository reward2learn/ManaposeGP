/**
 * Instagram Automation Service — DB config + run history.
 */
import { createClient } from '@/lib/db';

export interface AutomationConfig {
  enabled: boolean;
  instagramUsername: string;
  maxPostsPerRun: number;
  scheduleTime: string;       // HH:MM in configured timezone (e.g. "23:00")
  scheduleTimezone: string;    // IANA timezone (e.g. "Australia/Sydney")
  lastRunAt: string | null;
  lastPostTimestamp: string | null;
  totalPostsCreated: number;
}

export interface AutomationLog {
  id: string;
  runAt: string;
  status: string;
  postsFound: number;
  postsCreated: number;
  errorMessage?: string;
  details?: unknown;
}

export async function getConfig(): Promise<AutomationConfig> {
  const db = createClient();
  const rows = await db.$queryRawUnsafe<Array<AutomationConfig>>(
    `SELECT enabled, instagram_username as "instagramUsername", max_posts_per_run as "maxPostsPerRun",
            schedule_time as "scheduleTime", schedule_timezone as "scheduleTimezone",
            last_run_at as "lastRunAt", last_post_timestamp as "lastPostTimestamp",
            total_posts_created as "totalPostsCreated"
     FROM instagram_automation WHERE id = 'default'`,
  );
  return rows[0] || {
    enabled: false, instagramUsername: 'menopause_doctor', maxPostsPerRun: 5,
    scheduleTime: '23:00', scheduleTimezone: 'Australia/Sydney',
    lastRunAt: null, lastPostTimestamp: null, totalPostsCreated: 0,
  };
}

export async function updateConfig(updates: Partial<AutomationConfig>): Promise<void> {
  const db = createClient();
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (updates.enabled !== undefined) { setClauses.push(`enabled = $${idx++}`); values.push(updates.enabled); }
  if (updates.instagramUsername !== undefined) { setClauses.push(`instagram_username = $${idx++}`); values.push(updates.instagramUsername); }
  if (updates.maxPostsPerRun !== undefined) { setClauses.push(`max_posts_per_run = $${idx++}`); values.push(updates.maxPostsPerRun); }
  if (updates.scheduleTime !== undefined) { setClauses.push(`schedule_time = $${idx++}`); values.push(updates.scheduleTime); }
  if (updates.scheduleTimezone !== undefined) { setClauses.push(`schedule_timezone = $${idx++}`); values.push(updates.scheduleTimezone); }
  if (updates.lastRunAt !== undefined) { setClauses.push(`last_run_at = $${idx++}::timestamptz`); values.push(updates.lastRunAt); }
  if (updates.lastPostTimestamp !== undefined) { setClauses.push(`last_post_timestamp = $${idx++}`); values.push(updates.lastPostTimestamp); }
  if (updates.totalPostsCreated !== undefined) { setClauses.push(`total_posts_created = $${idx++}`); values.push(updates.totalPostsCreated); }

  setClauses.push(`updated_at = NOW()`);

  await db.$executeRawUnsafe(
    `UPDATE instagram_automation SET ${setClauses.join(', ')} WHERE id = 'default'`,
    ...values,
  );
}

/**
 * Check if the current time matches the configured schedule.
 * Returns true if it's time to run (within a 30-minute window of the scheduled time).
 * Vercel Cron fires once daily at 13:00 UTC — the handler checks this function.
 */
export function shouldRunNow(config: AutomationConfig): boolean {
  if (!config.enabled) return false;

  const now = new Date();
  const [hours, minutes] = config.scheduleTime.split(':').map(Number);
  const scheduledMinutes = hours * 60 + minutes;
  const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  // Vercel fires at 13:00 UTC. Compare UTC time against the configured time.
  // Allow a 30-minute window around the scheduled time.
  return Math.abs(currentMinutes - scheduledMinutes) <= 30;
}

export async function getLogs(limit = 20): Promise<AutomationLog[]> {
  const db = createClient();
  return db.$queryRawUnsafe<Array<AutomationLog>>(
    `SELECT id, run_at as "runAt", status, posts_found as "postsFound", posts_created as "postsCreated", error_message as "errorMessage", details
     FROM instagram_automation_logs
     ORDER BY run_at DESC
     LIMIT $1`,
    limit,
  );
}

export async function addLog(log: { status: string; postsFound: number; postsCreated: number; errorMessage?: string; details?: unknown }): Promise<void> {
  const db = createClient();
  await db.$executeRawUnsafe(
    `INSERT INTO instagram_automation_logs (status, posts_found, posts_created, error_message, details)
     VALUES ($1, $2, $3, $4, $5::json)`,
    log.status, log.postsFound, log.postsCreated, log.errorMessage || null, log.details ? JSON.stringify(log.details) : null,
  );
}
