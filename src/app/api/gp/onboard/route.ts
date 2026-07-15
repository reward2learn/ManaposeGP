import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { requireWriteAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/db';
import { registerGp, getGpProfile, verifyGp, listGps, updateGp } from '@/domain/health/gp-profile-service';
import { uploadDocument, listDocuments, getDocument, deleteDocument } from '@/domain/health/gp-document-service';

const onboardSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  practiceName: z.string().optional(),
  ahpraNumber: z.string().optional(),
  email: z.string().email().optional(),
  indemnityProvider: z.string().optional(),
  indemnityPolicyNumber: z.string().optional(),
  indemnityExpiryDate: z.string().optional(),
});

function jsonError(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

export async function POST(request: NextRequest) {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
  const userId = guard.session.sub;

  try {
    const body = await request.json();
    const parsed = onboardSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues.map(i => i.message).join('; '));
    }

    const existing = await getGpProfile(db, userId);
    if (existing) {
      return NextResponse.json({ success: true, profile: existing, message: 'GP profile already exists' });
    }

    const profile = await registerGp(db, userId, {
      name: parsed.data.name,
      practiceName: parsed.data.practiceName,
      practiceAddress: (parsed.data as Record<string,string>).practiceAddress,
      practiceSuburb: (parsed.data as Record<string,string>).practiceSuburb,
      practiceState: (parsed.data as Record<string,string>).practiceState,
      practicePostcode: (parsed.data as Record<string,string>).practicePostcode,
      practicePhone: (parsed.data as Record<string,string>).practicePhone,
      ahpraNumber: parsed.data.ahpraNumber,
      email: parsed.data.email,
      indemnityProvider: parsed.data.indemnityProvider,
      indemnityPolicyNumber: parsed.data.indemnityPolicyNumber,
      indemnityExpiryDate: parsed.data.indemnityExpiryDate,
    });
    return NextResponse.json({ success: true, profile, message: 'GP profile created. Awaiting verification.' }, { status: 201 });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed to register GP', 500);
  }
}

export async function GET(request: NextRequest) {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });

  try {
    const profile = await getGpProfile(db, guard.session.sub);
    if (!profile) return jsonError('No GP profile found', 404);
    return NextResponse.json({ success: true, profile });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed to get GP profile', 500);
  }
}

// Admin: list all GPs
export async function PATCH(request: NextRequest) {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });

  try {
    const body = await request.json();
    if (body.action === 'verify' && body.gpId) {
      await verifyGp(db, body.gpId);
      return NextResponse.json({ success: true, message: 'GP verified' });
    }
    if (body.action === 'update' && body.gpId) {
      const { name, practiceName, practiceAddress, practiceSuburb, practiceState, practicePostcode, practicePhone, ahpraNumber, email, indemnityProvider, indemnityPolicyNumber, indemnityExpiryDate } = body;
      await updateGp(db, body.gpId, { name, practiceName, practiceAddress, practiceSuburb, practiceState, practicePostcode, practicePhone, ahpraNumber, email, indemnityProvider, indemnityPolicyNumber, indemnityExpiryDate });
      return NextResponse.json({ success: true, message: 'GP updated' });
    }
    if (body.action === 'list') {
      const gps = await listGps(db);
      return NextResponse.json({ success: true, gps });
    }
    // Document actions
    if (body.action === 'list-docs' && body.gpId) {
      const docs = await listDocuments(body.gpId);
      return NextResponse.json({ success: true, documents: docs });
    }
    if (body.action === 'upload-doc' && body.gpId && body.documentType && body.fileName && body.dataBase64) {
      const doc = await uploadDocument({
        gpId: body.gpId,
        documentType: body.documentType,
        fileName: body.fileName,
        fileSize: body.fileSize || 0,
        mimeType: body.mimeType || 'application/octet-stream',
        dataBase64: body.dataBase64,
      });
      return NextResponse.json({ success: true, document: doc });
    }
    if (body.action === 'delete-doc' && body.docId) {
      await deleteDocument(body.docId);
      return NextResponse.json({ success: true, message: 'Document deleted' });
    }
    if (body.action === 'get-doc' && body.docId) {
      const doc = await getDocument(body.docId);
      if (!doc) return jsonError('Document not found', 404);
      return NextResponse.json({ success: true, document: doc });
    }
    return jsonError('Invalid action');
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Failed', 500);
  }
}
