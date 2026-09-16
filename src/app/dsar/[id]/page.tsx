import { redirect, notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { dsarRequests, dsarChecklistItems, dsarEvents, orgs } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import AppShell from "@/components/AppShell";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import { DSAR_STATUS_BADGE } from "@/lib/dsar/status-badge";
import {
  DSAR_REQUEST_TYPE_LABELS,
  DSAR_STATUSES,
  DSAR_STATUS_LABELS,
} from "@/lib/dsar/types";
import {
  acknowledgmentTemplate,
  completionTemplate,
  denialTemplate,
} from "@/lib/dsar/templates";
import { findActiveLegalHold } from "@/lib/dsar/legal-holds";
import { listSystemTasks } from "@/lib/dsar/systems";
import { listEvidenceForDsarRequest } from "@/lib/evidence";
import { listRunsWithMatches } from "@/lib/dsar/connector-fulfillment";
import { listConnections } from "@/lib/connectors/connections";
import { listConnectorInfo } from "@/lib/connectors/registry";
import { listOrgUsers } from "@/lib/org/users";
import {
  updateDsarStatus,
  verifyIdentity,
  toggleChecklistItem,
  toggleSystemTask,
  uploadDsarEvidence,
  sendDsarResponse,
  runFulfillmentSearchAction,
  decideMatchAction,
  executeApprovedMatchesAction,
} from "../actions";
import ResponseTemplates from "@/components/ResponseTemplates";
import DsarChecklist from "@/components/DsarChecklist";
import SystemTasks from "@/components/SystemTasks";

function fmtDateTime(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

/** DSAR request detail/fulfillment workflow (PRD §5.4/§5.10), reskinned in
 * the PrivacyQ "Harbor" UI pass Batch 5 (PRD §5.12) — the heaviest single
 * page in the app, given its own batch rather than folded into Batch 3/4.
 * Every section below is the same data/query/action as the original build;
 * only presentation changed (Card per section, Badge for status/decision
 * state, Button for actions). DsarChecklist.tsx/SystemTasks.tsx/
 * ResponseTemplates.tsx got a light token/Button touch-up too (still the
 * same client components, same server actions, same auto-submit-on-change
 * behavior) so they don't look out of place inside the new Card shells. */
export default async function DsarRequestDetailPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session) redirect("/login");

  const db = getDb();
  const [request] = await db
    .select()
    .from(dsarRequests)
    .where(and(eq(dsarRequests.id, params.id), eq(dsarRequests.orgId, session.orgId)))
    .limit(1);
  if (!request) notFound();

  const [org] = await db.select().from(orgs).where(eq(orgs.id, session.orgId)).limit(1);
  const orgName = org?.name ?? "your organization";

  const checklist = await db
    .select()
    .from(dsarChecklistItems)
    .where(eq(dsarChecklistItems.requestId, request.id))
    .orderBy(asc(dsarChecklistItems.sortOrder));

  const events = await db
    .select()
    .from(dsarEvents)
    .where(eq(dsarEvents.requestId, request.id))
    .orderBy(desc(dsarEvents.createdAt));

  const legalHold = await findActiveLegalHold(session.orgId, request.requesterEmail);
  const systemTasks = await listSystemTasks(session.orgId, request.id);
  const attachedFiles = await listEvidenceForDsarRequest(session.orgId, request.id);

  const connectorLabels = new Map(listConnectorInfo().map((c) => [c.id, c.label]));
  const connectorLabelOf = (id: string) => connectorLabels.get(id as never) ?? id;
  const allConnections = await listConnections(session.orgId);
  const connectedConnectors = allConnections
    .filter((c) => c.active)
    .map((c) => ({ connectorId: c.connectorId, label: connectorLabelOf(c.connectorId) }));
  const runsWithMatches = await listRunsWithMatches(session.orgId, request.id);
  const orgUsers = await listOrgUsers(session.orgId);

  const dueDateText = request.slaDueAt ? fmtDateTime(request.slaDueAt) : "";

  const templates = {
    acknowledgment: acknowledgmentTemplate({
      requesterName: request.requesterName,
      orgName,
      requestTypeLabel: DSAR_REQUEST_TYPE_LABELS[request.requestType],
      dueDateText,
    }),
    completion: completionTemplate({
      requesterName: request.requesterName,
      orgName,
      requestType: request.requestType,
      downloadLink: '(a secure link will be generated when you click "Send response" below)',
    }),
    denial: denialTemplate({
      requesterName: request.requesterName,
      orgName,
      requestTypeLabel: DSAR_REQUEST_TYPE_LABELS[request.requestType],
    }),
  };

  return (
    <AppShell>
      <div style={{ padding: "24px 28px", maxWidth: 860, display: "grid", gap: 18 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0 }}>{request.requesterName}</h1>
            <Badge variant={DSAR_STATUS_BADGE[request.status]}>{DSAR_STATUS_LABELS[request.status]}</Badge>
          </div>
          <p style={{ color: "var(--pq-ink-muted)", margin: "4px 0 0" }}>{request.requesterEmail}</p>
        </div>

        {legalHold && (
          <div
            style={{
              background: "var(--pq-warning-bg)",
              border: "1px solid var(--pq-warning)",
              borderRadius: 10,
              padding: 14,
              fontSize: 13.5,
            }}
          >
            <strong style={{ color: "var(--pq-warning)" }}>⚠ Active legal hold matches this requester.</strong>{" "}
            {legalHold.matter || "No matter description on file."} — review before responding
            (see <a href="/dsar/legal-holds">Legal Holds</a>). This is a flag, not a block;
            whether it justifies withholding data is a legal judgment call.
          </div>
        )}

        <Card title="Request details">
          <table style={{ fontSize: 13.5, borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ padding: "4px 16px 4px 0", color: "var(--pq-ink-muted)" }}>Type</td>
                <td style={{ padding: "4px 0" }}>{DSAR_REQUEST_TYPE_LABELS[request.requestType]}</td>
              </tr>
              <tr>
                <td style={{ padding: "4px 16px 4px 0", color: "var(--pq-ink-muted)" }}>Source</td>
                <td style={{ padding: "4px 0" }}>
                  {request.source === "public" ? "Public intake form" : "Logged internally"}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "4px 16px 4px 0", color: "var(--pq-ink-muted)" }}>Governing regulation</td>
                <td style={{ padding: "4px 0" }}>
                  {request.governingRegulationName
                    ? `${request.governingRegulationName} (${request.governingRegulationAcronym})`
                    : "None — no in-scope regulation has a statutory response window"}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "4px 16px 4px 0", color: "var(--pq-ink-muted)" }}>Due date</td>
                <td style={{ padding: "4px 0" }}>
                  {request.slaDueAt ? fmtDateTime(request.slaDueAt) : "No enforced deadline"}
                  {request.slaIsBusinessDays && (
                    <span style={{ color: "var(--pq-ink-muted)", fontSize: 12 }}>
                      {" "}
                      (statute specifies business/working days — this date approximates using
                      calendar days)
                    </span>
                  )}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "4px 16px 4px 0", color: "var(--pq-ink-muted)" }}>Identity verified</td>
                <td style={{ padding: "4px 0" }}>
                  {request.identityVerified ? (
                    `Yes, ${fmtDateTime(request.identityVerifiedAt)}`
                  ) : (
                    <form action={verifyIdentity} style={{ display: "inline" }}>
                      <input type="hidden" name="id" value={request.id} />
                      <Button type="submit" variant="secondary">
                        Mark identity verified
                      </Button>
                    </form>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </Card>

        <Card title="Status & assignment">
          <form action={updateDsarStatus} style={{ display: "grid", gap: 12 }}>
            <input type="hidden" name="id" value={request.id} />
            <label>
              Status
              <select name="status" defaultValue={request.status} style={{ display: "block", marginTop: 4 }}>
                {DSAR_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {DSAR_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Owner
              <select
                name="ownerId"
                defaultValue={request.ownerId ?? ""}
                style={{ display: "block", width: 300, marginTop: 4 }}
              >
                <option value="">Unassigned</option>
                {orgUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Notes
              <textarea
                name="notes"
                defaultValue={request.notes}
                rows={3}
                style={{ display: "block", width: "100%", marginTop: 4 }}
              />
            </label>
            <div>
              <Button type="submit" variant="primary">
                Save
              </Button>
            </div>
          </form>
        </Card>

        <Card title="Checklist">
          <DsarChecklist requestId={request.id} items={checklist} toggleAction={toggleChecklistItem} />
        </Card>

        <Card
          title={
            <>
              Systems to check (<a href="/dsar/systems">manage register</a>)
            </>
          }
        >
          <SystemTasks requestId={request.id} tasks={systemTasks} toggleAction={toggleSystemTask} />
        </Card>

        <Card
          title={
            <>
              Fulfillment — connected systems (<a href="/connectors">manage connectors</a>)
            </>
          }
        >
          <p style={{ color: "var(--pq-ink-muted)", fontSize: 13, marginTop: 0 }}>
            Searches connected systems (exact email match only) for this requester&apos;s data.
            Nothing is exported or deleted automatically — every match below requires explicit
            approval first, and a proposed delete is blocked outright if this requester is under
            an active legal hold.
          </p>
          {connectedConnectors.length === 0 ? (
            <p style={{ fontSize: 14, margin: 0 }}>
              No connectors connected yet. <a href="/connectors">Connect one</a> to search it for
              this requester&apos;s data.
            </p>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                {connectedConnectors.map((c) => (
                  <form action={runFulfillmentSearchAction} key={c.connectorId}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <input type="hidden" name="connectorId" value={c.connectorId} />
                    <Button type="submit" variant="secondary">
                      Search {c.label}
                    </Button>
                  </form>
                ))}
              </div>
              {runsWithMatches.map(({ run, matches }) => (
                <div
                  key={run.id}
                  style={{
                    border: "1px solid var(--pq-line)",
                    borderRadius: 10,
                    padding: 14,
                    marginBottom: 12,
                  }}
                >
                  <strong style={{ fontSize: 13.5 }}>{connectorLabelOf(run.connectorId)}</strong>{" "}
                  <span style={{ fontSize: 12.5, color: "var(--pq-ink-muted)" }}>
                    — {run.status}
                    {run.errorDetail && ` (${run.errorDetail})`}
                  </span>
                  {matches.length > 0 && (
                    <ul style={{ fontSize: 13, paddingLeft: 16, marginBottom: 0 }}>
                      {matches.map((m) => (
                        <li key={m.id} style={{ marginBottom: 6 }}>
                          <strong>{m.externalObjectType}</strong>{" "}
                          {Object.values(m.snapshot as Record<string, string>).join(" — ")}{" "}
                          <span style={{ color: "var(--pq-ink-muted)" }}>
                            (proposed: {m.requestedAction})
                          </span>
                          {m.decision === "pending" ? (
                            <span style={{ marginLeft: 8, display: "inline-flex", gap: 6 }}>
                              <form action={decideMatchAction} style={{ display: "inline" }}>
                                <input type="hidden" name="requestId" value={request.id} />
                                <input type="hidden" name="matchId" value={m.id} />
                                <input type="hidden" name="decision" value="approved" />
                                <Button type="submit" variant="primary">
                                  Approve
                                </Button>
                              </form>
                              <form action={decideMatchAction} style={{ display: "inline" }}>
                                <input type="hidden" name="requestId" value={request.id} />
                                <input type="hidden" name="matchId" value={m.id} />
                                <input type="hidden" name="decision" value="rejected" />
                                <Button type="submit" variant="ghost">
                                  Reject
                                </Button>
                              </form>
                            </span>
                          ) : (
                            <span style={{ marginLeft: 8 }}>
                              <Badge variant={m.decision === "rejected" ? "neutral" : "success"}>
                                {m.decision}
                              </Badge>
                              {m.result !== "pending" && (
                                <span style={{ color: "var(--pq-ink-muted)", fontSize: 12 }}>
                                  {" "}
                                  — {m.result}
                                  {m.resultDetail ? `: ${m.resultDetail}` : ""}
                                </span>
                              )}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {matches.some((m) => m.decision === "approved" && m.result === "pending") && (
                    <form action={executeApprovedMatchesAction} style={{ marginTop: 8 }}>
                      <input type="hidden" name="requestId" value={request.id} />
                      <input type="hidden" name="runId" value={run.id} />
                      <Button type="submit" variant="primary">
                        Execute approved
                      </Button>
                    </form>
                  )}
                </div>
              ))}
            </>
          )}
        </Card>

        <Card title="Compiled export / evidence files">
          <p style={{ color: "var(--pq-ink-muted)", fontSize: 13, marginTop: 0 }}>
            Attach the file(s) the response should deliver. Stored as a private file — not a
            public link — readable only through the emailed, expiring download link below.
          </p>
          {attachedFiles.length > 0 && (
            <ul style={{ fontSize: 14, paddingLeft: 16 }}>
              {attachedFiles.map((f) => (
                <li key={f.id}>
                  {f.fileName} — {(f.sizeBytes / 1024).toFixed(0)}KB, uploaded {fmtDateTime(f.uploadedAt)}
                </li>
              ))}
            </ul>
          )}
          <form
            action={uploadDsarEvidence}
            encType="multipart/form-data"
            style={{ display: "flex", gap: 8, alignItems: "center" }}
          >
            <input type="hidden" name="requestId" value={request.id} />
            <input type="file" name="file" required />
            <Button type="submit" variant="secondary">
              Attach file
            </Button>
          </form>
        </Card>

        <Card title="Send response">
          <p style={{ color: "var(--pq-ink-muted)", fontSize: 13, marginTop: 0 }}>
            Emails the completion template below to {request.requesterEmail}. If file(s) are
            attached above, a secure, expiring (7-day) download link is generated and included
            automatically. This does not change the request&apos;s status — set that explicitly
            above once you confirm the response went out.
          </p>
          <form action={sendDsarResponse}>
            <input type="hidden" name="requestId" value={request.id} />
            <Button type="submit" variant="primary">
              Send response now
            </Button>
          </form>
        </Card>

        <Card title="Response templates">
          <ResponseTemplates templates={templates} />
        </Card>

        <Card title="Audit trail">
          <ul style={{ fontSize: 13, color: "var(--pq-ink-muted)", margin: 0, paddingLeft: 16 }}>
            {events.map((e) => (
              <li key={e.id}>
                {fmtDateTime(e.createdAt)} — {e.detail}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}
