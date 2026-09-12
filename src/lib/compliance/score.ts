// Compliance Dashboard scoring (PRD §5.8, Phase 5). Computed live on every
// page load — no persisted "compliance_scores" table, same choice already
// made for /assessments (getMaturityByFunction reads org_controls live
// rather than caching a number).
//
// Per Ariel's explicit call (2026-09-12): simple, unweighted % complete,
// blended across whichever of the three signals below are actually
// measurable for a given regulation — never counting a missing signal as 0.
//
// A real granularity gap, flagged rather than quietly worked around:
// org_obligations and dsar_requests are both tagged to a specific
// regulation acronym (e.g. "GDPR"), but org_controls/controls_library are
// only tagged to a broad jurisdiction group ("US Federal"/"US State"/
// "International" — see controls/data.ts). So "controls implemented %" for
// a specific regulation is really "controls implemented % for every
// regulation in that group" — coarser than the other two signals. Flagged
// in the UI itself, not presented as regulation-specific precision it
// doesn't have.

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orgObligations, orgControls, controlsLibrary, dsarRequests } from "@/lib/db/schema";
import { getLatestScopeWithMetadata } from "@/lib/scope";

export interface RegulationScore {
  acronym: string;
  name: string;
  group: string;
  obligationsPct: number | null; // null = no obligations tracked for this regulation
  dsarSlaPct: number | null; // null = no closed DSAR requests with a measurable SLA
  controlsPct: number | null; // group-level, see header comment; null = no controls tagged to this group
  blendedScore: number | null; // unweighted average of whichever of the above are non-null
}

export interface ComplianceSummary {
  perRegulation: RegulationScore[];
  overallScore: number | null; // unweighted average of blendedScore across in-scope regs
  hasScopeRun: boolean;
}

function pct(done: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round((done / total) * 1000) / 10; // one decimal
}

export async function computeComplianceSummary(orgId: string): Promise<ComplianceSummary> {
  const scope = await getLatestScopeWithMetadata(orgId);
  if (!scope) return { perRegulation: [], overallScore: null, hasScopeRun: false };

  const inScope = scope.results.filter((r) => r.inScope);
  if (inScope.length === 0) return { perRegulation: [], overallScore: null, hasScopeRun: true };

  const db = getDb();

  const [obligationRows, dsarRows, controlRows, libraryRows] = await Promise.all([
    db.select().from(orgObligations).where(eq(orgObligations.orgId, orgId)),
    db.select().from(dsarRequests).where(eq(dsarRequests.orgId, orgId)),
    db.select().from(orgControls).where(eq(orgControls.orgId, orgId)),
    db.select().from(controlsLibrary),
  ]);

  const controlStatusByControlId = new Map(controlRows.map((r) => [r.controlId, r.status]));

  const perRegulation: RegulationScore[] = inScope.map((reg) => {
    // Obligations: exact regulation-acronym match.
    const regObligations = obligationRows.filter((o) => o.regulationAcronym === reg.acronym);
    const obligationsPct =
      regObligations.length > 0
        ? pct(regObligations.filter((o) => o.status === "done").length, regObligations.length)
        : null;

    // DSAR: closed requests (completed/denied) governed by this regulation,
    // with a measurable SLA (slaDueAt not null) — open requests haven't
    // resolved yet, and a null SLA means no in-scope regulation had a
    // parseable response window, so there's nothing to measure against.
    const regClosedWithSla = dsarRows.filter(
      (d) =>
        d.governingRegulationAcronym === reg.acronym &&
        (d.status === "completed" || d.status === "denied") &&
        d.slaDueAt !== null &&
        d.closedAt !== null
    );
    const dsarSlaPct =
      regClosedWithSla.length > 0
        ? pct(
            regClosedWithSla.filter((d) => (d.closedAt as Date) <= (d.slaDueAt as Date)).length,
            regClosedWithSla.length
          )
        : null;

    // Controls: group-level only (see header comment).
    const groupControlIds = libraryRows
      .filter((c) => (c.regulationGroupsTag as string[]).includes(reg.group))
      .map((c) => c.id);
    const implementedInGroup = groupControlIds.filter(
      (id) => controlStatusByControlId.get(id) === "implemented"
    ).length;
    const controlsPct = groupControlIds.length > 0 ? pct(implementedInGroup, groupControlIds.length) : null;

    const components = [obligationsPct, dsarSlaPct, controlsPct].filter(
      (v): v is number => v !== null
    );
    const blendedScore =
      components.length > 0
        ? Math.round((components.reduce((a, b) => a + b, 0) / components.length) * 10) / 10
        : null;

    return {
      acronym: reg.acronym,
      name: reg.name,
      group: reg.group,
      obligationsPct,
      dsarSlaPct,
      controlsPct,
      blendedScore,
    };
  });

  const scored = perRegulation.filter((r): r is RegulationScore & { blendedScore: number } => r.blendedScore !== null);
  const overallScore =
    scored.length > 0
      ? Math.round((scored.reduce((a, b) => a + b.blendedScore, 0) / scored.length) * 10) / 10
      : null;

  return { perRegulation, overallScore, hasScopeRun: true };
}
