import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import Nav from "@/components/Nav";
import { listActivities, needsDpiaReview } from "@/lib/assessments/ropa";
import { getDpiaForActivity } from "@/lib/assessments/dpia";
import { listTransfers } from "@/lib/assessments/transfers";
import { getMaturityByFunction } from "@/lib/assessments/maturity";

/** Aggregation dashboard tying together the four Phase 4 modules — RoPA,
 * DPIA, International Transfers, and Cyber Controls maturity — since none
 * of those individual pages shows the cross-module picture on its own. */
export default async function AssessmentsPage() {
  const session = await requireSession();
  if (!session) redirect("/login");

  const activities = await listActivities(session.orgId);
  const dpiaRows = await Promise.all(
    activities.map((a) => getDpiaForActivity(session.orgId, a.id))
  );
  const flaggedCount = activities.filter((a) => needsDpiaReview(a)).length;
  const dpiaCompletedCount = dpiaRows.filter((d) => d?.status === "completed").length;
  const dpiaDraftCount = dpiaRows.filter((d) => d && d.status !== "completed").length;
  const dpiaNotStartedFlagged = activities.filter(
    (a, i) => needsDpiaReview(a) && !dpiaRows[i]
  ).length;

  const transfers = await listTransfers(session.orgId);
  const transferGaps = transfers.filter((t) => t.mechanism === "none").length;

  const maturity = await getMaturityByFunction(session.orgId);
  const overallAssessed = maturity.reduce((s, m) => s + m.assessedCount, 0);
  const overallTotal = maturity.reduce((s, m) => s + m.totalCount, 0);

  return (
    <>
      <Nav />
      <main style={{ maxWidth: 900, margin: "40px auto", fontFamily: "system-ui", padding: "0 16px" }}>
        <h1>Assessments</h1>
        <p style={{ color: "#666", fontSize: 14 }}>
          One place to see RoPA coverage, DPIA status, transfer gaps, and control maturity
          together. Each number links to the page that can act on it.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
            marginBottom: 32,
          }}
        >
          <Link href="/ropa" style={{ padding: 12, background: "#f5f5f5", color: "inherit", textDecoration: "none" }}>
            <div style={{ fontSize: 12, color: "#666" }}>Processing activities</div>
            <div style={{ fontSize: 24, fontWeight: 600 }}>{activities.length}</div>
          </Link>

          <Link href="/ropa" style={{ padding: 12, background: dpiaNotStartedFlagged > 0 ? "#fff7ed" : "#f5f5f5", color: "inherit", textDecoration: "none" }}>
            <div style={{ fontSize: 12, color: "#666" }}>DPIA recommended, not started</div>
            <div style={{ fontSize: 24, fontWeight: 600 }}>{dpiaNotStartedFlagged}</div>
            <div style={{ fontSize: 11, color: "#999" }}>{flaggedCount} flagged in total</div>
          </Link>

          <Link href="/ropa" style={{ padding: 12, background: "#f5f5f5", color: "inherit", textDecoration: "none" }}>
            <div style={{ fontSize: 12, color: "#666" }}>DPIAs in progress / completed</div>
            <div style={{ fontSize: 24, fontWeight: 600 }}>
              {dpiaDraftCount} / {dpiaCompletedCount}
            </div>
          </Link>

          <Link href="/transfers" style={{ padding: 12, background: transferGaps > 0 ? "#fef2f2" : "#f5f5f5", color: "inherit", textDecoration: "none" }}>
            <div style={{ fontSize: 12, color: "#666" }}>Transfers with no mechanism</div>
            <div style={{ fontSize: 24, fontWeight: 600 }}>{transferGaps}</div>
            <div style={{ fontSize: 11, color: "#999" }}>{transfers.length} logged in total</div>
          </Link>

          <Link href="/controls" style={{ padding: 12, background: "#f5f5f5", color: "inherit", textDecoration: "none" }}>
            <div style={{ fontSize: 12, color: "#666" }}>Controls with maturity assessed</div>
            <div style={{ fontSize: 24, fontWeight: 600 }}>
              {overallAssessed}/{overallTotal}
            </div>
          </Link>
        </div>

        <h2>Maturity by NIST Function</h2>
        <table style={{ borderCollapse: "collapse", fontSize: 13, marginBottom: 24 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
              <th style={{ padding: 4 }}>Function</th>
              <th style={{ padding: 4 }}>Assessed</th>
              <th style={{ padding: 4 }}>Avg. maturity (0–5)</th>
            </tr>
          </thead>
          <tbody>
            {maturity.map((m) => (
              <tr key={m.function}>
                <td style={{ padding: 4 }}>{m.function}</td>
                <td style={{ padding: 4 }}>
                  {m.assessedCount}/{m.totalCount}
                </td>
                <td style={{ padding: 4 }}>{m.averageScore !== null ? m.averageScore.toFixed(1) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={{ fontSize: 12, color: "#999" }}>
          None of the counts above imply a compliance determination — they surface gaps for a
          human to review (PRD §9 unverified-content caveat applies throughout this module).
        </p>
      </main>
    </>
  );
}
