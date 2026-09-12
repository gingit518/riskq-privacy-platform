// Phase 7 orchestration — search → approval gate → execute, per PRD §5.10/
// §7. See schema.ts's Phase 7 comment for the full set of design decisions
// this implements (narrow V1 search scope, exact-email identity match,
// permanent approval gate, hard legal-hold block on delete, immutable
// per-call event log, no background job queue).

import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  dsarRequests,
  dsarConnectorRuns,
  dsarConnectorMatches,
  dsarConnectorEvents,
} from "@/lib/db/schema";
import { getConnector } from "@/lib/connectors/registry";
import { MAX_RECORDS_PER_RUN } from "@/lib/connectors/config";
import { findActiveLegalHold } from "@/lib/dsar/legal-holds";
import type { MatchedRecord, ConnectorId } from "@/lib/connectors/types";

async function logConnectorEvent(params: {
  requestId: string;
  orgId: string;
  connectorId: ConnectorId;
  eventType: string;
  detail: string;
  actorId?: string;
}): Promise<void> {
  const db = getDb();
  await db.insert(dsarConnectorEvents).values({
    requestId: params.requestId,
    orgId: params.orgId,
    connectorId: params.connectorId,
    eventType: params.eventType,
    detail: params.detail,
    actorId: params.actorId ?? null,
  });
}

/** search() step. One run per (request, connector) call — never reuses or
 * overwrites a prior run for the same connector, so a re-search after
 * connecting a new system keeps the old run's history intact. */
export async function runFulfillmentSearch(params: {
  orgId: string;
  requestId: string;
  connectorId: ConnectorId;
  startedBy: string;
}): Promise<{ ok: boolean; errorDetail?: string }> {
  const db = getDb();
  const [request] = await db
    .select()
    .from(dsarRequests)
    .where(and(eq(dsarRequests.id, params.requestId), eq(dsarRequests.orgId, params.orgId)))
    .limit(1);
  if (!request) return { ok: false, errorDetail: "Request not found." };

  const [run] = await db
    .insert(dsarConnectorRuns)
    .values({
      requestId: params.requestId,
      orgId: params.orgId,
      connectorId: params.connectorId,
      status: "searching",
      startedBy: params.startedBy,
    })
    .returning();

  const connector = getConnector(params.connectorId);
  let matches: MatchedRecord[] = [];
  try {
    matches = await connector.search(params.orgId, request.requesterEmail);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown search error.";
    await db
      .update(dsarConnectorRuns)
      .set({ status: "failed", errorDetail: detail, finishedAt: new Date() })
      .where(eq(dsarConnectorRuns.id, run.id));
    await logConnectorEvent({
      requestId: params.requestId,
      orgId: params.orgId,
      connectorId: params.connectorId,
      eventType: "search_failed",
      detail,
      actorId: params.startedBy,
    });
    return { ok: false, errorDetail: detail };
  }

  const truncated = matches.length > MAX_RECORDS_PER_RUN;
  const capped = matches.slice(0, MAX_RECORDS_PER_RUN);
  // Deletion requests default every match to a proposed delete; every other
  // request type (access/correction/portability/opt-out) defaults to
  // export — correction has no connector action of its own (types.ts), so
  // it still surfaces matches for a human to act on manually.
  const requestedAction: "export" | "delete" = request.requestType === "deletion" ? "delete" : "export";

  if (capped.length > 0) {
    await db.insert(dsarConnectorMatches).values(
      capped.map((m) => ({
        runId: run.id,
        requestId: params.requestId,
        orgId: params.orgId,
        connectorId: params.connectorId,
        externalObjectType: m.externalObjectType,
        externalRecordId: m.externalRecordId,
        snapshot: m.snapshot,
        requestedAction,
      }))
    );
  }

  await db
    .update(dsarConnectorRuns)
    .set({ status: "awaiting_approval", finishedAt: new Date() })
    .where(eq(dsarConnectorRuns.id, run.id));

  await logConnectorEvent({
    requestId: params.requestId,
    orgId: params.orgId,
    connectorId: params.connectorId,
    eventType: "search_completed",
    detail: truncated
      ? `Found ${matches.length} matches, capped at ${MAX_RECORDS_PER_RUN} for review — see README scale constraint.`
      : `Found ${matches.length} matches.`,
    actorId: params.startedBy,
  });

  return { ok: true };
}

