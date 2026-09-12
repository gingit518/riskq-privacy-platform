import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import Nav from "@/components/Nav";
import { listTransfers } from "@/lib/assessments/transfers";
import { listActivities } from "@/lib/assessments/ropa";
import {
  TRANSFER_MECHANISMS,
  TRANSFER_MECHANISM_LABELS,
  TIA_STATUSES,
  TIA_STATUS_LABELS,
} from "@/lib/assessments/types";
import { createTransferAction, updateTransferAction } from "./actions";

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
    <>
      <Nav />
      <main style={{ maxWidth: 900, margin: "40px auto", fontFamily: "system-ui", padding: "0 16px" }}>
        <h1>International transfers</h1>
        <p style={{ color: "#666", fontSize: 14 }}>
          Cross-border personal data flows and the legal mechanism (if any) covering each one. No
          automated jurisdiction-conflict detection yet — this is a manual register, not a
          determination of what mechanism is actually required (PRD §9 caveat applies).
        </p>

        {gaps > 0 && (
          <p style={{ padding: 8, background: "#fef2f2", color: "#b91c1c", display: "inline-block" }}>
            <strong>{gaps}</strong> transfer{gaps === 1 ? "" : "s"} with no mechanism in place.
          </p>
        )}

        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
              <th style={{ padding: 4 }}>From → To</th>
              <th style={{ padding: 4 }}>Linked activity</th>
              <th style={{ padding: 4 }}>Mechanism</th>
              <th style={{ padding: 4 }}>Transfer impact assessment</th>
              <th style={{ padding: 4 }}>Notes</th>
              <th style={{ padding: 4 }}></th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((t) => (
              <tr
                key={t.id}
                style={{
                  borderBottom: "1px solid #eee",
                  background: t.mechanism === "none" ? "#fef2f2" : undefined,
                }}
              >
                <td style={{ padding: 4, fontWeight: 600 }}>
                  {t.fromJurisdiction} → {t.toJurisdiction}
                </td>
                <td style={{ padding: 4, fontSize: 13 }}>
                  {t.activityId ? activityNameById.get(t.activityId) ?? "—" : "—"}
                </td>
                <td colSpan={3} style={{ padding: 0 }}>
                  <form action={updateTransferAction} style={{ display: "flex", gap: 8, padding: 4 }}>
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
                    <button type="submit">Save</button>
                  </form>
                </td>
              </tr>
            ))}
            {transfers.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 8, color: "#666" }}>
                  No transfers logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <h2>Log a transfer</h2>
        <form action={createTransferAction} style={{ display: "grid", gap: 8, maxWidth: 480 }}>
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
          <button type="submit">Log transfer</button>
        </form>

        {activities.length === 0 && (
          <p style={{ fontSize: 13, color: "#666", marginTop: 8 }}>
            No processing activities yet — <Link href="/ropa">add one</Link> to link transfers to
            it (optional, but recommended).
          </p>
        )}
      </main>
    </>
  );
}
