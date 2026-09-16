import { redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orgObligations, dsarRequests, controlsLibrary, orgControls } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import Nav from "@/components/Nav";
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
  type BucketCounts,
} from "@/lib/summary/status";
import { computeDsarTrend } from "@/lib/summary/dsar-trend";
import { listMyPending } from "@/lib/summary/pending";

/** Management Summary View (PRD §5.11, added 2026-09-16). Two sections on
 * one page: a program-wide status rollup ("Management" — everyone can see
 * this for now, per Ariel's 2026-09-16 call) and each user's own pending
 * work across every area with real per-user assignment ("My Pending"). See
 * summary/status.ts and summary/pending.ts for what's deliberately left out
 * and why (RoPA/Tracking Technology have no status field; Controls/
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

  return (
    <>
      <Nav />
      <main style={{ maxWidth: 1000, margin: "40px auto", fontFamily: "system-ui", padding: "0 16px" }}>
        <h1>Management summary</h1>
        <p style={{ color: "#666", fontSize: 14 }}>
          Program status across every module in one place, plus your own pending work below.
          Self-reported operational figures, not a compliance certification — same posture as
          the Compliance Dashboard.
        </p>

        <h2>Program status</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
              <th style={{ padding: 4 }}>Area</th>
              <th style={{ padding: 4 }}>Complete</th>
              <th style={{ padding: 4 }}>In flight</th>
              <th style={{ padding: 4 }}>Not started</th>
              <th style={{ padding: 4 }}>Excluded</th>
            </tr>
          </thead>
          <tbody>
            <BucketRow label="Obligations" href="/obligations" counts={obligationBuckets} />
            <BucketRow label="Cyber Controls" href="/controls" counts={controlBuckets} />
            <BucketRow label="DSAR requests" href="/dsar" counts={dsarBuckets} />
            <BucketRow label="DPIAs" href="/ropa" counts={dpiaBuckets} />
            <BucketRow label="Transfer impact assessments" href="/transfers" counts={tiaBuckets} />
          </tbody>
        </table>

        <p style={{ fontSize: 12, color: "#999", marginBottom: 24 }}>
          RoPA processing activities ({activities.length} logged) and Tracking Technology entries
          have no status field today, so they aren&apos;t bucketed above — see{" "}
          <Link href="/ropa">RoPA</Link> and <Link href="/tracking">Tracking Technologies</Link>{" "}
          for their own inventory counts.
        </p>

        <h2>DSAR trend (this week vs. last week)</h2>
        <table style={{ borderCollapse: "collapse", fontSize: 13, marginBottom: 8 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
              <th style={{ padding: 4 }}></th>
              <th style={{ padding: 4 }}>Opened</th>
              <th style={{ padding: 4 }}>Closed</th>
              <th style={{ padding: 4 }}>Breach rate</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: 4 }}>This week</td>
              <td style={{ padding: 4 }}>{dsarTrend.thisWeek.opened}</td>
              <td style={{ padding: 4 }}>{dsarTrend.thisWeek.closed}</td>
              <td style={{ padding: 4 }}>{dsarTrend.thisWeek.breachRate ?? "—"}%</td>
            </tr>
            <tr>
              <td style={{ padding: 4, color: "#666" }}>Last week</td>
              <td style={{ padding: 4, color: "#666" }}>{dsarTrend.lastWeek.opened}</td>
              <td style={{ padding: 4, color: "#666" }}>{dsarTrend.lastWeek.closed}</td>
              <td style={{ padding: 4, color: "#666" }}>{dsarTrend.lastWeek.breachRate ?? "—"}%</td>
            </tr>
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: "#999", marginBottom: 24 }}>
          The Compliance blended score below has no historical tracking today, so it isn&apos;t
          trended — see PRD §5.11 for why (no snapshot table exists yet; this was Ariel&apos;s
          explicit call for V1).
        </p>

        <h2>
          Compliance score (<Link href="/compliance">full dashboard</Link>)
        </h2>
        {!compliance.hasScopeRun || compliance.perRegulation.length === 0 ? (
          <p style={{ fontSize: 13, color: "#666", marginBottom: 24 }}>
            No regulatory scope analyzed yet, or nothing in scope.
          </p>
        ) : (
          <p style={{ marginBottom: 24 }}>
            Overall blended score: <strong>{compliance.overallScore ?? "n/a"}%</strong> across{" "}
            {compliance.perRegulation.length} in-scope regulation(s).
          </p>
        )}

        <h2>My pending</h2>
        <p style={{ color: "#666", fontSize: 13 }}>
          Your own open items across Obligations, DSAR, and RoPA/DPIA — the areas with real
          per-user assignment today. Cyber Controls, Transfers, and Tracking Technology have no
          owner/assignee field yet, so they can&apos;t appear here (PRD §5.11).
        </p>
        {myPending.length === 0 ? (
          <p style={{ fontSize: 14 }}>Nothing assigned to you is currently pending.</p>
        ) : (
          <ul style={{ paddingLeft: 16, fontSize: 14 }}>
            {myPending.map((item) => (
              <li key={`${item.kind}-${item.id}`} style={{ marginBottom: 6 }}>
                <Link href={item.href}>{item.title}</Link>
                <div style={{ fontSize: 12, color: "#666" }}>{item.detail}</div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function BucketRow({ label, href, counts }: { label: string; href: string; counts: BucketCounts }) {
  return (
    <tr style={{ borderBottom: "1px solid #eee" }}>
      <td style={{ padding: 4 }}>
        <Link href={href}>{label}</Link>
      </td>
      <td style={{ padding: 4 }}>{counts.complete}</td>
      <td style={{ padding: 4 }}>{counts.inFlight}</td>
      <td style={{ padding: 4 }}>{counts.notStarted}</td>
      <td style={{ padding: 4, color: "#999" }}>{counts.excluded || "—"}</td>
    </tr>
  );
}