/** Human approval/rejection of one matched record. A delete cannot be
 * approved if the requester is under an active legal hold — checked LIVE
 * here (not against any snapshot), same "always re-check, never trust a
 * cached flag" rule as findActiveLegalHold's other call site on the DSAR
 * detail page. Hard block, no override (Ariel's explicit call). */
export async function decideMatch(params: {
  orgId: string;
  matchId: string;
  decision: "approved" | "rejected";
  decidedBy: string;
}): Promise<{ ok: boolean; errorDetail?: string }> {
  const db = getDb();
  const [match] = await db
    .select()
    .from(dsarConnectorMatches)
    .where(and(eq(dsarConnectorMatches.id, params.matchId), eq(dsarConnectorMatches.orgId, params.orgId)))
    .limit(1);
  if (!match) return { ok: false, errorDetail: "Match not found." };

  if (params.decision === "approved" && match.requestedAction === "delete") {
    const [request] = await db
      .select()
      .from(dsarRequests)
      .where(eq(dsarRequests.id, match.requestId))
      .limit(1);
    if (request) {
      const hold = await findActiveLegalHold(params.orgId, request.requesterEmail);
      if (hold) {
        return {
          ok: false,
          errorDetail: `Blocked: ${request.requesterEmail} is under an active legal hold ("${hold.matter || "unnamed matter"}"). Resolve the hold before approving a delete.`,
        };
      }
    }
  }

  await db
    .update(dsarConnectorMatches)
    .set({ decision: params.decision, decidedBy: params.decidedBy, decidedAt: new Date() })
    .where(eq(dsarConnectorMatches.id, params.matchId));
  return { ok: true };
}

/** Execute step — runs export/delete only for matches already decision =
 * "approved". Re-checks the legal hold a second time per delete-record
 * batch (defense in depth against a hold placed between approval and
 * execution — the same reasoning as the live re-check above, not
 * redundant). */
