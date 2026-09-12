import { redirect } from "next/navigation";
import { desc, inArray } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import Nav from "@/components/Nav";
import { getDb } from "@/lib/db";
import { dsarEvents, dsarRequests } from "@/lib/db/schema";
import { computeComplianceSummary } from "@/lib/compliance/score";

function scoreColor(score: number | null): string {
  if (score === null) return "#f5f5f5";
  if (score >= 80) return "#ecfdf5";
  if (score >= 50) return "#fff7ed";
  return "#fef2f2";
}

function fmt(v: number | null): string {
  return v === null ? "n/a" : `${v}%`;
}

export default async function CompliancePage() {
  const session = await requireSession();
  if (!session) redirect("/login");

  const summary = await computeComplianceSummary(session.orgId);

  // "Recent activity" — DSAR's own append-only event log (dsar_events), the
  // only real audit trail this app has today. Explicitly NOT the "cross-
  // module audit trail" §5.8 asks for: Obligations and Cyber Controls don't
  // emit any events at all (just an updatedAt timestamp), so a genuine
  // cross-module log needs a new generic event table those modules write
  // to — not built in this pass, flagged in README rather than presented as
  // done by relabeling this DSAR-only feed.
  const db = getDb();
  const orgRequestIds = (
    await db.select({ id: dsarRequests.id }).from(dsarRequests)
  ).map((r) => r.id);
  const recentEvents =
    orgRequestIds.length > 0
      ? await db
          .select()
          .from(dsarEvents)
          .where(inArray(dsarEvents.requestId, orgRequestIds))
          .orderBy(desc(dsarEvents.createdAt))
          .limit(15)
      : [];

  return (
    <>
      <Nav />
      <main style={{ maxWidth: 900, margin: "40px auto", fontFamily: "system-ui", padding: "0 16px" }}>
        <h1>Compliance dashboard</h1>
        <p style={{ color: "#666", fontSize: 14 }}>
          A self-reported operational summary, not a certification or legal determination of
          compliance. Blended score = unweighted average of obligations-done %, DSAR SLA-met %,
          and controls-implemented % — the controls figure is measured only at the broad
          jurisdiction-group level (US Federal / US State / International), not per specific
          regulation, since Cyber Controls content isn&apos;t tagged that precisely today. A
          missing signal (no obligations tracked, no closed DSAR requests) is excluded from the
          average, never counted as zero.
        </p>

        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <a href="/compliance/export/csv" style={{ padding: "6px 12px", background: "#f5f5f5", textDecoration: "none", color: "inherit" }}>
            Export CSV
          </a>
          <a href="/compliance/export/pdf" style={{ padding: "6px 12px", background: "#f5f5f5", textDecoration: "none", color: "inherit" }}>
            Export PDF
          </a>
        </div>

        {!summary.hasScopeRun ? (
          <p style={{ padding: 8, background: "#fef2f2" }}>
            No regulatory scope analyzed yet — go to <a href="/profile">Profile</a> and run
            &quot;Save &amp; analyze scope&quot; first.
          </p>
        ) : summary.perRegulation.length === 0 ? (
          <p style={{ padding: 8, background: "#f5f5f5" }}>No regulations are currently in scope.</p>
        ) : (
          <>
            <p style={{ padding: 8, background: scoreColor(summary.overallScore), display: "inline-block" }}>
              Overall blended score: <strong>{fmt(summary.overallScore)}</strong>
            </p>

            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16, marginBottom: 32 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
                  <th style={{ padding: 4 }}>Regulation</th>
                  <th style={{ padding: 4 }}>Group</th>
                  <th style={{ padding: 4 }}>Obligations</th>
                  <th style={{ padding: 4 }}>DSAR SLA met</th>
                  <th style={{ padding: 4 }}>Controls (group)</th>
                  <th style={{ padding: 4 }}>Blended</th>
                </tr>
              </thead>
              <tbody>
                {summary.perRegulation.map((r) => (
                  <tr key={r.acronym} style={{ borderBottom: "1px solid #eee", background: scoreColor(r.blendedScore) }}>
                    <td style={{ padding: 4 }}>
                      <strong>{r.acronym}</strong>
                      <div style={{ fontSize: 12, color: "#666" }}>{r.name}</div>
                    </td>
                    <td style={{ padding: 4, fontSize: 13 }}>{r.group}</td>
                    <td style={{ padding: 4, fontSize: 13 }}>{fmt(r.obligationsPct)}</td>
                    <td style={{ padding: 4, fontSize: 13 }}>{fmt(r.dsarSlaPct)}</td>
                    <td style={{ padding: 4, fontSize: 13 }}>{fmt(r.controlsPct)}</td>
                    <td style={{ padding: 4, fontWeight: 600 }}>{fmt(r.blendedScore)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <h2>Recent activity (DSAR only)</h2>
        <p style={{ fontSize: 12, color: "#666" }}>
          This is DSAR&apos;s own event log — the only real audit trail this app has today, not a
          full cross-module log. Obligations and Cyber Controls changes aren&apos;t recorded as
          events yet (known gap, see README).
        </p>
        <ul style={{ paddingLeft: 16, fontSize: 13 }}>
          {recentEvents.map((e) => (
            <li key={e.id}>
              {new Date(e.createdAt as unknown as string).toLocaleString()} — {e.eventType}
              {e.detail ? `: ${e.detail}` : ""}
            </li>
          ))}
          {recentEvents.length === 0 && <li style={{ color: "#666" }}>No DSAR activity yet.</li>}
        </ul>
      </main>
    </>
  );
}
