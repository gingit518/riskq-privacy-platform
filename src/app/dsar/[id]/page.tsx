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
import { updateDsarStatus, verifyIdentity, toggleChecklistItem } from "../actions";
import ResponseTemplates from "@/components/ResponseTemplates";
import DsarChecklist from "@/components/DsarChecklist";

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
