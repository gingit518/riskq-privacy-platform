// Per-org, configurable DSAR checklists (PRD §5.3 "internal task
// routing/checklist"). Not a "use server" actions file — imported by both
// the authenticated dsar/actions.ts and the unauthenticated
// intake/[slug]/actions.ts, so the seeding/snapshot logic lives once here.

import { asc, eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { dsarChecklistTemplates, dsarChecklistItems } from "@/lib/db/schema";
import { DEFAULT_CHECKLIST_ITEMS } from "./checklist-defaults";
import type { DsarRequestType } from "./types";

/** Seeds the default checklist for (org, request type) the first time this
 * combination is touched. Safe to call repeatedly — a no-op once any row
 * exists for that org+type, even if the org has since edited or removed
 * items (so an org that deliberately empties a checklist doesn't get it
 * silently re-seeded on the next request). */
export async function ensureChecklistTemplateSeeded(
  orgId: string,
  requestType: DsarRequestType
): Promise<void> {
  const db = getDb();
  const existing = await db
    .select({ id: dsarChecklistTemplates.id })
    .from(dsarChecklistTemplates)
    .where(
      and(
        eq(dsarChecklistTemplates.orgId, orgId),
        eq(dsarChecklistTemplates.requestType, requestType)
      )
    )
    .limit(1);
  if (existing.length > 0) return;

  const defaults = DEFAULT_CHECKLIST_ITEMS[requestType];
  await db.insert(dsarChecklistTemplates).values(
    defaults.map((label, i) => ({
      orgId,
      requestType,
      label,
      sortOrder: i,
    }))
  );
}

export async function getChecklistTemplate(orgId: string, requestType: DsarRequestType) {
  await ensureChecklistTemplateSeeded(orgId, requestType);
  const db = getDb();
  return db
    .select()
    .from(dsarChecklistTemplates)
    .where(
      and(
        eq(dsarChecklistTemplates.orgId, orgId),
        eq(dsarChecklistTemplates.requestType, requestType)
      )
    )
    .orderBy(asc(dsarChecklistTemplates.sortOrder));
}

/** Copies the current template into a fresh set of checklist items tied to
 * one request — a snapshot, not a live reference, so editing the template
 * later never changes an already-open request's checklist. */
export async function snapshotChecklistForRequest(
  requestId: string,
  orgId: string,
  requestType: DsarRequestType
): Promise<void> {
  const template = await getChecklistTemplate(orgId, requestType);
  if (template.length === 0) return;

  const db = getDb();
  await db.insert(dsarChecklistItems).values(
    template.map((item) => ({
      requestId,
      label: item.label,
      sortOrder: item.sortOrder,
    }))
  );
}
