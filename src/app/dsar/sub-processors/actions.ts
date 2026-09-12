"use server";

// Sub-processor register actions (Phase 7, PRD §5.10) — same pattern as
// dsar/systems/actions.ts.

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { addSubProcessor, setSubProcessorActive } from "@/lib/dsar/sub-processors";

export async function addSubProcessorAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;

  const name = String(formData.get("name") || "").trim();
  const contactEmail = String(formData.get("contactEmail") || "").trim();
  const dataCategories = String(formData.get("dataCategories") || "").trim();
  if (!name) return;

  await addSubProcessor({
    orgId: session.orgId,
    name,
    contactEmail,
    dataCategories,
    createdBy: session.userId,
  });
  revalidatePath("/dsar/sub-processors");
}

export async function deactivateSubProcessorAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  await setSubProcessorActive(session.orgId, id, false);
  revalidatePath("/dsar/sub-processors");
}

export async function reactivateSubProcessorAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  await setSubProcessorActive(session.orgId, id, true);
  revalidatePath("/dsar/sub-processors");
}
