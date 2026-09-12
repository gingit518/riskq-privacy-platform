import { redirect, notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { dsarRequests, dsarChecklistItems, dsarEvents, orgs } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import Nav from "@/components/Nav";
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
    <>
      <Nav />
      <main style={{ maxWidth: 800, margin: "40px auto", fontFamily: "system-ui", padding: "0 16px" }}>
        <h1>{request.requesterName}</h1>
        <p style={{ color: "#666" }}>{request.requesterEmail}</p>

        {legalHold && (
          <div
            style={{
              background: "#fff3cd",
              border: "1px solid #ffe58f",
              borderRadius: 4,
              padding: 12,
              marginBottom: 16,
            }}
          >
            <strong>⚠ Active legal hold matches this requester.</strong>{" "}
            {legalHold.matter || "No matter description on file."} — review before
            responding (see <a href="/dsar/legal-holds">Legal Holds</a>). This is a
            flag, not a block; whether it justifies withholding data is a legal
            judgment call.
          </div>
        )}

        <table style={{ marginBottom: 24 }}>
          <tbody>
            <tr>
              <td style={{ paddingRight: 16, color: "#666" }}>Type</td>
              <td>{DSAR_REQUEST_TYPE_LABELS[request.requestType]}</td>
            </tr>
            <tr>
              <td style={{ paddingRight: 16, color: "#666" }}>Source</td>
              <td>{request.source === "public" ? "Public intake form" : "Logged internally"}</td>
            </tr>
            <tr>
              <td style={{ paddingRight: 16, color: "#666" }}>Governing regulation</td>
              <td>
                {request.governingRegulationName
                  ? `${request.governingRegulationName} (${request.governingRegulationAcronym})`
                  : "None — no in-scope regulation has a statutory response window"}
              </td>
            </tr>
            <tr>
              <td style={{ paddingRight: 16, color: "#666" }}>Due date</td>
              <td>
                {request.slaDueAt ? fmtDateTime(request.slaDueAt) : "No enforced deadline"}
                {request.slaIsBusinessDays && (
                  <span style={{ color: "#666", fontSize: 12 }}>
                    {" "}
                    (statute specifies business/working days — this date approximates using
                    calendar days)
                  </span>
                )}
              </td>
            </tr>
            <tr>
              <td style={{ paddingRight: 16, color: "#666" }}>Identity verified</td>
              <td>
                {request.identityVerified ? (
                  `Yes, ${fmtDateTime(request.identityVerifiedAt)}`
                ) : (
                  <form action={verifyIdentity} style={{ display: "inline" }}>
                    <input type="hidden" name="id" value={request.id} />
                    <button type="submit">Mark identity verified</button>
                  </form>
                )}
              </td>
            </tr>
          </tbody>
        </table>

        <h2>Status &amp; assignment</h2>
        <form action={updateDsarStatus} style={{ marginBottom: 24 }}>
          <input type="hidden" name="id" value={request.id} />
          <label style={{ display: "block", marginBottom: 8 }}>
            Status
            <select name="status" defaultValue={request.status} style={{ display: "block" }}>
              {DSAR_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {DSAR_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "block", marginBottom: 8 }}>
            Owner
            <input name="owner" defaultValue={request.owner} style={{ display: "block", width: 300 }} />
          </label>
          <label style={{ display: "block", marginBottom: 8 }}>
            Notes
            <textarea
              name="notes"
              defaultValue={request.notes}
              rows={3}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <button type="submit">Save</button>
        </form>

        <h2>Checklist</h2>
        <DsarChecklist requestId={request.id} items={checklist} toggleAction={toggleChecklistItem} />

        <h2>
          Systems to check (<a href="/dsar/systems">manage register</a>)
        </h2>
        <SystemTasks requestId={request.id} tasks={systemTasks} toggleAction={toggleSystemTask} />

        <h2>
          Fulfillment — connected systems (<a href="/connectors">manage connectors</a>)
        </h2>
        <p style={{ color: "#666", fontSize: 13 }}>
          Searches connected systems (exact email match only) for this
          requester&apos;s data. Nothing is exported or deleted automatically
          — every match below requires explicit approval first, and a
          proposed delete is blocked outright if this requester is under an
          active legal hold.
        </p>
        {connectedConnectors.length === 0 ? (
          <p style={{ fontSize: 14 }}>
            No connectors connected yet. <a href="/connectors">Connect one</a> to
            search it for this requester&apos;s data.
          </p>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {connectedConnectors.map((c) => (
                <form action={runFulfillmentSearchAction} key={c.connectorId}>
                  <input type="hidden" name="requestId" value={request.id} />
                  <input type="hidden" name="connectorId" value={c.connectorId} />
                  <button type="submit">Search {c.label}</button>
                </form>
              ))}
            </div>
            {runsWithMatches.map(({ run, matches }) => (
              <div
                key={run.id}
                style={{ border: "1px solid #eee", borderRadius: 4, padding: 12, marginBottom: 12 }}
              >
                <strong>{connectorLabelOf(run.connectorId)}</strong>{" "}
                <span style={{ fontSize: 13, color: "#666" }}>
                  — {run.status}
                  {run.errorDetail && ` (${run.errorDetail})`}
                </span>
                {matches.length > 0 && (
                  <ul style={{ fontSize: 13, paddingLeft: 16 }}>
                    {matches.map((m) => (
                      <li key={m.id} style={{ marginBottom: 4 }}>
                        <strong>{m.externalObjectType}</strong>{" "}
                        {Object.values(m.snapshot as Record<string, string>).join(" — ")}{" "}
                        <span style={{ color: "#666" }}>(proposed: {m.requestedAction})</span>
                        {m.decision === "pending" ? (
                          <span style={{ marginLeft: 8 }}>
                            <form action={decideMatchAction} style={{ display: "inline" }}>
                              <input type="hidden" name="requestId" value={request.id} />
                              <input type="hidden" name="matchId" value={m.id} />
                              <input type="hidden" name="decision" value="approved" />
                              <button type="submit">Approve</button>
                            </form>{" "}
                            <form action={decideMatchAction} style={{ display: "inline" }}>
                              <input type="hidden" name="requestId" value={request.id} />
                              <input type="hidden" name="matchId" value={m.id} />
                              <input type="hidden" name="decision" value="rejected" />
                              <button type="submit">Reject</button>
                            </form>
                          </span>
                        ) : (
                          <span style={{ marginLeft: 8, color: m.decision === "rejected" ? "#999" : "#333" }}>
                            {m.decision}
                            {m.result !== "pending" && ` — ${m.result}${m.resultDetail ? `: ${m.resultDetail}` : ""}`}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {matches.some((m) => m.decision === "approved" && m.result === "pending") && (
                  <form action={executeApprovedMatchesAction}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <input type="hidden" name="runId" value={run.id} />
                    <button type="submit">Execute approved</button>
                  </form>
                )}
              </div>
            ))}
          </>
        )}

        <h2>Compiled export / evidence files</h2>
        <p style={{ color: "#666", fontSize: 13 }}>
          Attach the file(s) the response should deliver. Stored as a private
          file — not a public link — readable only through the emailed,
          expiring download link below.
        </p>
        {attachedFiles.length > 0 && (
          <ul style={{ fontSize: 14 }}>
            {attachedFiles.map((f) => (
              <li key={f.id}>
                {f.fileName} — {(f.sizeBytes / 1024).toFixed(0)}KB, uploaded{" "}
                {fmtDateTime(f.uploadedAt)}
              </li>
            ))}
          </ul>
        )}
        <form
          action={uploadDsarEvidence}
          encType="multipart/form-data"
          style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 24 }}
        >
          <input type="hidden" name="requestId" value={request.id} />
          <input type="file" name="file" required />
          <button type="submit">Attach file</button>
        </form>

        <h2>Send response</h2>
        <p style={{ color: "#666", fontSize: 13 }}>
          Emails the completion template below to {request.requesterEmail}. If
          file(s) are attached above, a secure, expiring (7-day) download
          link is generated and included automatically. This does not change
          the request&apos;s status — set that explicitly above once you
          confirm the response went out.
        </p>
        <form action={sendDsarResponse} style={{ marginBottom: 24 }}>
          <input type="hidden" name="requestId" value={request.id} />
          <button type="submit">Send response now</button>
        </form>

        <ResponseTemplates templates={templates} />

        <h2>Audit trail</h2>
        <ul style={{ fontSize: 13, color: "#444" }}>
          {events.map((e) => (
            <li key={e.id}>
              {fmtDateTime(e.createdAt)} — {e.detail}
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
