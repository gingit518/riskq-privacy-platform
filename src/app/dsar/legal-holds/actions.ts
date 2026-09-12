"use server";

// Legal Holds registry settings actions (Phase 3.1, PRD §5.3 fulfillment
// automation). See src/lib/dsar/legal-holds.ts for the lookup this feeds.

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { legalHolds } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";

export async function addLegalHoldAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;

  const subjectName = String(formData.get("subjectName") || "").trim();
  const subjectEmail = String(formData.get("subjectEmail") || "").trim();
  const matter = String(formData.get("matter") || "").trim();
  if (!subjectEmail) return;

  const db = getDb();
  await db.insert(legalHolds).values({
    orgId: session.orgId,
    subjectName,
    subjectEmail,
    matter,
    createdBy: session.userId,
  });

  revalidatePath("/dsar/legal-holds");
}

export async function releaseLegalHoldAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;

  const id = String(formData.get("id") || "");
  if (!id) return;

  const db = getDb();
  await db
    .update(legalHolds)
    .set({ active: false })
    .where(and(eq(legalHolds.id, id), eq(legalHolds.orgId, session.orgId)));

  revalidatePath("/dsar/legal-holds");
}
