import { redirect } from "next/navigation";
import { desc, inArray } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import AppShell from "@/components/AppShell";
import Card from "@/components/Card";
import Badge, { type BadgeVariant } from "@/components/Badge";
import { getDb } from "@/lib/db";
import { dsarEvents, dsarRequests } from "@/lib/db/schema";
import { computeComplianceSummary } from "@/lib/compliance/score";

function scoreVariant(score: number | null): BadgeVariant {
  if (score === null) return "neutral";
  if (score >= 80) return "success";
  if (score >= 50) return "warning";
  return "danger";
}

function scoreBg(score: number | null): string {
  const v = scoreVariant(score);
  return v === "neutral" ? "var(--pq-surface)" : `var(--pq-${v}-bg)`;
}

function fmt(v: number | null): string {
  return v === null ? "n/a" : `${v}%`;
}

/** Compliance dashboard, reskinned Batch 8 (PRD §5.12) — the last batch in
 * this UI redesign pass, alongside Connectors, Regulations/scope, and
 * Profile. No mockup exists for this page — direct token application, same
 * treatment as every batch since Batch 6. Data queries unchanged. */
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
    <AppShell>
      <div style={{ padding: "24px 28px", maxWidth: 980 }}>
        <h1 style={{ marginTop: 0 }}>Compliance dashboard</h1>
        <p style={{ color: "var(--pq-ink-muted)", fontSize: 14 }}>
          A self-reported operational summary, not a certification or legal determination of
          compliance. Blended score = unweighted average of obligations-done %, DSAR SLA-met %,
          and controls-implemented % — the controls figure is measured only at the broad
          jurisdiction-group level (US Federal / US State / International), not per specific
          regulation, since Cyber Controls content isn&apos;t tagged that precisely today. A
          missing signal (no obligations tracked, no closed DSAR requests) is excluded from the
          average, never counted as zero.
        </p>

        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <a href="/compliance/export/csv" style={{ textDecoration: "none" }}>
            <span
              style={{
                display: "inline-block",
                padding: "6px 14px",
                background: "var(--pq-surface)",
                border: "1px solid var(--pq-line)",
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 600,
                color: "var(--pq-ink)",
              }}
            >
              Export CSV
            </span>
          </a>
          <a href="/compliance/export/pdf" style={{ textDecoration: "none" }}>
            <span
              style={{
                display: "inline-block",
                padding: "6px 14px",
                background: "var(--pq-surface)",
                border: "1px solid var(--pq-line)",
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 600,
                color: "var(--pq-ink)",
              }}
            >
              Export PDF
            </span>
          </a>
        </div>

        {!summary.hasScopeRun ? (
          <Card style={{ marginBottom: 24, background: "var(--pq-danger-bg)" }}>
            No regulatory scope analyzed yet — go to <a href="/profile">Profile</a> and run
            &quot;Save &amp; analyze scope&quot; first.
          </Card>
        ) : summary.perRegulation.length === 0 ? (
          <Card style={{ marginBottom: 24 }}>No regulations are currently in scope.</Card>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <Badge variant={scoreVariant(summary.overallScore)}>
                Overall blended score: {fmt(summary.overallScore)}
              </Badge>
            </div>

            <Card style={{ marginBottom: 24, padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--pq-ink-muted)" }}>
                    <th style={{ padding: "10px 16px", fontWeight: 500 }}>Regulation</th>
                    <th style={{ padding: "10px 16px", fontWeight: 500 }}>Group</th>
                    <th style={{ padding: "10px 16px", fontWeight: 500 }}>Obligations</th>
                    <th style={{ padding: "10px 16px", fontWeight: 500 }}>DSAR SLA met</th>
                    <th style={{ padding: "10px 16px", fontWeight: 500 }}>Controls (group)</th>
                    <th style={{ padding: "10px 16px", fontWeight: 500 }}>Blended</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.perRegulation.map((r) => (
                    <tr
                      key={r.acronym}
                      style={{ borderTop: "1px solid var(--pq-line)", background: scoreBg(r.blendedScore) }}
                    >
                      <td style={{ padding: "10px 16px" }}>
                        <strong>{r.acronym}</strong>
                        <div style={{ fontSize: 12, color: "var(--pq-ink-muted)" }}>{r.name}</div>
                      </td>
                      <td style={{ padding: "10px 16px" }}>{r.group}</td>
                      <td style={{ padding: "10px 16px" }}>{fmt(r.obligationsPct)}</td>
                      <td style={{ padding: "10px 16px" }}>{fmt(r.dsarSlaPct)}</td>
                      <td style={{ padding: "10px 16px" }}>{fmt(r.controlsPct)}</td>
                      <td style={{ padding: "10px 16px", fontWeight: 600 }}>{fmt(r.blendedScore)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </>
        )}

        <Card title="Recent activity (DSAR only)">
          <p style={{ fontSize: 12, color: "var(--pq-ink-muted)" }}>
            This is DSAR&apos;s own event log — the only real audit trail this app has today, not a
            full cross-module log. Obligations and Cyber Controls changes aren&apos;t recorded as
            events yet (known gap, see README).
          </p>
          <ul style={{ paddingLeft: 16, fontSize: 13, margin: 0 }}>
            {recentEvents.map((e) => (
              <li key={e.id}>
                {new Date(e.createdAt as unknown as string).toLocaleString()} — {e.eventType}
                {e.detail ? `: ${e.detail}` : ""}
              </li>
            ))}
            {recentEvents.length === 0 && (
              <li style={{ color: "var(--pq-ink-muted)" }}>No DSAR activity yet.</li>
            )}
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}
