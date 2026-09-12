"use server";

// Systems Register settings actions (Phase 3.1, PRD §5.3 fulfillment
// automation). See src/lib/dsar/systems.ts for the module this wraps.

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { addSystem, setSystemActive } from "@/lib/dsar/systems";

export async function addSystemAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;

  const name = String(formData.get("name") || "").trim();
  const ownerName = String(formData.get("ownerName") || "").trim();
  const ownerEmail = String(formData.get("ownerEmail") || "").trim();
  const dataCategories = String(formData.get("dataCategories") || "").trim();
  if (!name) return;

  await addSystem({ orgId: session.orgId, name, ownerName, ownerEmail, dataCategories });
  revalidatePath("/dsar/systems");
}

export async function deactivateSystemAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;

  const id = String(formData.get("id") || "");
  if (!id) return;

  await setSystemActive(session.orgId, id, false);
  revalidatePath("/dsar/systems");
}

export async function reactivateSystemAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;

  const id = String(formData.get("id") || "");
  if (!id) return;

  await setSystemActive(session.orgId, id, true);
  revalidatePath("/dsar/systems");
}
