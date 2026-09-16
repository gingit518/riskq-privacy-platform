import { redirect } from "next/navigation";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { dsarRequests, orgs } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import AppShell from "@/components/AppShell";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import { DSAR_REQUEST_TYPE_LABELS, DSAR_STATUS_LABELS } from "@/lib/dsar/types";
import { DSAR_STATUS_BADGE } from "@/lib/dsar/status-badge";

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

/** DSAR request list (PRD §5.4), reskinned in the PrivacyQ "Harbor" UI pass
 * Batch 3 (PRD §5.12). Data queries and SLA/breach-rate math are unchanged
 * from the original build; only presentation changed (Card/Badge/Button
 * instead of raw table + inline links). No dedicated mockup existed for
 * this specific page (only Obligations/Dashboard were mocked), so the
 * layout here is a direct application of the same design tokens/components
 * rather than a new invented look. */
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

  const secondaryLinks: Array<{ href: string; label: string }> = [
    { href: "/dsar/checklist", label: "Checklist settings" },
    { href: "/dsar/systems", label: "Systems Register" },
    { href: "/dsar/legal-holds", label: "Legal Holds" },
    { href: "/dsar/sub-processors", label: "Sub-processors" },
  ];

  return (
    <AppShell>
      <div style={{ padding: "24px 28px", maxWidth: 1100 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <h1 style={{ marginTop: 0 }}>DSAR requests</h1>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {secondaryLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                style={{
                  textDecoration: "none",
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "var(--pq-ink-muted)",
                  padding: "6px 10px",
                }}
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/dsar/new"
              style={{
                textDecoration: "none",
                fontSize: 12.5,
                fontWeight: 600,
                color: "#FFFFFF",
                background: "var(--pq-primary)",
                border: "1px solid var(--pq-primary)",
                borderRadius: 8,
                padding: "6px 14px",
              }}
            >
              Log a request
            </Link>
          </div>
        </div>

        {org && (
          <p style={{ color: "var(--pq-ink-muted)", fontSize: 13, marginTop: 4 }}>
            Public intake form: <code>/intake/{org.slug}</code> — share this link with data
            subjects to submit requests directly.
          </p>
        )}

        <div style={{ display: "flex", gap: 24, padding: "12px 18px", background: "var(--pq-surface)", border: "1px solid var(--pq-line)", borderRadius: 10, marginBottom: 20, fontSize: 13, flexWrap: "wrap" }}>
          <div>
            <strong>{total}</strong> total
          </div>
          <div>
            <strong>{avgResponseDays !== null ? `${avgResponseDays}d` : "—"}</strong> avg response time
          </div>
          <div>
            <strong>{breachRate !== null ? `${breachRate}%` : "—"}</strong> SLA breach rate
            {withSla.length === 0 && total > 0 && (
              <span style={{ color: "var(--pq-ink-muted)" }}> (no requests have a statutory SLA yet)</span>
            )}
          </div>
        </div>

        {rows.length === 0 ? (
          <Card>
            <p style={{ margin: 0 }}>No DSAR requests yet.</p>
          </Card>
        ) : (
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--pq-line)", color: "var(--pq-ink-muted)" }}>
                  <th style={{ padding: "10px 16px", fontWeight: 500 }}>Requester</th>
                  <th style={{ padding: "10px 16px", fontWeight: 500 }}>Type</th>
                  <th style={{ padding: "10px 16px", fontWeight: 500 }}>Status</th>
                  <th style={{ padding: "10px 16px", fontWeight: 500 }}>Governing reg</th>
                  <th style={{ padding: "10px 16px", fontWeight: 500 }}>Due</th>
                  <th style={{ padding: "10px 16px", fontWeight: 500 }}>Owner</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const due = r.slaDueAt ? new Date(r.slaDueAt as unknown as string) : null;
                  const isBreached = due && !r.closedAt && due < now;
                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid var(--pq-line)" }}>
                      <td style={{ padding: "10px 16px" }}>
                        <Link href={`/dsar/${r.id}`}>{r.requesterName}</Link>
                        <div style={{ color: "var(--pq-ink-muted)", fontSize: 12 }}>{r.requesterEmail}</div>
                      </td>
                      <td style={{ padding: "10px 16px" }}>{DSAR_REQUEST_TYPE_LABELS[r.requestType]}</td>
                      <td style={{ padding: "10px 16px" }}>
                        <Badge variant={DSAR_STATUS_BADGE[r.status]}>{DSAR_STATUS_LABELS[r.status]}</Badge>
                      </td>
                      <td style={{ padding: "10px 16px", fontSize: 12, color: "var(--pq-ink-muted)" }}>
                        {r.governingRegulationAcronym ?? "none (no statutory SLA)"}
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        <div style={{ color: isBreached ? "var(--pq-danger)" : undefined }}>{fmtDate(due)}</div>
                        {isBreached && (
                          <Badge variant="danger">Breached</Badge>
                        )}
                      </td>
                      <td style={{ padding: "10px 16px" }}>{r.owner || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
