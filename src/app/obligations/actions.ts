"use server";

// Business Obligations (PRD §5.2, Phase 2).
//
// Obligations are synced FROM the latest org_regulation_scope run (§5.1's
// "single input every other module reads from"), not entered by hand — the
// obligation text comes from the `obls` field already present on each ported
// REGS entry (see regulations/types.ts), via the versioned regulation_sets
// metadata snapshot tied to that specific scope run (not live REGS), so the
// obligation text stays consistent with whatever was actually in scope at
// that point in time even if REGS content changes later.
//
// Sync is additive-only: re-running it after a new "Analyze scope" only
// inserts rows for obligations that are newly in scope. It never deletes or
// resets an existing row's status/owner/notes, and it never removes a row
// just because its regulation fell out of scope on a later run — that
// history is the audit trail §5.2 asks for. The page flags "no longer in
// current scope" instead of deleting.

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orgObligations, orgRegulationScope, regulationSets } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
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
async function getLatestScopeWithMetadata(orgId: string) {
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

/** Inserts a not_started obligation row for every obligation text on every
 * currently in-scope regulation, skipping any that already exist. Safe to
 * call repeatedly (e.g. every time /obligations is visited). */
export async function syncObligationsFromScope(): Promise<void> {
  const session = await requireSession();
  if (!session) return;

  const scope = await getLatestScopeWithMetadata(session.orgId);
  if (!scope) return; // no profile analyzed yet — page handles this state

  const inScopeAcronyms = new Set(
    scope.results.filter((r) => r.inScope).map((r) => r.acronym)
  );

  const rows: Array<{
    orgId: string;
    regulationAcronym: string;
    regulationName: string;
    obligationText: string;
  }> = [];

  for (const reg of scope.metadata) {
    if (!inScopeAcronyms.has(reg.acronym)) continue;
    for (const obligationText of reg.obls ?? []) {
      if (!obligationText) continue;
      rows.push({
        orgId: session.orgId,
        regulationAcronym: reg.acronym,
        regulationName: reg.name,
        obligationText,
      });
    }
  }

  if (rows.length === 0) return;

  const db = getDb();
  await db.insert(orgObligations).values(rows).onConflictDoNothing();
  revalidatePath("/obligations");
}

export async function updateObligation(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;

  const id = String(formData.get("id") || "");
  if (!id) return;

  const status = String(formData.get("status") || "not_started") as
    | "not_started"
    | "in_progress"
    | "done"
    | "not_applicable";
  const owner = String(formData.get("owner") || "");
  const dueDateRaw = String(formData.get("dueDate") || "");
  const evidenceNote = String(formData.get("evidenceNote") || "");

  const db = getDb();
  await db
    .update(orgObligations)
    .set({
      status,
      owner,
      dueDate: dueDateRaw ? new Date(dueDateRaw) : null,
      evidenceNote,
      updatedAt: new Date(),
    })
    // orgId check keeps this tenant-scoped even though there's no RLS yet
    // (PRD Appendix A known gap) — application-layer isolation still applies
    // to every write, not just reads.
    .where(and(eq(orgObligations.id, id), eq(orgObligations.orgId, session.orgId)));

  revalidatePath("/obligations");
}

export async function getCurrentInScopeAcronyms(orgId: string): Promise<Set<string>> {
  const scope = await getLatestScopeWithMetadata(orgId);
  if (!scope) return new Set();
  return new Set(scope.results.filter((r) => r.inScope).map((r) => r.acronym));
}
