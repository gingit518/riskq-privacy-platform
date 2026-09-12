// Sub-processor register (§5.10's GDPR Art. 17(2)-style notification
// requirement) — same shape and active/retire pattern as dsar/systems.ts.
// Notification is a manual, copy-ready template (below), not an automated
// send — see schema.ts's subProcessors comment for why.

import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { subProcessors } from "@/lib/db/schema";

export async function listSubProcessors(orgId: string) {
  const db = getDb();
  return db.select().from(subProcessors).where(eq(subProcessors.orgId, orgId)).orderBy(asc(subProcessors.name));
}

export async function addSubProcessor(params: {
  orgId: string;
  name: string;
  contactEmail: string;
  dataCategories: string;
  createdBy: string;
}): Promise<void> {
  const db = getDb();
  await db.insert(subProcessors).values(params);
}

export async function setSubProcessorActive(orgId: string, id: string, active: boolean): Promise<void> {
  const db = getDb();
  await db
    .update(subProcessors)
    .set({ active })
    .where(and(eq(subProcessors.id, id), eq(subProcessors.orgId, orgId)));
}

export function subProcessorNoticeTemplate(params: {
  subProcessorName: string;
  requesterEmail: string;
  matter: "deletion" | "correction";
}): { subject: string; body: string } {
  const action = params.matter === "deletion" ? "delete" : "correct";
  return {
    subject: `Data subject request — action needed for ${params.requesterEmail}`,
    body:
      `Hello,\n\n` +
      `We received a data subject request requiring us to ${action} personal data ` +
      `associated with ${params.requesterEmail}. As a processor/sub-processor that ` +
      `may hold this data on our behalf, please ${action} any corresponding records ` +
      `in your systems and confirm back to us once complete.\n\n` +
      `Thank you,\n`,
  };
}
