// Shared DSAR request creation logic — not a "use server" actions file, so
// it can be called from both the authenticated internal-intake action
// (src/app/dsar/actions.ts) and the unauthenticated public-intake action
// (src/app/intake/[slug]/actions.ts) without duplicating the SLA/checklist
// wiring in two places.

import { getDb } from "@/lib/db";
import { dsarRequests, dsarEvents } from "@/lib/db/schema";
import { getInScopeRegulationMetadata } from "@/lib/scope";
import { pickGoverningRegulation, computeDueDate } from "./sla";
import { snapshotChecklistForRequest } from "./checklist";
import type { DsarRequestType } from "./types";

export interface CreateDsarRequestParams {
  orgId: string;
  requesterName: string;
  requesterEmail: string;
  requestType: DsarRequestType;
  source: "internal" | "public";
  /** Authenticated staff member who logged this, for a public submission
   * there is no actor — the "created" event is system-attributed. */
  actorId?: string;
}

export async function createDsarRequest(params: CreateDsarRequestParams): Promise<string> {
  const inScopeRegs = await getInScopeRegulationMetadata(params.orgId);
  const governing = pickGoverningRegulation(inScopeRegs);
  const now = new Date();

  const db = getDb();
  const [row] = await db
    .insert(dsarRequests)
    .values({
      orgId: params.orgId,
      requesterName: params.requesterName,
      requesterEmail: params.requesterEmail,
      requestType: params.requestType,
      source: params.source,
      governingRegulationAcronym: governing?.acronym ?? null,
      governingRegulationName: governing?.name ?? null,
      slaDays: governing?.slaDays ?? null,
      slaIsBusinessDays: governing?.isBusinessDays ?? false,
      slaDueAt: governing ? computeDueDate(now, governing.slaDays) : null,
    })
    .returning({ id: dsarRequests.id });

  await snapshotChecklistForRequest(row.id, params.orgId, params.requestType);

  await db.insert(dsarEvents).values({
    requestId: row.id,
    orgId: params.orgId,
    eventType: "created",
    detail:
      params.source === "public"
        ? "Request submitted via public intake form"
        : "Request logged internally",
    actorId: params.actorId ?? null,
  });

  return row.id;
}
