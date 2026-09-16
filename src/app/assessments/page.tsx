import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import AppShell from "@/components/AppShell";
import Card from "@/components/Card";
import { listActivities, needsDpiaReview } from "@/lib/assessments/ropa";
import { getDpiaForActivity } from "@/lib/assessments/dpia";
import { listTransfers } from "@/lib/assessments/transfers";
import { getMaturityByFunction } from "@/lib/assessments/maturity";

/** Aggregation dashboard tying together the four Phase 4 modules — RoPA,
 * DPIA, International Transfers, and Cyber Controls maturity — since none
 * of those individual pages shows the cross-module picture on its own.
 * Reskinned in the PrivacyQ "Harbor" UI pass, Batch 6 (PRD §5.12), alongside
 * Cyber Controls. The five stat tiles keep their link-card shape but move
 * off the old #f5f5f5/#fff7ed/#fef2f2 inline flag colors onto the shared
 * surface/warning-bg/danger-bg tokens; the maturity table is now Card-
 * wrapped, matching the same table on /controls. Data queries unchanged. */
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

  const tiles: {
    href: string;
    label: string;
    value: string;
    caption?: string;
    flagged?: boolean;
    warn?: boolean;
  }[] = [
    {
      href: "/ropa",
      label: "Processing activities",
      value: String(activities.length),
    },
    {
      href: "/ropa",
      label: "DPIA recommended, not started",
      value: String(dpiaNotStartedFlagged),
      caption: `${flaggedCount} flagged in total`,
      warn: dpiaNotStartedFlagged > 0,
    },
    {
      href: "/ropa",
      label: "DPIAs in progress / completed",
      value: `${dpiaDraftCount} / ${dpiaCompletedCount}`,
    },
    {
      href: "/transfers",
      label: "Transfers with no mechanism",
      value: String(transferGaps),
      caption: `${transfers.length} logged in total`,
      flagged: transferGaps > 0,
    },
    {
      href: "/controls",
      label: "Controls with maturity assessed",
      value: `${overallAssessed}/${overallTotal}`,
    },
  ];

  return (
    <AppShell>
      <div style={{ padding: "24px 28px", maxWidth: 980 }}>
        <h1 style={{ marginTop: 0 }}>Assessments</h1>
        <p style={{ color: "var(--pq-ink-muted)", fontSize: 14 }}>
          One place to see RoPA coverage, DPIA status, transfer gaps, and control maturity
          together. Each number links to the page that can act on it.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
            marginBottom: 24,
          }}
        >
          {tiles.map((tile) => (
            <Link key={tile.label} href={tile.href} style={{ textDecoration: "none", color: "inherit" }}>
              <Card
                style={{
                  background: tile.flagged
                    ? "var(--pq-danger-bg)"
                    : tile.warn
                    ? "var(--pq-warning-bg)"
                    : "var(--pq-surface)",
                }}
              >
                <div style={{ fontSize: 12, color: "var(--pq-ink-muted)" }}>{tile.label}</div>
                <div style={{ fontSize: 24, fontWeight: 600, fontFamily: "var(--font-heading)" }}>
                  {tile.value}
                </div>
                {tile.caption && (
                  <div style={{ fontSize: 11, color: "var(--pq-ink-muted)", marginTop: 2 }}>
                    {tile.caption}
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>

        <Card title="Maturity by NIST Function" style={{ marginBottom: 20 }}>
          <table style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--pq-ink-muted)" }}>
                <th style={{ fontWeight: 500, padding: "4px 0" }}>Function</th>
                <th style={{ fontWeight: 500, padding: "4px 0" }}>Assessed</th>
                <th style={{ fontWeight: 500, padding: "4px 0" }}>Avg. maturity (0–5)</th>
              </tr>
            </thead>
            <tbody>
              {maturity.map((m) => (
                <tr key={m.function} style={{ borderTop: "1px solid var(--pq-line)" }}>
                  <td style={{ padding: "6px 0" }}>{m.function}</td>
                  <td style={{ padding: "6px 0" }}>
                    {m.assessedCount}/{m.totalCount}
                  </td>
                  <td style={{ padding: "6px 0" }}>
                    {m.averageScore !== null ? m.averageScore.toFixed(1) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <p style={{ fontSize: 12, color: "var(--pq-ink-muted)" }}>
          None of the counts above imply a compliance determination — they surface gaps for a
          human to review (PRD §9 unverified-content caveat applies throughout this module).
        </p>
      </div>
    </AppShell>
  );
}
