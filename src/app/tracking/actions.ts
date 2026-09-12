"use server";

// Tracking Technologies registry actions (PRD §5.6, Phase 5).

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { addTrackingTechnology, setTrackingTechnologyActive } from "@/lib/tracking/tracking";
import type { TrackingCategory, TrackingParty } from "@/lib/tracking/types";
import { TRACKING_CATEGORIES, TRACKING_PARTIES } from "@/lib/tracking/types";

export async function addTrackingTechnologyAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;

  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  const purpose = String(formData.get("purpose") || "").trim();
  const category = String(formData.get("category") || "other") as TrackingCategory;
  const party = String(formData.get("party") || "third_party") as TrackingParty;
  const retention = String(formData.get("retention") || "").trim();
  if (!TRACKING_CATEGORIES.includes(category) || !TRACKING_PARTIES.includes(party)) return;

  await addTrackingTechnology({
    orgId: session.orgId,
    createdBy: session.userId,
    name,
    purpose,
    category,
    party,
    retention,
  });

  revalidatePath("/tracking");
}

export async function deactivateTrackingTechnologyAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;

  const id = String(formData.get("id") || "");
  if (!id) return;

  await setTrackingTechnologyActive(session.orgId, id, false);
  revalidatePath("/tracking");
}

export async function reactivateTrackingTechnologyAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;

  const id = String(formData.get("id") || "");
  if (!id) return;

  await setTrackingTechnologyActive(session.orgId, id, true);
  revalidatePath("/tracking");
}
