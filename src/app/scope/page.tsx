import { redirect } from "next/navigation";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orgRegulationScope } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import AppShell from "@/components/AppShell";
import Card from "@/components/Card";
import Badge from "@/components/Badge";

interface ScopedTest {
  label: string;
  req?: string;
  compVal: string;
  passed: boolean;
}

interface ScopedResult {
  acronym: string;
  name: string;
  group: string;
  inScope: boolean;
  watch: boolean;
  tests: ScopedTest[];
}

/** Applicable Regulations (scope), reskinned Batch 8 (PRD §5.12) — the last
 * page in this UI redesign pass, alongside Compliance, Connectors, and
 * Profile. No mockup exists for this page — direct token application.
 * Data query unchanged. */
export default async function ScopePage() {
  const session = await requireSession();
  if (!session) redirect("/login");

  const db = getDb();
  const [latest] = await db
    .select()
    .from(orgRegulationScope)
    .where(eq(orgRegulationScope.orgId, session.orgId))
    .orderBy(desc(orgRegulationScope.computedAt))
    .limit(1);

  if (!latest) {
    return (
      <AppShell>
        <div style={{ padding: "24px 28px", maxWidth: 720 }}>
          <h1 style={{ marginTop: 0 }}>Applicable regulations</h1>
          <p>
            No profile analyzed yet. <Link href="/profile">Complete your company profile</Link> to
            compute scope.
          </p>
        </div>
      </AppShell>
    );
  }

  const results = latest.results as ScopedResult[];
  const inScope = results.filter((r) => r.inScope);
  const watch = results.filter((r) => r.watch);
  const outOfScope = results.filter((r) => !r.inScope && !r.watch);

  return (
    <AppShell>
      <div style={{ padding: "24px 28px", maxWidth: 900 }}>
        <h1 style={{ marginTop: 0 }}>Applicable regulations</h1>
        <p style={{ color: "var(--pq-ink-muted)", fontSize: 14 }}>
          Computed {new Date(latest.computedAt as unknown as string).toLocaleString()} ·{" "}
          {results.length} regulations checked.
        </p>

        <Card title={`In scope (${inScope.length})`} style={{ marginBottom: 16 }}>
          {inScope.length === 0 ? (
            <p style={{ color: "var(--pq-ink-muted)", margin: 0 }}>None.</p>
          ) : (
            <ul style={{ paddingLeft: 0, listStyle: "none", margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {inScope.map((r) => (
                <li key={r.acronym} style={{ fontSize: 14 }}>
                  <strong>{r.acronym}</strong> — {r.name}{" "}
                  <Badge variant="success">{r.group}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Watch — approaching a threshold (${watch.length})`} style={{ marginBottom: 16 }}>
          {watch.length === 0 ? (
            <p style={{ color: "var(--pq-ink-muted)", margin: 0 }}>None.</p>
          ) : (
            <ul style={{ paddingLeft: 0, listStyle: "none", margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {watch.map((r) => (
                <li key={r.acronym} style={{ fontSize: 14 }}>
                  <strong>{r.acronym}</strong> — {r.name}{" "}
                  <Badge variant="warning">{r.group}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Out of scope (${outOfScope.length})`} style={{ marginBottom: 20 }}>
          <p style={{ color: "var(--pq-ink-muted)", margin: 0, fontSize: 14 }}>
            {outOfScope.map((r) => r.acronym).join(", ") || "—"}
          </p>
        </Card>

        <p style={{ fontSize: 13.5 }}>
          <Link href="/profile">Update profile &amp; re-analyze</Link> ·{" "}
          <Link href="/obligations">View business obligations</Link> ·{" "}
          <Link href="/controls">View cyber controls</Link>
        </p>
      </div>
    </AppShell>
  );
}
