"use server";

// Records of Processing Activities (RoPA) + DPIA actions (PRD §5.5, Phase 4).
// Thin wrappers over src/lib/assessments/{ropa,dpia}.ts — parse formData,
// enforce tenant ownership where the lib layer doesn't already, revalidate.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { createActivity, updateActivitySystems, getActivity } from "@/lib/assessments/ropa";
import {
  ensureDpiaStarted,
  saveDpiaAnswers,
  completeDpia,
  reopenDpia,
} from "@/lib/assessments/dpia";
import { DPIA_QUESTIONS } from "@/lib/assessments/dpia-questions";
import type { DpiaRiskRating } from "@/lib/assessments/types";
import { DPIA_RISK_RATINGS } from "@/lib/assessments/types";

export async function createActivityAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;

  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  const purpose = String(formData.get("purpose") || "").trim();
  const dataCategories = String(formData.get("dataCategories") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const dataSubjects = String(formData.get("dataSubjects") || "").trim();
  const lawfulBasis = String(formData.get("lawfulBasis") || "").trim();
  const retentionPeriod = String(formData.get("retentionPeriod") || "").trim();
  const specialCategoryData = formData.get("specialCategoryData") === "on";
  const largeScaleProcessing = formData.get("largeScaleProcessing") === "on";
  const automatedDecisionMaking = formData.get("automatedDecisionMaking") === "on";
  const systemIds = formData.getAll("systemIds").map(String);

  const id = await createActivity({
    orgId: session.orgId,
    createdBy: session.userId,
    name,
    purpose,
    dataCategories,
    dataSubjects,
    lawfulBasis,
    retentionPeriod,
    specialCategoryData,
    largeScaleProcessing,
    automatedDecisionMaking,
    systemIds,
  });

  revalidatePath("/ropa");
  redirect(`/ropa/${id}`);
}

export async function updateActivitySystemsAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;

  const activityId = String(formData.get("activityId") || "");
  if (!activityId) return;

  const systemIds = formData.getAll("systemIds").map(String);
  await updateActivitySystems(session.orgId, activityId, systemIds);
  revalidatePath(`/ropa/${activityId}`);
}

/** Idempotent "start / open DPIA" link target — creates the row on first
 * visit, then just redirects, so this can be a plain link everywhere
 * (activity detail banner, assessments dashboard) without a separate
 * "are you sure" step. */
export async function startDpiaAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;

  const activityId = String(formData.get("activityId") || "");
  if (!activityId) return;

  const activity = await getActivity(session.orgId, activityId);
  if (!activity) return;

  await ensureDpiaStarted(session.orgId, activityId, session.userId);
  redirect(`/ropa/${activityId}/dpia`);
}

export async function saveDpiaAnswersAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;

  const activityId = String(formData.get("activityId") || "");
  if (!activityId) return;

  const activity = await getActivity(session.orgId, activityId);
  if (!activity) return;

  const answers: Record<string, string> = {};
  for (const q of DPIA_QUESTIONS) {
    const val = formData.get(q.id);
    if (val !== null) answers[q.id] = String(val);
  }

  await saveDpiaAnswers({ orgId: session.orgId, activityId, answers });
  revalidatePath(`/ropa/${activityId}/dpia`);
}

export async function completeDpiaAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;

  const activityId = String(formData.get("activityId") || "");
  const riskRating = String(formData.get("riskRating") || "") as DpiaRiskRating;
  const mitigations = String(formData.get("mitigations") || "").trim();
  if (!activityId || !DPIA_RISK_RATINGS.includes(riskRating)) return;

  const activity = await getActivity(session.orgId, activityId);
  if (!activity) return;

  // Also persist whatever answers were on the page at submit time — the
  // "complete" form ships in the same page as the answers, so this avoids
  // forcing a separate "save" click first.
  const answers: Record<string, string> = {};
  for (const q of DPIA_QUESTIONS) {
    const val = formData.get(q.id);
    if (val !== null) answers[q.id] = String(val);
  }
  await saveDpiaAnswers({ orgId: session.orgId, activityId, answers });

  await completeDpia({ orgId: session.orgId, activityId, riskRating, mitigations, completedBy: session.userId });
  revalidatePath(`/ropa/${activityId}/dpia`);
  revalidatePath(`/ropa/${activityId}`);
}

export async function reopenDpiaAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;

  const activityId = String(formData.get("activityId") || "");
  if (!activityId) return;

  const activity = await getActivity(session.orgId, activityId);
  if (!activity) return;

  await reopenDpia(session.orgId, activityId);
  revalidatePath(`/ropa/${activityId}/dpia`);
  revalidatePath(`/ropa/${activityId}`);
}
