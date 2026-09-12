import { redirect } from "next/navigation";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { dsarRequests, orgs } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import Nav from "@/components/Nav";
import { DSAR_REQUEST_TYPE_LABELS, DSAR_STATUS_LABELS } from "@/lib/dsar/types";

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

export default async function DsarDashboardPage() {
  const session = await requireSession();
  if (!session) redirect("/login");

  const db = getDb();
  const [org] = await db.select().from(orgs).where(eq(orgs.id, session.orgId)).limit(1);
  const rows = await db
    .select()
    .from(dsarRequests)
    .where(eq(dsarRequests.orgId, session.orgId))
    .orderBy(desc(dsarRequests.createdAt));

  const total = rows.length;
  const closed = rows.filter((r) => r.closedAt);
  const avgResponseDays =
    closed.length > 0
      ? Math.round(
          closed.reduce((sum, r) => {
            const ms = new Date(r.closedAt as unknown as string).getTime() - new Date(r.createdAt as unknown as string).getTime();
            return sum + ms / (1000 * 60 * 60 * 24);
          }, 0) / closed.length
        )
      : null;

  const now = new Date();
  const withSla = rows.filter((r) => r.slaDueAt);
  const breached = withSla.filter((r) => {
    const due = new Date(r.slaDueAt as unknown as string);
    const comparedAt = r.closedAt ? new Date(r.closedAt as unknown as string) : now;
    return comparedAt > due;
  });
  const breachRate = withSla.length > 0 ? Math.round((breached.length / withSla.length) * 100) : null;

  return (
    <>
      <Nav />
      <main style={{ maxWidth: 1000, margin: "40px auto", fontFamily: "system-ui", padding: "0 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h1>DSAR requests</h1>
          <div>
            <Link href="/dsar/checklist" style={{ marginRight: 16 }}>
              Checklist settings
            </Link>
            <Link href="/dsar/systems" style={{ marginRight: 16 }}>
              Systems Register
            </Link>
            <Link href="/dsar/legal-holds" style={{ marginRight: 16 }}>
              Legal Holds
            </Link>
            <Link href="/dsar/new">Log a request</Link>
          </div>
        </div>

        {org && (
          <p style={{ color: "#666", fontSize: 13 }}>
            Public intake form:{" "}
            <code>
              /intake/{org.slug}
            </code>{" "}
            — share this link with data subjects to submit requests directly.
          </p>
        )}

        <p style={{ padding: 8, background: "#f5f5f5", display: "inline-block" }}>
          <strong>{total}</strong> total ·{" "}
          <strong>{avgResponseDays !== null ? `${avgResponseDays}d` : "—"}</strong> avg response
          time ·{" "}
          <strong>{breachRate !== null ? `${breachRate}%` : "—"}</strong> SLA breach rate
          {withSla.length === 0 && total > 0 && (
            <span style={{ color: "#666" }}> (no requests have a statutory SLA yet)</span>
          )}
        </p>

        {rows.length === 0 ? (
          <p>No DSAR requests yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
                <th style={{ padding: 4 }}>Requester</th>
                <th style={{ padding: 4 }}>Type</th>
                <th style={{ padding: 4 }}>Status</th>
                <th style={{ padding: 4 }}>Governing reg</th>
                <th style={{ padding: 4 }}>Due</th>
                <th style={{ padding: 4 }}>Owner</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const due = r.slaDueAt ? new Date(r.slaDueAt as unknown as string) : null;
                const isBreached = due && !r.closedAt && due < now;
                return (
                  <tr key={r.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: 4 }}>
                      <Link href={`/dsar/${r.id}`}>{r.requesterName}</Link>
                      <div style={{ color: "#666", fontSize: 12 }}>{r.requesterEmail}</div>
                    </td>
                    <td style={{ padding: 4 }}>{DSAR_REQUEST_TYPE_LABELS[r.requestType]}</td>
                    <td style={{ padding: 4 }}>{DSAR_STATUS_LABELS[r.status]}</td>
                    <td style={{ padding: 4, fontSize: 12, color: "#666" }}>
                      {r.governingRegulationAcronym ?? "none (no statutory SLA)"}
                    </td>
                    <td style={{ padding: 4, color: isBreached ? "crimson" : undefined }}>
                      {fmtDate(due)}
                      {isBreached && " (breached)"}
                    </td>
                    <td style={{ padding: 4 }}>{r.owner || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </main>
    </>
  );
}