export async function executeApprovedMatches(params: {
  orgId: string;
  runId: string;
  executedBy: string;
}): Promise<{ ok: boolean; errorDetail?: string }> {
  const db = getDb();
  const [run] = await db
    .select()
    .from(dsarConnectorRuns)
    .where(and(eq(dsarConnectorRuns.id, params.runId), eq(dsarConnectorRuns.orgId, params.orgId)))
    .limit(1);
  if (!run) return { ok: false, errorDetail: "Run not found." };

  const [request] = await db
    .select()
    .from(dsarRequests)
    .where(eq(dsarRequests.id, run.requestId))
    .limit(1);
  if (!request) return { ok: false, errorDetail: "Request not found." };

  const approved = await db
    .select()
    .from(dsarConnectorMatches)
    .where(
      and(
        eq(dsarConnectorMatches.runId, params.runId),
        eq(dsarConnectorMatches.decision, "approved"),
        eq(dsarConnectorMatches.result, "pending")
      )
    );
  if (approved.length === 0) return { ok: false, errorDetail: "Nothing approved yet to execute." };

  await db.update(dsarConnectorRuns).set({ status: "executing" }).where(eq(dsarConnectorRuns.id, run.id));

  const hold = await findActiveLegalHold(params.orgId, request.requesterEmail);
  const toDelete = approved.filter((m) => m.requestedAction === "delete");
  const toExport = approved.filter((m) => m.requestedAction === "export");

  if (hold && toDelete.length > 0) {
    await db
      .update(dsarConnectorMatches)
      .set({
        result: "blocked_legal_hold",
        resultDetail: `Blocked at execution time: active legal hold ("${hold.matter || "unnamed matter"}").`,
        executedAt: new Date(),
      })
      .where(
        and(
          eq(dsarConnectorMatches.runId, params.runId),
          eq(dsarConnectorMatches.requestedAction, "delete"),
          eq(dsarConnectorMatches.result, "pending")
        )
      );
    await logConnectorEvent({
      requestId: run.requestId,
      orgId: params.orgId,
      connectorId: run.connectorId,
      eventType: "delete_blocked_legal_hold",
      detail: `${toDelete.length} approved delete(s) blocked — legal hold active.`,
      actorId: params.executedBy,
    });
  }

  const connector = getConnector(run.connectorId);

  if (toExport.length > 0) {
    try {
      const results = await connector.exportRecords(
        params.orgId,
        toExport.map((m) => ({
          externalObjectType: m.externalObjectType,
          externalRecordId: m.externalRecordId,
          snapshot: m.snapshot as Record<string, string>,
        }))
      );
      for (const r of results) {
        const match = toExport.find((m) => m.externalRecordId === r.externalRecordId);
        if (!match) continue;
        await db
          .update(dsarConnectorMatches)
          .set({
            result: r.ok ? "succeeded" : "failed",
            resultDetail: r.errorDetail ?? (r.ok ? "Exported." : ""),
            executedAt: new Date(),
          })
          .where(eq(dsarConnectorMatches.id, match.id));
      }
      await logConnectorEvent({
        requestId: run.requestId,
        orgId: params.orgId,
        connectorId: run.connectorId,
        eventType: "export_executed",
        detail: `Exported ${results.filter((r) => r.ok).length}/${results.length} approved record(s).`,
        actorId: params.executedBy,
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unknown export error.";
      await db
        .update(dsarConnectorMatches)
        .set({ result: "failed", resultDetail: detail, executedAt: new Date() })
        .where(
          and(eq(dsarConnectorMatches.runId, params.runId), eq(dsarConnectorMatches.requestedAction, "export"))
        );
      await logConnectorEvent({
        requestId: run.requestId,
        orgId: params.orgId,
        connectorId: run.connectorId,
        eventType: "export_failed",
        detail,
        actorId: params.executedBy,
      });
    }
  }

  if (!hold && toDelete.length > 0) {
    try {
      const results = await connector.deleteRecords(
        params.orgId,
        toDelete.map((m) => ({
          externalObjectType: m.externalObjectType,
          externalRecordId: m.externalRecordId,
          snapshot: m.snapshot as Record<string, string>,
        }))
      );
      for (const r of results) {
        const match = toDelete.find((m) => m.externalRecordId === r.externalRecordId);
        if (!match) continue;
        await db
          .update(dsarConnectorMatches)
          .set({
            result: r.ok ? "succeeded" : "failed",
            resultDetail: r.errorDetail ?? (r.ok ? "Deleted." : ""),
            executedAt: new Date(),
          })
          .where(eq(dsarConnectorMatches.id, match.id));
      }
      await logConnectorEvent({
        requestId: run.requestId,
        orgId: params.orgId,
        connectorId: run.connectorId,
        eventType: "delete_executed",
        detail: `Deleted ${results.filter((r) => r.ok).length}/${results.length} approved record(s).`,
        actorId: params.executedBy,
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unknown delete error.";
      await db
        .update(dsarConnectorMatches)
        .set({ result: "failed", resultDetail: detail, executedAt: new Date() })
        .where(
          and(eq(dsarConnectorMatches.runId, params.runId), eq(dsarConnectorMatches.requestedAction, "delete"))
        );
      await logConnectorEvent({
        requestId: run.requestId,
        orgId: params.orgId,
        connectorId: run.connectorId,
        eventType: "delete_failed",
        detail,
        actorId: params.executedBy,
      });
    }
  }

  await db
    .update(dsarConnectorRuns)
    .set({ status: "completed", finishedAt: new Date() })
    .where(eq(dsarConnectorRuns.id, run.id));

  return { ok: true };
}

export async function listRunsWithMatches(orgId: string, requestId: string) {
  const db = getDb();
  const runs = await db
    .select()
    .from(dsarConnectorRuns)
    .where(and(eq(dsarConnectorRuns.requestId, requestId), eq(dsarConnectorRuns.orgId, orgId)))
    .orderBy(asc(dsarConnectorRuns.startedAt));

  const matches = await db
    .select()
    .from(dsarConnectorMatches)
    .where(and(eq(dsarConnectorMatches.requestId, requestId), eq(dsarConnectorMatches.orgId, orgId)))
    .orderBy(asc(dsarConnectorMatches.createdAt));

  return runs.map((run) => ({
    run,
    matches: matches.filter((m) => m.runId === run.id),
  }));
}
