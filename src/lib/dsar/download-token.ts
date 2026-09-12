// Token-gated delivery for DSAR export files — Phase 3.1 (2026-09-12).
//
// The security model: evidence_files rows attached to a DSAR request are
// stored as PRIVATE Vercel blobs (see evidence.ts uploadEvidence), meaning
// there is no separately-guessable public URL for them at all — the only
// way to read the bytes is server-side, with BLOB_READ_WRITE_TOKEN. This
// token is therefore the WHOLE access control, not a cosmetic wrapper around
// an already-public link. /dsar/download/[token] validates it (exists, not
// expired, matches the request) before calling fetchPrivateEvidenceBlob for
// each attached file.
//
// Expiry-only, not single-use (see schema.ts comment) — a requester may
// reasonably need to reopen the email and re-download days later.

import crypto from "crypto";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { dsarDownloadTokens } from "@/lib/db/schema";

const DEFAULT_EXPIRY_HOURS = 24 * 7; // one week — long enough for a
// requester to notice the email, short enough that a compiled export of
// someone's personal data doesn't stay retrievable indefinitely.

export async function createDownloadToken(params: {
  requestId: string;
  createdBy: string;
  expiryHours?: number;
}): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + (params.expiryHours ?? DEFAULT_EXPIRY_HOURS) * 60 * 60 * 1000
  );

  const db = getDb();
  await db.insert(dsarDownloadTokens).values({
    requestId: params.requestId,
    token,
    expiresAt,
    createdBy: params.createdBy,
  });

  return { token, expiresAt };
}

export async function resolveDownloadToken(token: string): Promise<{ requestId: string } | null> {
  if (!token) return null;
  const db = getDb();
  const [hit] = await db
    .select({ requestId: dsarDownloadTokens.requestId })
    .from(dsarDownloadTokens)
    .where(and(eq(dsarDownloadTokens.token, token), gt(dsarDownloadTokens.expiresAt, new Date())))
    .limit(1);
  return hit ?? null;
}
