// Shared "read the latest scope run" helper — extracted out of
// obligations/actions.ts in Phase 3 (DSAR, PRD §5.3) because DSAR needs the
// exact same thing Business Obligations already needed: the org's current
// in-scope regulations, with the *metadata snapshot* tied to the specific
// scope run that produced them (not live REGS, which could have changed
// since) — see regulation_sets in db/schema.ts for why that distinction
// matters for audit purposes.
//
// Single source of truth now so obligations, DSAR, and anything Phase 4+
// adds don't each carry a slightly-diverging copy of this lookup.

import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orgRegulationScope, regulationSets } from "@/lib/db/schema";
import type { RegulationMetadata } from "@/lib/regulations/types";

export interface ScopeRegSummary {
  acronym: string;
  name: string;
  group: string;
  inScope: boolean;
  watch: boolean;
}

/** Reads the latest scope run and its regulation-set metadata together.
 * Returns null if the org has never run "Save & analyze scope" yet. */
export async function getLatestScopeWithMetadata(orgId: string) {
  const db = getDb();
  const [scopeRow] = await db
    .select()
    .from(orgRegulationScope)
    .where(eq(orgRegulationScope.orgId, orgId))
    .orderBy(desc(orgRegulationScope.computedAt))
    .limit(1);
  if (!scopeRow) return null;

  const [regSet] = await db
    .select()
    .from(regulationSets)
    .where(eq(regulationSets.id, scopeRow.regulationSetId))
    .limit(1);
  if (!regSet) return null;

  const results = scopeRow.results as ScopeRegSummary[];
  const metadata = regSet.metadata as RegulationMetadata[];
  return { scopeRow, results, metadata };
}

export async function getCurrentInScopeAcronyms(orgId: string): Promise<Set<string>> {
  const scope = await getLatestScopeWithMetadata(orgId);
  if (!scope) return new Set();
  return new Set(scope.results.filter((r) => r.inScope).map((r) => r.acronym));
}

/** The in-scope regulation metadata rows themselves (not just acronyms) —
 * DSAR's SLA picker needs the `resp` field off each one, which acronyms
 * alone don't carry. */
export async function getInScopeRegulationMetadata(
  orgId: string
): Promise<RegulationMetadata[]> {
  const scope = await getLatestScopeWithMetadata(orgId);
  if (!scope) return [];
  const inScopeAcronyms = new Set(
    scope.results.filter((r) => r.inScope).map((r) => r.acronym)
  );
  return scope.metadata.filter((reg) => inScopeAcronyms.has(reg.acronym));
}
