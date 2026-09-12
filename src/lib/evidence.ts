// Shared evidence-upload logic for Business Obligations (§5.2) and Cyber
// Controls (§5.4) — both need "evidence attachment/upload" per the PRD, and
// the mechanics (upload a file, store it, list it back, tie it to a
// tenant + a specific row) are identical between them, so this lives once
// rather than duplicated in obligations/actions.ts and controls/actions.ts.
//
// Storage is Vercel Blob (PRD §6's original architecture note for "evidence
// uploads, signed SCCs, etc."). Requires BLOB_READ_WRITE_TOKEN, which Vercel
// auto-injects once a Blob store is created and connected to the project —
// same pattern as Neon auto-injecting DATABASE_URL. See README for the setup
// step; there is no local/dev fallback here (uploads will throw a clear
// error, not a silent no-op, if the token is missing — same philosophy as
// getDb()/getSecret() elsewhere in this codebase).

import { put, get as blobGet } from "@vercel/blob";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { evidenceFiles } from "@/lib/db/schema";

const MAX_EVIDENCE_BYTES = 8 * 1024 * 1024; // 8MB — comfortable for a scanned
// doc or screenshot without approaching the 10MB Server Action body limit
// set in next.config.mjs (some margin for the rest of the form payload).

export interface UploadEvidenceParams {
  orgId: string;
  uploadedBy: string;
  file: File;
  obligationId?: string;
  controlId?: string;
  dsarRequestId?: string;
}

export async function uploadEvidence(params: UploadEvidenceParams): Promise<void> {
  const { orgId, uploadedBy, file, obligationId, controlId, dsarRequestId } = params;

  const targetCount = [obligationId, controlId, dsarRequestId].filter(Boolean).length;
  if (targetCount !== 1) {
    throw new Error(
      "uploadEvidence requires exactly one of obligationId, controlId, or dsarRequestId."
    );
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is not set — create a Vercel Blob store and connect it to this " +
        "project (Vercel → Storage → Create Database → Blob), same as the Neon Postgres setup."
    );
  }
  if (file.size === 0) {
    throw new Error("No file selected.");
  }
  if (file.size > MAX_EVIDENCE_BYTES) {
    throw new Error(
      `File is ${(file.size / 1024 / 1024).toFixed(1)}MB — evidence uploads are capped at ` +
        `${MAX_EVIDENCE_BYTES / 1024 / 1024}MB.`
    );
  }

  // DSAR export files are PRIVATE — they're compiled data destined to leave
  // the org via the requester's emailed, token-gated download link, so they
  // get the stricter posture (see schema.ts evidence_files.isPrivate).
  // Obligation/control evidence stays public, as before — it never leaves
  // the app, and public blobs are simpler to just link to directly.
  const isPrivate = Boolean(dsarRequestId);
  const targetId = obligationId ?? controlId ?? dsarRequestId;
  const path = `evidence/${orgId}/${targetId}/${Date.now()}-${file.name}`;
  const blob = await put(path, file, { access: isPrivate ? "private" : "public" });

  const db = getDb();
  await db.insert(evidenceFiles).values({
    orgId,
    obligationId: obligationId ?? null,
    controlId: controlId ?? null,
    dsarRequestId: dsarRequestId ?? null,
    isPrivate,
    fileName: file.name,
    blobUrl: blob.url,
    contentType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    uploadedBy,
  });
}

export async function listEvidenceForObligations(
  orgId: string,
  obligationIds: string[]
) {
  if (obligationIds.length === 0) return [];
  const db = getDb();
  const rows = await db
    .select()
    .from(evidenceFiles)
    .where(and(eq(evidenceFiles.orgId, orgId), isNull(evidenceFiles.controlId)))
    .orderBy(desc(evidenceFiles.uploadedAt));
  const wanted = new Set(obligationIds);
  return rows.filter((r) => r.obligationId && wanted.has(r.obligationId));
}

export async function listEvidenceForControls(orgId: string, controlIds: string[]) {
  if (controlIds.length === 0) return [];
  const db = getDb();
  const rows = await db
    .select()
    .from(evidenceFiles)
    .where(and(eq(evidenceFiles.orgId, orgId), isNull(evidenceFiles.obligationId)))
    .orderBy(desc(evidenceFiles.uploadedAt));
  const wanted = new Set(controlIds);
  return rows.filter((r) => r.controlId && wanted.has(r.controlId));
}

export async function listEvidenceForDsarRequest(orgId: string, requestId: string) {
  const db = getDb();
  return db
    .select()
    .from(evidenceFiles)
    .where(and(eq(evidenceFiles.orgId, orgId), eq(evidenceFiles.dsarRequestId, requestId)))
    .orderBy(desc(evidenceFiles.uploadedAt));
}

/** Streams a PRIVATE DSAR evidence blob's bytes server-side, using the
 * BLOB_READ_WRITE_TOKEN — this is the only way to read it, since it has no
 * separately-fetchable public URL. Used by the token-gated download route,
 * never called from a client component. Throws if the row isn't actually
 * private (defensive — should never happen given uploadEvidence above). */
export async function fetchPrivateEvidenceBlob(fileRow: {
  isPrivate: boolean;
  blobUrl: string;
  contentType: string;
  fileName: string;
}) {
  if (!fileRow.isPrivate) {
    throw new Error("fetchPrivateEvidenceBlob called on a non-private evidence row.");
  }
  const result = await blobGet(fileRow.blobUrl, { access: "private" });
  if (!result || result.statusCode !== 200) {
    throw new Error("Evidence file not found in Blob storage.");
  }
  return result;
}
