"use server";

// Data Subject Access Rights / DSAR (PRD §5.3, Phase 3). Internal
// (authenticated) actions only — the public intake form's action lives at
// src/app/intake/[slug]/actions.ts since it has no session to check.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, asc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  dsarRequests,
  dsarEvents,
  dsarChecklistItems,
  dsarChecklistTemplates,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import { createDsarRequest } from "@/lib/dsar/create";
import { ensureChecklistTemplateSeeded } from "@/lib/dsar/checklist";
import type { DsarRequestType, DsarStatus } from "@/lib/dsar/types";
import { DSAR_REQUEST_TYPES, DSAR_STATUSES } from "@/lib/dsar/types";

async function logEvent(params: {
  requestId: string;
  orgId: string;
  eventType: string;
  detail: string;
  actorId?: string;
}): Promise<void> {
  const db = getDb();
  await db.insert(dsarEvents).values({
    requestId: params.requestId,
    orgId: params.orgId,
    eventType: params.eventType,
    detail: params.detail,
    actorId: params.actorId ?? null,
  });
}

export async function createInternalDsarRequest(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;

  const requesterName = String(formData.get("requesterName") || "").trim();
  const requesterEmail = String(formData.get("requesterEmail") || "").trim();
  const requestType = String(formData.get("requestType") || "") as DsarRequestType;
  if (!requesterName || !requesterEmail || !DSAR_REQUEST_TYPES.includes(requestType)) {
    return;
  }

  const id = await createDsarRequest({
    orgId: session.orgId,
    requesterName,
    requesterEmail,
    requestType,
    source: "internal",
    actorId: session.userId,
  });

  revalidatePath("/dsar");
  redirect(`/dsar/${id}`);
}

export async function updateDsarStatus(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;

  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "") as DsarStatus;
  const owner = String(formData.get("owner") || "");
  const notes = String(formData.get("notes") || "");
  if (!id || !DSAR_STATUSES.includes(status)) return;

  const db = getDb();
  const [existing] = await db
    .select({ status: dsarRequests.status })
    .from(dsarRequests)
    .where(and(eq(dsarRequests.id, id), eq(dsarRequests.orgId, session.orgId)))
    .limit(1);
  if (!existing) return;

  const isClosing = status === "completed" || status === "denied";

  await db
    .update(dsarRequests)
    .set({
      status,
      owner,
      notes,
      closedAt: isClosing ? new Date() : null,
    })
    .where(and(eq(dsarRequests.id, id), eq(dsarRequests.orgId, session.orgId)));

  if (existing.status !== status) {
    await logEvent({
      requestId: id,
      orgId: session.orgId,
      eventType: "status_change",
      detail: `Status changed: ${existing.status} -> ${status}`,
      actorId: session.userId,
    });
  }

  revalidatePath(`/dsar/${id}`);
  revalidatePath("/dsar");
}

export async function verifyIdentity(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;

  const id = String(formData.get("id") || "");
  if (!id) return;

  const db = getDb();
  await db
    .update(dsarRequests)
    .set({
      identityVerified: true,
      identityVerifiedAt: new Date(),
      identityVerifiedBy: session.userId,
    })
    .where(and(eq(dsarRequests.id, id), eq(dsarRequests.orgId, session.orgId)));

  await logEvent({
    requestId: id,
    orgId: session.orgId,
    eventType: "identity_verified",
    detail: `Identity verified by ${session.email}`,
    actorId: session.userId,
  });

  revalidatePath(`/dsar/${id}`);
}

export async function toggleChecklistItem(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;

  const itemId = String(formData.get("itemId") || "");
  const requestId = String(formData.get("requestId") || "");
  const done = formData.get("done") === "on";
  if (!itemId || !requestId) return;

  // Confirm the item belongs to a request in this org before writing —
  // tenant isolation is application-layer only (no RLS yet, see README).
  const db = getDb();
  const [owning] = await db
    .select({ id: dsarRequests.id })
    .from(dsarRequests)
    .where(and(eq(dsarRequests.id, requestId), eq(dsarRequests.orgId, session.orgId)))
    .limit(1);
  if (!owning) return;

  await db
    .update(dsarChecklistItems)
    .set({
      done,
      doneAt: done ? new Date() : null,
      doneBy: done ? session.userId : null,
    })
    .where(and(eq(dsarChecklistItems.id, itemId), eq(dsarChecklistItems.requestId, requestId)));

  revalidatePath(`/dsar/${requestId}`);
}

export async function addChecklistTemplateItem(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;

  const requestType = String(formData.get("requestType") || "") as DsarRequestType;
  const label = String(formData.get("label") || "").trim();
  if (!DSAR_REQUEST_TYPES.includes(requestType) || !label) return;

  await ensureChecklistTemplateSeeded(session.orgId, requestType);

  const db = getDb();
  const existing = await db
    .select()
    .from(dsarChecklistTemplates)
    .where(
      and(
        eq(dsarChecklistTemplates.orgId, session.orgId),
        eq(dsarChecklistTemplates.requestType, requestType)
      )
    )
    .orderBy(asc(dsarChecklistTemplates.sortOrder));

  const nextOrder = existing.length > 0 ? existing[existing.length - 1].sortOrder + 1 : 0;

  await db.insert(dsarChecklistTemplates).values({
    orgId: session.orgId,
    requestType,
    label,
    sortOrder: nextOrder,
  });

  revalidatePath("/dsar/checklist");
}

export async function removeChecklistTemplateItem(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;

  const id = String(formData.get("id") || "");
  if (!id) return;

  const db = getDb();
  await db
    .delete(dsarChecklistTemplates)
    .where(and(eq(dsarChecklistTemplates.id, id), eq(dsarChecklistTemplates.orgId, session.orgId)));

  revalidatePath("/dsar/checklist");
}
