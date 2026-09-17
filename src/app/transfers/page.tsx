import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import AppShell from "@/components/AppShell";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import { listTransfers } from "@/lib/assessments/transfers";
import { listActivities } from "@/lib/assessments/ropa";
import {
  TRANSFER_MECHANISMS,
  TRANSFER_MECHANISM_LABELS,
  TIA_STATUSES,
  TIA_STATUS_LABELS,
} from "@/lib/assessments/types";
import { createTransferAction, updateTransferAction } from "./actions";

/** International Transfers, reskinned Batch 7 (PRD §5.12) alongside RoPA and
 * Tracking Tech — direct token application, no dedicated mockup. Each row's
 * inline status/mechanism form kept as-is (matches Cyber Controls' approach
 * in Batch 6 — an edit-toggle here would add scope with no mockup calling
 * for it). Data queries/actions unchanged. */
export default async function TransfersPage() {
  const session = await requireSession();
  if (!session) redirect("/login");

  const [transfers, activities] = await Promise.all([
    listTransfers(session.orgId),
    listActivities(session.orgId),
  ]);
  const activityNameById = new Map(activities.map((a) => [a.id, a.name]));
  const gaps = transfers.filter((t) => t.mechanism === "none").length;

  return (
    <AppShell>
      <div style={{ padding: "24px 28px", maxWidth: 980 }}>
        <h1 style={{ marginTop: 0 }}>International transfers</h1>
        <p style={{ color: "var(--pq-ink-muted)", fontSize: 14 }}>
          Cross-border personal data flows and the legal mechanism (if any) covering each one. No
          automated jurisdiction-conflict detection yet — this is a manual register, not a
          determination of what mechanism is actually required (PRD §9 caveat applies).
        </p>

        {gaps > 0 && (
          <div
            style={{
              display: "inline-block",
              padding: "8px 14px",
              background: "var(--pq-danger-bg)",
              color: "var(--pq-danger)",
              borderRadius: 8,
              fontSize: 13.5,
              marginBottom: 16,
            }}
          >
            <strong>{gaps}</strong> transfer{gaps === 1 ? "" : "s"} with no mechanism in place.
          </div>
        )}

        <Card style={{ marginBottom: 24, padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--pq-ink-muted)" }}>
                <th style={{ padding: "10px 16px", fontWeight: 500 }}>From → To</th>
                <th style={{ padding: "10px 16px", fontWeight: 500 }}>Linked activity</th>
                <th style={{ padding: "10px 16px", fontWeight: 500 }} colSpan={3}>
                  Mechanism / status / notes
                </th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr
                  key={t.id}
                  style={{
                    borderTop: "1px solid var(--pq-line)",
                    background: t.mechanism === "none" ? "var(--pq-danger-bg)" : undefined,
                  }}
                >
                  <td style={{ padding: "10px 16px", fontWeight: 600 }}>
                    {t.fromJurisdiction} → {t.toJurisdiction}
                    {t.mechanism === "none" && (
                      <span style={{ marginLeft: 8 }}>
                        <Badge variant="danger">No mechanism</Badge>
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    {t.activityId ? activityNameById.get(t.activityId) ?? "—" : "—"}
                  </td>
                  <td colSpan={3} style={{ padding: 0 }}>
                    <form action={updateTransferAction} style={{ display: "flex", gap: 8, padding: "8px 16px", alignItems: "center" }}>
                      <input type="hidden" name="id" value={t.id} />
                      <select name="mechanism" defaultValue={t.mechanism}>
                        {TRANSFER_MECHANISMS.map((m) => (
                          <option key={m} value={m}>
                            {TRANSFER_MECHANISM_LABELS[m]}
                          </option>
                        ))}
                      </select>
                      <select name="tiaStatus" defaultValue={t.tiaStatus}>
                        {TIA_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {TIA_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                      <input name="notes" defaultValue={t.notes} placeholder="Notes" style={{ flex: 1 }} />
                      <Button type="submit" variant="secondary">
                        Save
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
              {transfers.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 16, color: "var(--pq-ink-muted)" }}>
                    No transfers logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        <Card title="Log a transfer">
          <form action={createTransferAction} style={{ display: "grid", gap: 10, maxWidth: 480 }}>
            <label>
              From jurisdiction
              <input name="fromJurisdiction" required placeholder="e.g. EU" style={{ display: "block", width: "100%" }} />
            </label>
            <label>
              To jurisdiction
              <input name="toJurisdiction" required placeholder="e.g. US" style={{ display: "block", width: "100%" }} />
            </label>
            <label>
              Linked processing activity (optional)
              <select name="activityId" defaultValue="" style={{ display: "block", width: "100%" }}>
                <option value="">— None —</option>
                {activities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Mechanism
              <select name="mechanism" defaultValue="none" style={{ display: "block", width: "100%" }}>
                {TRANSFER_MECHANISMS.map((m) => (
                  <option key={m} value={m}>
                    {TRANSFER_MECHANISM_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Transfer impact assessment status
              <select name="tiaStatus" defaultValue="not_started" style={{ display: "block", width: "100%" }}>
                {TIA_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {TIA_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Notes
              <textarea name="notes" rows={2} style={{ display: "block", width: "100%" }} />
            </label>
            <div>
              <Button type="submit" variant="primary">
                Log transfer
              </Button>
            </div>
          </form>

          {activities.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--pq-ink-muted)", marginTop: 10 }}>
              No processing activities yet — <Link href="/ropa">add one</Link> to link transfers to
              it (optional, but recommended).
            </p>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
