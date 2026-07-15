import { NextRequest, NextResponse } from 'next/server';
import { requirePin } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import { getProviders, upsertProvider, deleteProvider } from '@/domain/admin/admin-config-service';
import { logActivity } from '@/domain/admin/activity-log-service';

export const dynamic = 'force-dynamic';
function jsonError(e: string, s = 400) { return NextResponse.json({ success: false, error: e }, { status: s }); }

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;
  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
  try {
    const type = new URL(request.url).searchParams.get('type') ?? undefined;
    return NextResponse.json({ success: true, providers: await getProviders(db, type) });
  } catch (err) { return jsonError(err instanceof Error ? err.message : 'Failed', 500); }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;
  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
  try {
    const body = await request.json() as Record<string, unknown>;
    const p = await upsertProvider(db, {
      providerType: body.providerType as string, name: body.name as string,
      address: (body.address as string) ?? null, phone: (body.phone as string) ?? null,
      fax: (body.fax as string) ?? null, email: (body.email as string) ?? null,
      website: (body.website as string) ?? null,
      isDefault: (body.isDefault as boolean) ?? false, isActive: (body.isActive as boolean) ?? true,
    });
    await logActivity(db, guard.session.sub, 'UPSERT_PROVIDER', p.id!, { name: p.name });
    return NextResponse.json({ success: true, provider: p });
  } catch (err) { return jsonError(err instanceof Error ? err.message : 'Failed', 500); }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePin(request);
  if (!guard.ok) return guard.response;
  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return jsonError('id required');
    await deleteProvider(db, id);
    await logActivity(db, guard.session.sub, 'DELETE_PROVIDER', id);
    return NextResponse.json({ success: true });
  } catch (err) { return jsonError(err instanceof Error ? err.message : 'Failed', 500); }
}
