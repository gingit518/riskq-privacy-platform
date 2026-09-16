import { redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orgObligations, dsarRequests, controlsLibrary, orgControls } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import AppShell from "@/components/AppShell";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import StatTile from "@/components/StatTile";
import { listActivities } from "@/lib/assessments/ropa";
import { getDpiaForActivity } from "@/lib/assessments/dpia";
import { listTransfers } from "@/lib/assessments/transfers";
import { computeComplianceSummary } from "@/lib/compliance/score";
import {
  countObligationBuckets,
  countControlBuckets,
  countDsarBuckets,
  countDpiaBuckets,
  countTiaBuckets,
} from "@/lib/summary/status";
import { computeDsarTrend } from "@/lib/summary/dsar-trend";
import { listMyPending, type PendingItemKind } from "@/lib/summary/pending";

/** Management Summary View (PRD §5.11, added 2026-09-16; reskinned in the
 * PrivacyQ "Harbor" UI pass, PRD §5.12 Batch 2). Two sections on one page: a
 * program-wide status rollup ("Management" — everyone can see this for now,
 * per Ariel's 2026-09-16 call) and each user's own pending work across every
 * area with real per-user assignment ("My Pending"). All data/queries and
 * copy are unchanged from the original build — this pass only changes
 * presentation (StatTile/Card/Badge instead of raw tables), plus grouping
 * DSAR trend + My Pending side by side per the approved dashboard mockup.
 * See summary/status.ts and summary/pending.ts for what's deliberately left
 * out and why (RoPA/Tracking Technology have no status field; Controls/
 * Transfers/Tracking Technology have no per-user assignment field). */
