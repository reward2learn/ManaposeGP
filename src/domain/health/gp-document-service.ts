/**
 * GP Document Service — manages uploaded verification documents.
 */
import { createClient } from '@/lib/db';

export interface GpDocument {
  id: string;
  gpId: string;
  documentType: string;    // 'ahpra_cert', 'indemnity_insurance', 'medical_degree', 'id_proof', 'other'
  fileName: string;
  fileSize: number;
  mimeType: string;
  dataBase64: string;
  uploadedAt: string;
}

const DOCUMENT_TYPES = ['ahpra_cert', 'indemnity_insurance', 'medical_degree', 'id_proof', 'other'] as const;

export async function uploadDocument(params: {
  gpId: string;
  documentType: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  dataBase64: string;
}): Promise<GpDocument> {
  const db = createClient();
  const result = await db.$queryRawUnsafe<Array<GpDocument>>(
    `INSERT INTO gp_documents (id, gp_id, document_type, file_name, file_size, mime_type, data_base64)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6)
     RETURNING id, gp_id as "gpId", document_type as "documentType", file_name as "fileName",
               file_size as "fileSize", mime_type as "mimeType", data_base64 as "dataBase64",
               uploaded_at as "uploadedAt"`,
    params.gpId, params.documentType, params.fileName, params.fileSize,
    params.mimeType, params.dataBase64,
  );
  return result[0];
}

export async function listDocuments(gpId: string): Promise<Omit<GpDocument, 'dataBase64'>[]> {
  const db = createClient();
  return db.$queryRawUnsafe<Array<Omit<GpDocument, 'dataBase64'>>>(
    `SELECT id, gp_id as "gpId", document_type as "documentType", file_name as "fileName",
            file_size as "fileSize", mime_type as "mimeType", uploaded_at as "uploadedAt"
     FROM gp_documents WHERE gp_id = $1 ORDER BY uploaded_at DESC`,
    gpId,
  );
}

export async function getDocument(documentId: string): Promise<GpDocument | null> {
  const db = createClient();
  const result = await db.$queryRawUnsafe<Array<GpDocument>>(
    `SELECT id, gp_id as "gpId", document_type as "documentType", file_name as "fileName",
            file_size as "fileSize", mime_type as "mimeType", data_base64 as "dataBase64",
            uploaded_at as "uploadedAt"
     FROM gp_documents WHERE id = $1`,
    documentId,
  );
  return result[0] ?? null;
}

export async function deleteDocument(documentId: string): Promise<void> {
  const db = createClient();
  await db.$executeRawUnsafe(`DELETE FROM gp_documents WHERE id = $1`, documentId);
}
