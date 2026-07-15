/**
 * Automation Config API — GET/POST for admin page.
 */
import { NextResponse } from 'next/server';
import { requirePin } from '@/lib/auth/guards';
import { getConfig, updateConfig, getLogs } from '@/domain/blog/automation-service';

export async function GET(): Promise<NextResponse> {
  try {
    const [config, logs] = await Promise.all([getConfig(), getLogs(20)]);
    return NextResponse.json({ success: true, config, logs });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json() as {
      enabled?: boolean;
      instagramUsername?: string;
      maxPostsPerRun?: number;
      scheduleTime?: string;
      scheduleTimezone?: string;
    };

    await updateConfig({
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
      ...(body.instagramUsername ? { instagramUsername: body.instagramUsername } : {}),
      ...(body.maxPostsPerRun ? { maxPostsPerRun: body.maxPostsPerRun } : {}),
      ...(body.scheduleTime ? { scheduleTime: body.scheduleTime } : {}),
      ...(body.scheduleTimezone ? { scheduleTimezone: body.scheduleTimezone } : {}),
    });

    const config = await getConfig();
    return NextResponse.json({ success: true, config });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 },
    );
  }
}