export default async function SummaryPage() {
  const session = await requireSession();
  if (!session) redirect("/login");

  const db = getDb();

  const obligationRows = await db
    .select({ status: orgObligations.status })
    .from(orgObligations)
    .where(eq(orgObligations.orgId, session.orgId));
  const obligationBuckets = countObligationBuckets(obligationRows);

  const controlRows = await db
    .select({ status: orgControls.status })
    .from(controlsLibrary)
    .leftJoin(orgControls, eq(orgControls.controlId, controlsLibrary.id));
  const controlBuckets = countControlBuckets(
    controlRows.map((r) => ({ status: r.status ?? ("not_implemented" as const) }))
  );

  const dsarRows = await db
    .select({
      status: dsarRequests.status,
      createdAt: dsarRequests.createdAt,
      closedAt: dsarRequests.closedAt,
      slaDueAt: dsarRequests.slaDueAt,
    })
    .from(dsarRequests)
    .where(eq(dsarRequests.orgId, session.orgId));
  const dsarBuckets = countDsarBuckets(dsarRows);
  const dsarTrend = computeDsarTrend(dsarRows);

  const activities = await listActivities(session.orgId);
  const dpiaRows = await Promise.all(activities.map((a) => getDpiaForActivity(session.orgId, a.id)));
  const dpiaBuckets = countDpiaBuckets(
    activities.length,
    dpiaRows.filter((d): d is NonNullable<typeof d> => d !== null).map((d) => d.status)
  );

  const transfers = await listTransfers(session.orgId);
  const tiaBuckets = countTiaBuckets(transfers);

  const compliance = await computeComplianceSummary(session.orgId);

  const myPending = await listMyPending(session.orgId, session.userId);

  const PENDING_DOT: Record<PendingItemKind, string> = {
    obligation: "var(--pq-accent)",
    dsar: "var(--pq-danger)",
    ropa_dpia: "var(--pq-warning)",
  };

  function breachBadgeVariant(rate: number | null): "success" | "warning" | "neutral" {
    if (rate === null) return "neutral";
    return rate > 0 ? "warning" : "success";
  }

  return (
    <AppShell>
      <div style={{ padding: "24px 28px", maxWidth: 1120 }}>
        <h1 style={{ marginTop: 0 }}>Management summary</h1>
        <p style={{ color: "var(--pq-ink-muted)", fontSize: 14, marginBottom: 28 }}>
          Program status across every module in one place, plus your own pending work below.
          Self-reported operational figures, not a compliance certification — same posture as
          the Compliance Dashboard.
        </p>

        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--pq-ink-muted)",
            marginBottom: 10,
          }}
        >
          Program status
        </div>
        <div style={{ display: "flex", gap: 14, marginBottom: 12, flexWrap: "wrap" }}>
          <StatTile
            label="Obligations"
            href="/obligations"
            complete={obligationBuckets.complete}
            inFlight={obligationBuckets.inFlight}
            notStarted={obligationBuckets.notStarted}
            excluded={obligationBuckets.excluded}
          />
          <StatTile
            label="Cyber Controls"
            href="/controls"
            complete={controlBuckets.complete}
            inFlight={controlBuckets.inFlight}
            notStarted={controlBuckets.notStarted}
          />
          <StatTile
            label="DSAR Requests"
            href="/dsar"
            complete={dsarBuckets.complete}
            inFlight={dsarBuckets.inFlight}
            notStarted={dsarBuckets.notStarted}
          />
          <StatTile
            label="DPIAs"
            href="/ropa"
            complete={dpiaBuckets.complete}
            inFlight={dpiaBuckets.inFlight}
            notStarted={dpiaBuckets.notStarted}
          />
          <StatTile
            label="Transfer Assessments"
            href="/transfers"
            complete={tiaBuckets.complete}
            inFlight={tiaBuckets.inFlight}
            notStarted={tiaBuckets.notStarted}
            excluded={tiaBuckets.excluded}
          />
        </div>
        <p style={{ fontSize: 12, color: "var(--pq-ink-muted)", marginBottom: 28 }}>
          RoPA processing activities ({activities.length} logged) and Tracking Technology entries
          have no status field today, so they aren&apos;t bucketed above — see{" "}
          <Link href="/ropa">RoPA</Link> and <Link href="/tracking">Tracking Technologies</Link>{" "}
          for their own inventory counts.
        </p>

        <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap", alignItems: "stretch" }}>
          <Card title="DSAR trend (this week vs. last week)" style={{ flex: "1.2 1 380px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ color: "var(--pq-ink-muted)", textAlign: "left" }}>
                  <th style={{ fontWeight: 500, padding: "4px 0" }}></th>
                  <th style={{ fontWeight: 500, padding: "4px 0" }}>Opened</th>
                  <th style={{ fontWeight: 500, padding: "4px 0" }}>Closed</th>
                  <th style={{ fontWeight: 500, padding: "4px 0" }}>Breach rate</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderTop: "1px solid var(--pq-line)" }}>
                  <td style={{ padding: "8px 0" }}>This week</td>
                  <td style={{ padding: "8px 0" }}>{dsarTrend.thisWeek.opened}</td>
                  <td style={{ padding: "8px 0" }}>{dsarTrend.thisWeek.closed}</td>
                  <td style={{ padding: "8px 0" }}>
                    <Badge variant={breachBadgeVariant(dsarTrend.thisWeek.breachRate)}>
                      {dsarTrend.thisWeek.breachRate ?? "—"}%
                    </Badge>
                  </td>
                </tr>
                <tr style={{ borderTop: "1px solid var(--pq-line)", color: "var(--pq-ink-muted)" }}>
                  <td style={{ padding: "8px 0" }}>Last week</td>
                  <td style={{ padding: "8px 0" }}>{dsarTrend.lastWeek.opened}</td>
                  <td style={{ padding: "8px 0" }}>{dsarTrend.lastWeek.closed}</td>
                  <td style={{ padding: "8px 0" }}>
                    <Badge variant={breachBadgeVariant(dsarTrend.lastWeek.breachRate)}>
                      {dsarTrend.lastWeek.breachRate ?? "—"}%
                    </Badge>
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>

          <Card title="My pending" style={{ flex: "1 1 300px" }}>
            {myPending.length === 0 ? (
              <p style={{ fontSize: 14, margin: 0 }}>Nothing assigned to you is currently pending.</p>
            ) : (
              myPending.map((item) => (
                <div
                  key={`${item.kind}-${item.id}`}
                  style={{ display: "flex", gap: 10, padding: "8px 0", borderTop: "1px solid var(--pq-line)" }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: PENDING_DOT[item.kind],
                      marginTop: 5,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <Link href={item.href} style={{ fontSize: 12.5, fontWeight: 600, color: "inherit" }}>
                      {item.title}
                    </Link>
                    <div style={{ fontSize: 11.5, color: "var(--pq-ink-muted)" }}>{item.detail}</div>
                  </div>
                </div>
              ))
            )}
            <p style={{ fontSize: 11.5, color: "var(--pq-ink-muted)", marginTop: 12, marginBottom: 0 }}>
              Your own open items across Obligations, DSAR, and RoPA/DPIA — the areas with real
              per-user assignment today. Cyber Controls, Transfers, and Tracking Technology have
              no owner/assignee field yet, so they can&apos;t appear here (PRD §5.11).
            </p>
          </Card>
        </div>

        <Card
          title={
            <>
              Compliance score (<Link href="/compliance">full dashboard</Link>)
            </>
          }
        >
          {!compliance.hasScopeRun || compliance.perRegulation.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--pq-ink-muted)", margin: 0 }}>
              No regulatory scope analyzed yet, or nothing in scope.
            </p>
          ) : (
            <p style={{ margin: 0 }}>
              Overall blended score: <strong>{compliance.overallScore ?? "n/a"}%</strong> across{" "}
              {compliance.perRegulation.length} in-scope regulation(s).
            </p>
          )}
          <p style={{ fontSize: 11.5, color: "var(--pq-ink-muted)", marginTop: 12, marginBottom: 0 }}>
            This score has no historical tracking today, so it isn&apos;t trended — see PRD §5.11
            for why (no snapshot table exists yet; this was Ariel&apos;s explicit call for V1).
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
