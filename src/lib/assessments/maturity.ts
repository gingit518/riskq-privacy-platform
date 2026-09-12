// Readiness/maturity scoring (PRD §5.5, Phase 4) — reuses the NIST CSF
// categories already seeded for Cyber Controls (controls_library) rather
// than a second framework, per Ariel's explicit call. Aggregates
// org_controls.maturityLevel by NIST Function to produce a "maturity score
// per module" in the PRD's own words, using Function (Govern/Identify/
// Protect/Detect/Respond/Recover) as the natural grouping since that's
// coarser than the 22 Categories and reads as a dashboard-level summary.

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { controlsLibrary, orgControls } from "@/lib/db/schema";
import { MATURITY_LEVEL_SCORE, type MaturityLevel } from "./types";

export interface FunctionMaturity {
  function: string;
  assessedCount: number;
  totalCount: number;
  averageScore: number | null; // null if nothing assessed yet
}

export async function getMaturityByFunction(orgId: string): Promise<FunctionMaturity[]> {
  const db = getDb();

  // Left-join semantics done in app code: start from the full library (so a
  // function with zero assessed controls still shows up as 0/N, not
  // missing entirely), then overlay this org's org_controls rows.
  const library = await db.select().from(controlsLibrary);
  const orgRows = await db.select().from(orgControls).where(eq(orgControls.orgId, orgId));
  const byControlId = new Map(orgRows.map((r) => [r.controlId, r]));

  const byFunction = new Map<string, { total: number; assessedScores: number[] }>();
  for (const control of library) {
    const bucket = byFunction.get(control.function) ?? { total: 0, assessedScores: [] };
    bucket.total += 1;
    const orgRow = byControlId.get(control.id);
    const level = (orgRow?.maturityLevel ?? "not_assessed") as MaturityLevel;
    if (level !== "not_assessed") {
      bucket.assessedScores.push(MATURITY_LEVEL_SCORE[level]);
    }
    byFunction.set(control.function, bucket);
  }

  return Array.from(byFunction.entries())
    .map(([fn, bucket]) => ({
      function: fn,
      assessedCount: bucket.assessedScores.length,
      totalCount: bucket.total,
      averageScore:
        bucket.assessedScores.length > 0
          ? bucket.assessedScores.reduce((a, b) => a + b, 0) / bucket.assessedScores.length
          : null,
    }))
    .sort((a, b) => a.function.localeCompare(b.function));
}
