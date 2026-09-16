import { redirect } from "next/navigation";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orgRegulationScope } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import AppShell from "@/components/AppShell";

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
      <main style={{ maxWidth: 720, margin: "40px auto", fontFamily: "system-ui", padding: "0 16px" }}>
        <h1>Applicable regulations</h1>
        <p>
          No profile analyzed yet. <Link href="/profile">Complete your company profile</Link> to
          compute scope.
        </p>
      </main>
      </AppShell>
    );
  }

  const results = latest.results as ScopedResult[];
  const inScope = results.filter((r) => r.inScope);
  const watch = results.filter((r) => r.watch);
  const outOfScope = results.filter((r) => !r.inScope && !r.watch);

  return (
    <AppShell>
    <main style={{ maxWidth: 900, margin: "40px auto", fontFamily: "system-ui", padding: "0 16px" }}>
      <h1>Applicable regulations</h1>
      <p>
        Computed {new Date(latest.computedAt as unknown as string).toLocaleString()} ·{" "}
        {results.length} regulations checked.
      </p>

      <h2>In scope ({inScope.length})</h2>
      <ul>
        {inScope.map((r) => (
          <li key={r.acronym}>
            <strong>{r.acronym}</strong> — {r.name} ({r.group})
          </li>
        ))}
        {inScope.length === 0 && <li style={{ color: "#666" }}>None.</li>}
      </ul>

      <h2>Watch — approaching a threshold ({watch.length})</h2>
      <ul>
        {watch.map((r) => (
          <li key={r.acronym}>
            <strong>{r.acronym}</strong> — {r.name} ({r.group})
          </li>
        ))}
        {watch.length === 0 && <li style={{ color: "#666" }}>None.</li>}
      </ul>

      <h2>Out of scope ({outOfScope.length})</h2>
      <p style={{ color: "#666" }}>{outOfScope.map((r) => r.acronym).join(", ") || "—"}</p>

      <p style={{ marginTop: 32 }}>
        <Link href="/profile">Update profile &amp; re-analyze</Link> ·{" "}
        <Link href="/obligations">View business obligations</Link> ·{" "}
        <Link href="/controls">View cyber controls</Link>
      </p>
    </main>
    </AppShell>
  );
}
