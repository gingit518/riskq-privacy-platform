// Records of Processing Activities (RoPA) — PRD §5.5, Phase 4 (2026-09-12).
// See schema.ts processingActivities for why this is new shared
// infrastructure rather than a retrofit onto Business Obligations (Phase 2
// shipped without it).

import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  processingActivities,
  processingActivitySystems,
  dsarSystems,
} from "@/lib/db/schema";

export interface CreateActivityParams {
  orgId: string;
  createdBy: string;
  name: string;
  purpose: string;
  dataCategories: string[];
  dataSubjects: string;
  lawfulBasis: string;
  retentionPeriod: string;
  specialCategoryData: boolean;
  largeScaleProcessing: boolean;
  automatedDecisionMaking: boolean;
  systemIds: string[];
}

/** True if any DPIA-trigger risk flag is set (PRD §5.5's explicit criteria).
 * This never forces a DPIA — it only drives the "DPIA recommended" banner;
 * the decision to actually do one stays with a human. */
export function needsDpiaReview(activity: {
  specialCategoryData: boolean;
  largeScaleProcessing: boolean;
  automatedDecisionMaking: boolean;
}): boolean {
  return (
    activity.specialCategoryData ||
    activity.largeScaleProcessing ||
    activity.automatedDecisionMaking
  );
}

export async function createActivity(params: CreateActivityParams): Promise<string> {
  const db = getDb();
  const [row] = await db
    .insert(processingActivities)
    .values({
      orgId: params.orgId,
      createdBy: params.createdBy,
      name: params.name,
      purpose: params.purpose,
      dataCategories: params.dataCategories,
      dataSubjects: params.dataSubjects,
      lawfulBasis: params.lawfulBasis,
      retentionPeriod: params.retentionPeriod,
      specialCategoryData: params.specialCategoryData,
      largeScaleProcessing: params.largeScaleProcessing,
      automatedDecisionMaking: params.automatedDecisionMaking,
    })
    .returning({ id: processingActivities.id });

  if (params.systemIds.length > 0) {
    await db.insert(processingActivitySystems).values(
      params.systemIds.map((systemId) => ({ activityId: row.id, systemId }))
    );
  }

  return row.id;
}

export async function updateActivitySystems(
  orgId: string,
  activityId: string,
  systemIds: string[]
): Promise<void> {
  const db = getDb();
  // Confirm the activity belongs to this org before touching its links.
  const [owning] = await db
    .select({ id: processingActivities.id })
    .from(processingActivities)
    .where(and(eq(processingActivities.id, activityId), eq(processingActivities.orgId, orgId)))
    .limit(1);
  if (!owning) return;

  await db
    .delete(processingActivitySystems)
    .where(eq(processingActivitySystems.activityId, activityId));
  if (systemIds.length > 0) {
    await db
      .insert(processingActivitySystems)
      .values(systemIds.map((systemId) => ({ activityId, systemId })));
  }
}

export async function listActivities(orgId: string) {
  const db = getDb();
  return db
    .select()
    .from(processingActivities)
    .where(eq(processingActivities.orgId, orgId))
    .orderBy(processingActivities.name);
}

export async function getActivity(orgId: string, activityId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(processingActivities)
    .where(and(eq(processingActivities.id, activityId), eq(processingActivities.orgId, orgId)))
    .limit(1);
  return row ?? null;
}

/** Systems linked to an activity, joined to their live name/owner from the
 * Systems Register — NOT a snapshot, unlike the DSAR system-task fan-out.
 * RoPA is a living record of the current state of processing, not an
 * audit-trail event, so it should reflect the register as it stands today. */
export async function listActivitySystems(activityId: string) {
  const db = getDb();
  return db
    .select({
      id: dsarSystems.id,
      name: dsarSystems.name,
      ownerName: dsarSystems.ownerName,
      ownerEmail: dsarSystems.ownerEmail,
      active: dsarSystems.active,
    })
    .from(processingActivitySystems)
    .innerJoin(dsarSystems, eq(processingActivitySystems.systemId, dsarSystems.id))
    .where(eq(processingActivitySystems.activityId, activityId));
}
