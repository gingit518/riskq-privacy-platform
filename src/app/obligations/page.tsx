import { redirect } from "next/navigation";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orgObligations } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import AppShell from "@/components/AppShell";
import ObligationRow from "./ObligationRow";
import { listEvidenceForObligations } from "@/lib/evidence";
import { listOrgUsers } from "@/lib/org/users";
import {
  syncObligationsFromScope,
  updateObligation,
  uploadObligationEvidence,
  getCurrentInScopeAcronyms,
} from "./actions";

/** Business Obligations (PRD §5.2), reskinned in the PrivacyQ "Harbor" UI
 * pass Batch 3 (PRD §5.12) — card-per-regulation with a read/edit-toggle row
 * (ObligationRow.tsx) replacing the old always-open inline form, per the
 * approved "After-Obligations" mockup. Data queries and sync logic below are
 * unchanged from the original build; only the row-level presentation and
 * interaction model changed. */
export default async function ObligationsPage() {
  const session = await requireSession();
  if (!session) redirect("/login");

  // Additive-only sync (see actions.ts) — safe to run on every page load.
  await syncObligationsFromScope();

  const db = getDb();
  const rows = await db
    .select()
    .from(orgObligations)
    .where(eq(orgObligations.orgId, session.orgId))
    .orderBy(asc(orgObligations.regulationAcronym), asc(orgObligations.createdAt));

  const inScopeAcronyms = await getCurrentInScopeAcronyms(session.orgId);
  const orgUsers = await listOrgUsers(session.orgId);
  const evidenceRows = await listEvidenceForObligations(
    session.orgId,
    rows.map((r) => r.id)
  );
  const evidenceByObligation = new Map<string, typeof evidenceRows>();
  for (const e of evidenceRows) {
    if (!e.obligationId) continue;
    if (!evidenceByObligation.has(e.obligationId)) evidenceByObligation.set(e.obligationId, []);
    evidenceByObligation.get(e.obligationId)!.push(e);
  }

  if (rows.length === 0) {
    return (
      <AppShell>
        <div style={{ padding: "24px 28px", maxWidth: 900 }}>
          <h1>Business obligations</h1>
          <p>
            No obligations yet — either no regulation is in scope, or you haven&apos;t analyzed
            a profile. <Link href="/profile">Complete your company profile</Link> first.
          </p>
        </div>
      </AppShell>
    );
  }

  const byRegulation = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = `${row.regulationAcronym}::${row.regulationName}`;
    if (!byRegulation.has(key)) byRegulation.set(key, []);
    byRegulation.get(key)!.push(row);
  }

  return (
    <AppShell>
      <div style={{ padding: "24px 28px", maxWidth: 1000 }}>
        <h1 style={{ marginTop: 0 }}>Business obligations</h1>
        <p style={{ color: "var(--pq-ink-muted)", fontSize: 13, maxWidth: 640, marginBottom: 22 }}>
          Synced from your current Regulatory Management scope (PRD §5.2) — one row per
          obligation per in-scope regulation. Falling out of scope on a later re-analysis does
          NOT delete these rows (they&apos;re your audit trail); it&apos;s flagged below instead.
        </p>

        {Array.from(byRegulation.entries()).map(([key, items]) => {
          const [acronym, name] = key.split("::");
          const stillInScope = inScopeAcronyms.has(acronym);
          return (
            <div
              key={key}
              style={{
                background: "var(--pq-surface)",
                border: "1px solid var(--pq-line)",
                borderRadius: 12,
                marginBottom: 16,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "14px 18px",
                  borderBottom: "1px solid var(--pq-line)",
                }}
              >
                <span
                  style={{
                    background: "var(--pq-primary)",
                    color: "#FFFFFF",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 9px",
                    borderRadius: 999,
                  }}
                >
                  {acronym}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{name}</span>
                {!stillInScope && (
                  <span style={{ color: "var(--pq-warning)", fontWeight: 500, fontSize: 12.5 }}>
                    (no longer in current scope)
                  </span>
                )}
              </div>

              {items.map((row) => (
                <ObligationRow
                  key={row.id}
                  row={row}
                  orgUsers={orgUsers}
                  files={evidenceByObligation.get(row.id) ?? []}
                  updateObligation={updateObligation}
                  uploadObligationEvidence={uploadObligationEvidence}
                />
              ))}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
