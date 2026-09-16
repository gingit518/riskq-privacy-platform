// "My Pending" — one queue across every area a user has real per-user
// assignment in, for the Management Summary View (PRD §5.11, 2026-09-16).
//
// Coverage is intentionally uneven, matching what the schema actually
// supports today (checked before building, not guessed):
// - Obligations, DSAR: via the new `ownerId` column (2026-09-16 migration).
// - RoPA/DPIA: via the existing `processing_activities.createdBy` and
//   `dpia_assessments.createdBy`/`completedBy` — real user FKs that
//   predate this feature.
// - Controls: explicitly NOT included. org_controls has no owner/assignee
//   field at all, and adding one wasn't part of what Ariel asked for on
//   2026-09-16 — flagged in the PRD as a separate call, not silently
//   folded in here.
// - Transfers, Tracking Technology: same reason as Controls — no per-user
//   assignment field exists on international_transfers or
//   tracking_technologies.

import { and, eq, ne, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  orgObligations,
  dsarRequests,
  processingActivities,
  dpiaAssessments,
} from "@/lib/db/schema";

export type PendingItemKind = "obligation" | "dsar" | "ropa_dpia";

export interface PendingItem {
  kind: PendingItemKind;
  id: string;
  title: string;
  detail: string;
  href: string;
}

export async function listMyPending(orgId: string, userId: string): Promise<PendingItem[]> {
  const db = getDb();
  const items: PendingItem[] = [];

  const obligations = await db
    .select()
    .from(orgObligations)
    .where(
      and(
        eq(orgObligations.orgId, orgId),
        eq(orgObligations.ownerId, userId),
        ne(orgObligations.status, "done"),
        ne(orgObligations.status, "not_applicable")
      )
    );
  for (const o of obligations) {
    items.push({
      kind: "obligation",
      id: o.id,
      title: `${o.regulationAcronym} obligation`,
      detail: o.obligationText,
      href: "/obligations",
    });
  }

  const dsars = await db
    .select()
    .from(dsarRequests)
    .where(
      and(
        eq(dsarRequests.orgId, orgId),
        eq(dsarRequests.ownerId, userId),
        ne(dsarRequests.status, "completed"),
        ne(dsarRequests.status, "denied")
      )
    );
  for (const r of dsars) {
    items.push({
      kind: "dsar",
      id: r.id,
      title: `DSAR — ${r.requesterName}`,
      detail: `${r.status.replace("_", " ")}${r.slaDueAt ? ` — due ${new Date(r.slaDueAt).toLocaleDateString()}` : ""}`,
      href: `/dsar/${r.id}`,
    });
  }

  // RoPA/DPIA: an activity is "pending" for its creator either because it
  // has no DPIA yet and one is recommended (see needsDpiaReview in
  // assessments/ropa.ts — duplicated inline below rather than imported to
  // avoid pulling the whole ropa.ts module in for one boolean check), or
  // because a DPIA exists but is still in draft. Activities that don't need
  // a DPIA and have none are just data-mapping records, not pending work —
  // they're excluded here, same reasoning as leaving RoPA out of the
  // status-bucket view entirely.
  const activities = await db
    .select()
    .from(processingActivities)
    .where(and(eq(processingActivities.orgId, orgId), eq(processingActivities.createdBy, userId)));

  const dpias = await db
    .select()
    .from(dpiaAssessments)
    .where(
      and(
        eq(dpiaAssessments.orgId, orgId),
        or(eq(dpiaAssessments.createdBy, userId), eq(dpiaAssessments.completedBy, userId))
      )
    );
  const dpiaByActivity = new Map(dpias.map((d) => [d.activityId, d]));

  for (const a of activities) {
    const needsDpia = a.specialCategoryData || a.largeScaleProcessing || a.automatedDecisionMaking;
    const dpia = dpiaByActivity.get(a.id);
    if (dpia && dpia.status === "draft") {
      items.push({
        kind: "ropa_dpia",
        id: dpia.id,
        title: `DPIA in progress — ${a.name}`,
        detail: "Draft, not yet completed.",
        href: `/ropa/${a.id}/dpia`,
      });
    } else if (!dpia && needsDpia) {
      items.push({
        kind: "ropa_dpia",
        id: a.id,
        title: `DPIA recommended — ${a.name}`,
        detail: "Flagged (special-category data, large-scale processing, or automated decision-making) — not started.",
        href: `/ropa/${a.id}/dpia`,
      });
    }
  }

  // Also surface a DPIA someone else created but this user is completing —
  // covered by the `or(createdBy, completedBy)` filter above, but only if
  // it's still in draft; a completed one isn't pending.
  for (const d of dpias) {
    if (d.status !== "draft") continue;
    if (activities.some((a) => a.id === d.activityId)) continue; // already added above
    items.push({
      kind: "ropa_dpia",
      id: d.id,
      title: "DPIA in progress",
      detail: "Draft, not yet completed.",
      href: `/ropa/${d.activityId}/dpia`,
    });
  }

  return items;
}
