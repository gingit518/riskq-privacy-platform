// Tracking Technologies registry (PRD §5.6, Phase 5). Manual/import only —
// nothing here scans a customer's site (that's the deferred Phase 6 CMP
// build, PRD §5.9). See schema.ts for the active/retire pattern.

import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { trackingTechnologies } from "@/lib/db/schema";
import { getInScopeRegulationMetadata } from "@/lib/scope";
import { regulationRequiresTrackingConsent } from "@/lib/regulations/tracking-consent-tags";
import type { TrackingCategory, TrackingParty } from "./types";

export interface AddTrackingTechParams {
  orgId: string;
  createdBy: string;
  name: string;
  purpose: string;
  category: TrackingCategory;
  party: TrackingParty;
  retention: string;
}

export async function addTrackingTechnology(params: AddTrackingTechParams): Promise<string> {
  const db = getDb();
  const [row] = await db
    .insert(trackingTechnologies)
    .values({
      orgId: params.orgId,
      createdBy: params.createdBy,
      name: params.name,
      purpose: params.purpose,
      category: params.category,
      party: params.party,
      retention: params.retention,
    })
    .returning({ id: trackingTechnologies.id });
  return row.id;
}

export async function listTrackingTechnologies(orgId: string) {
  const db = getDb();
  return db
    .select()
    .from(trackingTechnologies)
    .where(eq(trackingTechnologies.orgId, orgId))
    .orderBy(trackingTechnologies.name);
}

export async function setTrackingTechnologyActive(
  orgId: string,
  id: string,
  active: boolean
): Promise<void> {
  const db = getDb();
  await db
    .update(trackingTechnologies)
    .set({ active, updatedAt: new Date() })
    .where(and(eq(trackingTechnologies.id, id), eq(trackingTechnologies.orgId, orgId)));
}

/** The informational "which of your in-scope regulations require
 * cookie/tracker consent" list this registry is "tied to" per §5.6 — see
 * schema.ts header comment for why this is a curated tag, not a live scan or
 * a per-entry auto-decision. Empty array means either no scope run yet or
 * none of the in-scope regulations carry the tag. */
export async function listConsentRequiredRegulationsInScope(
  orgId: string
): Promise<Array<{ acronym: string; name: string }>> {
  const inScope = await getInScopeRegulationMetadata(orgId);
  return inScope
    .filter((reg) => regulationRequiresTrackingConsent(reg.acronym))
    .map((reg) => ({ acronym: reg.acronym, name: reg.name }));
}
