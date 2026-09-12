// Streams one private DSAR evidence file's bytes, gated by the same token
// as the parent page (re-validated here, not just on the listing page —
// this route IS the access control, so it must check independently rather
// than trust that the browser only got here via the listing page).

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { evidenceFiles } from "@/lib/db/schema";
import { resolveDownloadToken } from "@/lib/dsar/download-token";
import { fetchPrivateEvidenceBlob } from "@/lib/evidence";

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string; fileId: string } }
) {
  const resolved = await resolveDownloadToken(params.token);
  if (!resolved) {
    return NextResponse.json({ error: "Link expired or invalid." }, { status: 410 });
  }

  const db = getDb();
  const [file] = await db
    .select()
    .from(evidenceFiles)
    .where(
      and(eq(evidenceFiles.id, params.fileId), eq(evidenceFiles.dsarRequestId, resolved.requestId))
    )
    .limit(1);
  if (!file) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const blob = await fetchPrivateEvidenceBlob(file);

  return new NextResponse(blob.stream, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.fileName.replace(/"/g, "")}"`,
    },
  });
}
