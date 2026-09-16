import { redirect } from "next/navigation";
import { Fragment } from "react";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orgObligations } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import AppShell from "@/components/AppShell";
import { listEvidenceForObligations } from "@/lib/evidence";
import { listOrgUsers } from "@/lib/org/users";
import {
  syncObligationsFromScope,
  updateObligation,
  uploadObligationEvidence,
  getCurrentInScopeAcronyms,
} from "./actions";

const STATUS_OPTIONS = ["not_started", "in_progress", "done", "not_applicable"] as const;

function toDateInputValue(d: Date | string | null): string {
  if (!d) return "";
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

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
        <main style={{ maxWidth: 900, margin: "40px auto", fontFamily: "system-ui", padding: "0 16px" }}>
          <h1>Business obligations</h1>
          <p>
            No obligations yet — either no regulation is in scope, or you haven&apos;t analyzed
            a profile. <Link href="/profile">Complete your company profile</Link> first.
          </p>
        </main>
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
      <main style={{ maxWidth: 900, margin: "40px auto", fontFamily: "system-ui", padding: "0 16px" }}>
        <h1>Business obligations</h1>
        <p>
          Synced from your current Regulatory Management scope (PRD §5.2) — one row per
          obligation per in-scope regulation. Falling out of scope on a later re-analysis
          does NOT delete these rows (they&apos;re your audit trail); it&apos;s flagged below instead.
        </p>

        {Array.from(byRegulation.entries()).map(([key, items]) => {
          const [acronym, name] = key.split("::");
          const stillInScope = inScopeAcronyms.has(acronym);
          return (
            <section key={key} style={{ marginBottom: 32 }}>
              <h2>
                {acronym} — {name}{" "}
                {!stillInScope && (
                  <span style={{ color: "#b45309", fontWeight: "normal", fontSize: 14 }}>
                    (no longer in current scope)
                  </span>
                )}
              </h2>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
                    <th style={{ padding: 4 }}>Obligation</th>
                    <th style={{ padding: 4 }}>Status</th>
                    <th style={{ padding: 4 }}>Owner</th>
                    <th style={{ padding: 4 }}>Due date</th>
                    <th style={{ padding: 4 }}>Evidence / notes</th>
                    <th style={{ padding: 4 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => {
                    const files = evidenceByObligation.get(row.id) ?? [];
                    return (
                    <Fragment key={row.id}>
                    <tr style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: 4, verticalAlign: "top", maxWidth: 260 }}>
                        {row.obligationText}
                      </td>
                      <td colSpan={4} style={{ padding: 0 }}>
                        <form action={updateObligation} style={{ display: "flex", gap: 8, padding: 4 }}>
                          <input type="hidden" name="id" value={row.id} />
                          <select name="status" defaultValue={row.status}>
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>
                                {s.replace("_", " ")}
                              </option>
                            ))}
                          </select>
                          <select name="ownerId" defaultValue={row.ownerId ?? ""} style={{ width: 140 }}>
                            <option value="">Unassigned</option>
                            {orgUsers.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.email}
                              </option>
                            ))}
                          </select>
                          <input
                            type="date"
                            name="dueDate"
                            defaultValue={toDateInputValue(row.dueDate)}
                          />
                          <input
                            name="evidenceNote"
                            defaultValue={row.evidenceNote}
                            placeholder="Evidence / notes"
                            style={{ flex: 1 }}
                          />
                          <button type="submit">Save</button>
                        </form>
                      </td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #eee" }}>
                      <td></td>
                      <td colSpan={4} style={{ padding: "0 4px 8px", fontSize: 12 }}>
                        {files.length > 0 && (
                          <ul style={{ margin: "0 0 4px", paddingLeft: 16 }}>
                            {files.map((f) => (
                              <li key={f.id}>
                                <a href={f.blobUrl} target="_blank" rel="noreferrer">
                                  {f.fileName}
                                </a>{" "}
                                <span style={{ color: "#666" }}>
                                  — {(f.sizeBytes / 1024).toFixed(0)}KB, uploaded{" "}
                                  {new Date(f.uploadedAt as unknown as string).toLocaleDateString()}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <form
                          action={uploadObligationEvidence}
                          encType="multipart/form-data"
                          style={{ display: "flex", gap: 8, alignItems: "center" }}
                        >
                          <input type="hidden" name="obligationId" value={row.id} />
                          <input type="file" name="file" required />
                          <button type="submit">Attach evidence</button>
                        </form>
                      </td>
                    </tr>
                    </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </section>
          );
        })}
      </main>
    </AppShell>
  );
}
