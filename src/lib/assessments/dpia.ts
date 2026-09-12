// DPIA/PIA workflow (PRD §5.5, Phase 4). One DPIA per processing activity,
// editable in place until marked "completed" (see schema.ts for why this
// is NOT append-only/versioned like the rest of this app's audit-trail
// tables — a DPIA is a living document during drafting).

import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { dpiaAssessments } from "@/lib/db/schema";
import type { DpiaRiskRating } from "./types";

export async function getDpiaForActivity(orgId: string, activityId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(dpiaAssessments)
    .where(and(eq(dpiaAssessments.orgId, orgId), eq(dpiaAssessments.activityId, activityId)))
    .limit(1);
  return row ?? null;
}

/** Creates the DPIA row if it doesn't exist yet — idempotent, so "start a
 * DPIA" can be a plain link/button rather than needing its own guarded
 * create action. */
export async function ensureDpiaStarted(
  orgId: string,
  activityId: string,
  createdBy: string
): Promise<string> {
  const existing = await getDpiaForActivity(orgId, activityId);
  if (existing) return existing.id;

  const db = getDb();
  const [row] = await db
    .insert(dpiaAssessments)
    .values({ orgId, activityId, createdBy })
    .onConflictDoNothing({ target: dpiaAssessments.activityId })
    .returning({ id: dpiaAssessments.id });

  if (row) return row.id;
  // Lost a race with another insert — re-fetch rather than error.
  const nowExisting = await getDpiaForActivity(orgId, activityId);
  if (!nowExisting) throw new Error("Failed to start DPIA.");
  return nowExisting.id;
}

export async function saveDpiaAnswers(params: {
  orgId: string;
  activityId: string;
  answers: Record<string, string>;
}): Promise<void> {
  const db = getDb();
  await db
    .update(dpiaAssessments)
    .set({ answers: params.answers, updatedAt: new Date() })
    .where(and(eq(dpiaAssessments.orgId, params.orgId), eq(dpiaAssessments.activityId, params.activityId)));
}

export async function completeDpia(params: {
  orgId: string;
  activityId: string;
  riskRating: DpiaRiskRating;
  mitigations: string;
  completedBy: string;
}): Promise<void> {
  const db = getDb();
  await db
    .update(dpiaAssessments)
    .set({
      status: "completed",
      riskRating: params.riskRating,
      mitigations: params.mitigations,
      completedBy: params.completedBy,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(dpiaAssessments.orgId, params.orgId), eq(dpiaAssessments.activityId, params.activityId)));
}

export async function reopenDpia(orgId: string, activityId: string): Promise<void> {
  const db = getDb();
  await db
    .update(dpiaAssessments)
    .set({ status: "draft", completedBy: null, completedAt: null, updatedAt: new Date() })
    .where(and(eq(dpiaAssessments.orgId, orgId), eq(dpiaAssessments.activityId, activityId)));
}
