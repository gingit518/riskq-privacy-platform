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
  dsarSystemTasks,
  orgs,
  users,
} from "@/lib/db/schema";
import type { ConnectorId } from "@/lib/connectors/types";
import {
  runFulfillmentSearch,
  decideMatch,
  executeApprovedMatches,
} from "@/lib/dsar/connector-fulfillment";
import { requireSession } from "@/lib/auth/session";
import { createDsarRequest } from "@/lib/dsar/create";
import { ensureChecklistTemplateSeeded } from "@/lib/dsar/checklist";
import { uploadEvidence, listEvidenceForDsarRequest } from "@/lib/evidence";
import { createDownloadToken } from "@/lib/dsar/download-token";
import { sendEmail, getAppBaseUrl } from "@/lib/email";
import { completionTemplate } from "@/lib/dsar/templates";
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
  // ownerId replaces the free-text owner box as of 2026-09-16 (Management
  // Summary View / "My Pending" — see schema.ts's dsar_requests.ownerId
  // comment). Empty string from the "Unassigned" option means null.
  const ownerIdRaw = String(formData.get("ownerId") || "");
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

  let ownerId: string | null = null;
  let owner = "";
  if (ownerIdRaw) {
    // Re-verified against this org — a tampered ownerId for a different
    // org's user must not silently assign across tenants.
    const [assignee] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(and(eq(users.id, ownerIdRaw), eq(users.orgId, session.orgId)))
      .limit(1);
    if (assignee) {
      ownerId = assignee.id;
      owner = assignee.email; // denormalized display copy — see schema.ts comment
    }
  }

  await db
    .update(dsarRequests)
    .set({
      status,
      owner,
      ownerId,
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

  const [item] = await db
    .select({ label: dsarChecklistItems.label })
    .from(dsarChecklistItems)
    .where(and(eq(dsarChecklistItems.id, itemId), eq(dsarChecklistItems.requestId, requestId)))
    .limit(1);

  await db
    .update(dsarChecklistItems)
    .set({
      done,
      doneAt: done ? new Date() : null,
      doneBy: done ? session.userId : null,
    })
    .where(and(eq(dsarChecklistItems.id, itemId), eq(dsarChecklistItems.requestId, requestId)));

  // Phase 3.1 fix: this write previously wasn't audit-logged at all, unlike
  // every other material action in this module (status changes, identity
  // verification) — inconsistent with the append-only audit-trail rule
  // applied everywhere else in this schema.
  if (item) {
    await logEvent({
      requestId,
      orgId: session.orgId,
      eventType: "checklist_item_toggled",
      detail: `Checklist item ${done ? "checked" : "unchecked"}: ${item.label}`,
      actorId: session.userId,
    });
  }

  revalidatePath(`/dsar/${requestId}`);
}

/** Toggles a Systems Register fan-out task (Phase 3.1) — same shape as
 * toggleChecklistItem above, separate table because these rows are seeded
 * from dsar_systems, not a per-org checklist template. */
export async function toggleSystemTask(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;

  const taskId = String(formData.get("taskId") || "");
  const requestId = String(formData.get("requestId") || "");
  const done = formData.get("done") === "on";
  if (!taskId || !requestId) return;

  const db = getDb();
  const [task] = await db
    .select({ id: dsarSystemTasks.id, systemName: dsarSystemTasks.systemName })
    .from(dsarSystemTasks)
    .where(
      and(
        eq(dsarSystemTasks.id, taskId),
        eq(dsarSystemTasks.requestId, requestId),
        eq(dsarSystemTasks.orgId, session.orgId)
      )
    )
    .limit(1);
  if (!task) return;

  await db
    .update(dsarSystemTasks)
    .set({
      done,
      doneAt: done ? new Date() : null,
      doneBy: done ? session.userId : null,
    })
    .where(eq(dsarSystemTasks.id, taskId));

  await logEvent({
    requestId,
    orgId: session.orgId,
    eventType: "system_task_toggled",
    detail: `System task ${done ? "completed" : "reopened"}: ${task.systemName}`,
    actorId: session.userId,
  });

  revalidatePath(`/dsar/${requestId}`);
}

/** Attaches a compiled export/evidence file directly to a DSAR request —
 * reuses the shared evidence-upload plumbing (Phase 2), stored as a
 * PRIVATE blob since this data is destined to leave the org (see
 * evidence.ts / schema.ts for why). */
export async function uploadDsarEvidence(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;

  const requestId = String(formData.get("requestId") || "");
  const file = formData.get("file");
  if (!requestId || !(file instanceof File)) return;

  const db = getDb();
  const [owning] = await db
    .select({ id: dsarRequests.id })
    .from(dsarRequests)
    .where(and(eq(dsarRequests.id, requestId), eq(dsarRequests.orgId, session.orgId)))
    .limit(1);
  if (!owning) return;

  await uploadEvidence({
    orgId: session.orgId,
    uploadedBy: session.userId,
    dsarRequestId: requestId,
    file,
  });

  await logEvent({
    requestId,
    orgId: session.orgId,
    eventType: "evidence_uploaded",
    detail: `Uploaded ${file.name}`,
    actorId: session.userId,
  });

  revalidatePath(`/dsar/${requestId}`);
}

/** Sends the completion response by email (Phase 3.1) — generates a
 * time-limited download token for whatever evidence files are attached to
 * this request, builds the completion template with that link baked in,
 * and sends via Resend. Deliberately does NOT auto-transition status to
 * "completed" — sending the response and closing the request are related
 * but distinct actions (e.g. a partial response might still need
 * follow-up), so staff still confirms the status change explicitly via the
 * status form above. Throws (surfacing Next's generic error page, no inline
 * error UI yet — same known-gap pattern as uploadObligationEvidence) if
 * RESEND_API_KEY / APP_BASE_URL aren't configured. */
export async function sendDsarResponse(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;

  const requestId = String(formData.get("requestId") || "");
  if (!requestId) return;

  const db = getDb();
  const [request] = await db
    .select()
    .from(dsarRequests)
    .where(and(eq(dsarRequests.id, requestId), eq(dsarRequests.orgId, session.orgId)))
    .limit(1);
  if (!request) return;

  const [org] = await db.select().from(orgs).where(eq(orgs.id, session.orgId)).limit(1);
  const orgName = org?.name ?? "your organization";

  const attachments = await listEvidenceForDsarRequest(session.orgId, requestId);

  let downloadLink: string | undefined;
  if (attachments.length > 0) {
    const { token } = await createDownloadToken({ requestId, createdBy: session.userId });
    downloadLink = `${getAppBaseUrl()}/dsar/download/${token}`;
  }

  const body = completionTemplate({
    requesterName: request.requesterName,
    orgName,
    requestType: request.requestType,
    downloadLink,
  });

  await sendEmail({
    to: request.requesterEmail,
    subject: `Your data request to ${orgName}`,
    text: body,
  });

  await logEvent({
    requestId,
    orgId: session.orgId,
    eventType: "response_sent",
    detail: `Response emailed to ${request.requesterEmail}${
      downloadLink ? ` with a download link (expires in 7 days, ${attachments.length} file(s))` : ""
    }`,
    actorId: session.userId,
  });

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

// ---------------------------------------------------------------------------
// Phase 7 (PRD §5.10) — connector fulfillment actions. See
// src/lib/dsar/connector-fulfillment.ts for the search/approve/execute
// orchestration itself; these are thin session-checked wrappers, same
// pattern as every other action in this file.
// ---------------------------------------------------------------------------

export async function runFulfillmentSearchAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;

  const requestId = String(formData.get("requestId") || "");
  const connectorId = String(formData.get("connectorId") || "") as ConnectorId;
  if (!requestId || !connectorId) return;

  await runFulfillmentSearch({
    orgId: session.orgId,
    requestId,
    connectorId,
    startedBy: session.userId,
  });

  revalidatePath(`/dsar/${requestId}`);
}

export async function decideMatchAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;

  const requestId = String(formData.get("requestId") || "");
  const matchId = String(formData.get("matchId") || "");
  const decision = String(formData.get("decision") || "") as "approved" | "rejected";
  if (!requestId || !matchId || (decision !== "approved" && decision !== "rejected")) return;

  const result = await decideMatch({
    orgId: session.orgId,
    matchId,
    decision,
    decidedBy: session.userId,
  });

  if (!result.ok) {
    await logEvent({
      requestId,
      orgId: session.orgId,
      eventType: "fulfillment_approval_blocked",
      detail: result.errorDetail || "Approval blocked.",
      actorId: session.userId,
    });
  }

  revalidatePath(`/dsar/${requestId}`);
}

export async function executeApprovedMatchesAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;

  const requestId = String(formData.get("requestId") || "");
  const runId = String(formData.get("runId") || "");
  if (!requestId || !runId) return;

  await executeApprovedMatches({ orgId: session.orgId, runId, executedBy: session.userId });

  revalidatePath(`/dsar/${requestId}`);
}
