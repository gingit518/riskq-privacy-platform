"use server";

// International Transfers registry actions (PRD §5.7, Phase 4).

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { createTransfer, updateTransfer } from "@/lib/assessments/transfers";
import type { TransferMechanism, TiaStatus } from "@/lib/assessments/types";
import { TRANSFER_MECHANISMS, TIA_STATUSES } from "@/lib/assessments/types";

export async function createTransferAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;

  const fromJurisdiction = String(formData.get("fromJurisdiction") || "").trim();
  const toJurisdiction = String(formData.get("toJurisdiction") || "").trim();
  if (!fromJurisdiction || !toJurisdiction) return;

  const mechanism = String(formData.get("mechanism") || "none") as TransferMechanism;
  const tiaStatus = String(formData.get("tiaStatus") || "not_started") as TiaStatus;
  const notes = String(formData.get("notes") || "").trim();
  const activityIdRaw = String(formData.get("activityId") || "");
  const activityId = activityIdRaw || null;

  if (!TRANSFER_MECHANISMS.includes(mechanism) || !TIA_STATUSES.includes(tiaStatus)) return;

  await createTransfer({
    orgId: session.orgId,
    createdBy: session.userId,
    activityId,
    fromJurisdiction,
    toJurisdiction,
    mechanism,
    tiaStatus,
    notes,
  });

  revalidatePath("/transfers");
}

export async function updateTransferAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;

  const id = String(formData.get("id") || "");
  if (!id) return;

  const mechanism = String(formData.get("mechanism") || "none") as TransferMechanism;
  const tiaStatus = String(formData.get("tiaStatus") || "not_started") as TiaStatus;
  const notes = String(formData.get("notes") || "").trim();
  if (!TRANSFER_MECHANISMS.includes(mechanism) || !TIA_STATUSES.includes(tiaStatus)) return;

  await updateTransfer({ orgId: session.orgId, id, mechanism, tiaStatus, notes });
  revalidatePath("/transfers");
}
