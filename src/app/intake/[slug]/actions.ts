"use server";

// Public, UNAUTHENTICATED DSAR intake (PRD §5.3: "public-facing form"). No
// requireSession() here on purpose — this is the one page in the app a
// logged-out data subject is meant to reach. Org is resolved from the URL
// slug, not a session; every write below is scoped to that resolved org.id,
// same tenant-isolation discipline as the authenticated actions.

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orgs } from "@/lib/db/schema";
import { createDsarRequest } from "@/lib/dsar/create";
import type { DsarRequestType } from "@/lib/dsar/types";
import { DSAR_REQUEST_TYPES } from "@/lib/dsar/types";

export interface PublicIntakeResult {
  ok: boolean;
  error?: string;
}

export async function submitPublicDsarRequest(
  slug: string,
  formData: FormData
): Promise<PublicIntakeResult> {
  const db = getDb();
  const [org] = await db.select().from(orgs).where(eq(orgs.slug, slug)).limit(1);
  if (!org) {
    return { ok: false, error: "This request form is not recognized." };
  }

  const requesterName = String(formData.get("requesterName") || "").trim();
  const requesterEmail = String(formData.get("requesterEmail") || "").trim();
  const requestType = String(formData.get("requestType") || "") as DsarRequestType;

  if (!requesterName || !requesterEmail) {
    return { ok: false, error: "Name and email are required." };
  }
  if (!DSAR_REQUEST_TYPES.includes(requestType)) {
    return { ok: false, error: "Please choose a request type." };
  }

  await createDsarRequest({
    orgId: org.id,
    requesterName,
    requesterEmail,
    requestType,
    source: "public",
  });

  return { ok: true };
}
