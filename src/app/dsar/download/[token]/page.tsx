// Public, unauthenticated page (Phase 3.1) — the destination of the link
// sent in sendDsarResponse. Deliberately mirrors /intake/[slug]'s pattern of
// no requireSession(): access here is controlled entirely by the token
// itself (see lib/dsar/download-token.ts), not a login. Every underlying
// file is a PRIVATE blob, so this page — not a guessable public blob URL —
// is genuinely the only way to read them.

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { dsarRequests, orgs } from "@/lib/db/schema";
import { resolveDownloadToken } from "@/lib/dsar/download-token";
import { listEvidenceForDsarRequest } from "@/lib/evidence";

export default async function DownloadPage({ params }: { params: { token: string } }) {
  const resolved = await resolveDownloadToken(params.token);

  if (!resolved) {
    return (
      <main style={{ maxWidth: 500, margin: "80px auto", fontFamily: "system-ui", padding: "0 16px" }}>
        <h1>Link expired or invalid</h1>
        <p>
          This download link is no longer valid — it may have expired. Contact the
          organization that sent it if you need it renewed.
        </p>
      </main>
    );
  }

  const db = getDb();
  const [request] = await db
    .select()
    .from(dsarRequests)
    .where(eq(dsarRequests.id, resolved.requestId))
    .limit(1);
  if (!request) {
    return (
      <main style={{ maxWidth: 500, margin: "80px auto", fontFamily: "system-ui", padding: "0 16px" }}>
        <h1>Link expired or invalid</h1>
      </main>
    );
  }

  const [org] = await db.select().from(orgs).where(eq(orgs.id, request.orgId)).limit(1);
  const files = await listEvidenceForDsarRequest(request.orgId, request.id);

  return (
    <main style={{ maxWidth: 500, margin: "80px auto", fontFamily: "system-ui", padding: "0 16px" }}>
      <h1>Your data from {org?.name ?? "this organization"}</h1>
      <p style={{ color: "#666" }}>
        Requested by {request.requesterName} ({request.requesterEmail})
      </p>
      {files.length === 0 ? (
        <p>No files are currently attached to this response.</p>
      ) : (
        <ul>
          {files.map((f) => (
            <li key={f.id} style={{ marginBottom: 8 }}>
              <a href={`/dsar/download/${params.token}/file/${f.id}`}>{f.fileName}</a>{" "}
              <span style={{ color: "#666", fontSize: 12 }}>
                ({(f.sizeBytes / 1024).toFixed(0)}KB)
              </span>
            </li>
          ))}
        </ul>
      )}
      <p style={{ color: "#999", fontSize: 12, marginTop: 32 }}>
        This link will expire. If it stops working, contact the organization that sent it.
      </p>
    </main>
  );
}
