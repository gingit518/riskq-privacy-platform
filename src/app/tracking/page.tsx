import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import AppShell from "@/components/AppShell";
import Card from "@/components/Card";
import Button from "@/components/Button";
import { listTrackingTechnologies, listConsentRequiredRegulationsInScope } from "@/lib/tracking/tracking";
import {
  TRACKING_CATEGORIES,
  TRACKING_CATEGORY_LABELS,
  TRACKING_PARTIES,
  TRACKING_PARTY_LABELS,
} from "@/lib/tracking/types";
import {
  addTrackingTechnologyAction,
  deactivateTrackingTechnologyAction,
  reactivateTrackingTechnologyAction,
} from "./actions";

/** Tracking Technologies, reskinned Batch 7 (PRD §5.12) alongside RoPA and
 * Transfers — direct token application, no dedicated mockup. Data
 * queries/actions unchanged. */
export default async function TrackingPage() {
  const session = await requireSession();
  if (!session) redirect("/login");

  const [technologies, consentRegs] = await Promise.all([
    listTrackingTechnologies(session.orgId),
    listConsentRequiredRegulationsInScope(session.orgId),
  ]);

  return (
    <AppShell>
      <div style={{ padding: "24px 28px", maxWidth: 980 }}>
        <h1 style={{ marginTop: 0 }}>Tracking technologies</h1>
        <p style={{ color: "var(--pq-ink-muted)", fontSize: 14 }}>
          Manual registry of cookies, tags, SDKs, and pixels — nothing here scans your site
          automatically; live scanning and consent enforcement (CMP) is a separate, larger build
          not yet started (PRD §5.9).
        </p>

        <Card
          style={{
            marginBottom: 20,
            background: consentRegs.length > 0 ? "var(--pq-warning-bg)" : "var(--pq-surface)",
          }}
        >
          {consentRegs.length > 0 ? (
            <>
              <strong>{consentRegs.length}</strong> regulation{consentRegs.length === 1 ? "" : "s"} in
              your current scope require cookie/tracker consent:{" "}
              {consentRegs.map((r) => r.acronym).join(", ")}. Use this to decide which entries below
              need a consent mechanism before firing — this list is my own indicative tagging, not a
              legally-reviewed determination (see README).
            </>
          ) : (
            <>
              None of your currently in-scope regulations are tagged as requiring cookie/tracker
              consent (or you haven&apos;t run &quot;Analyze scope&quot; yet on{" "}
              <a href="/profile">Profile</a>).
            </>
          )}
        </Card>

        <Card style={{ marginBottom: 24, padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--pq-ink-muted)" }}>
                <th style={{ padding: "10px 16px", fontWeight: 500 }}>Name</th>
                <th style={{ padding: "10px 16px", fontWeight: 500 }}>Category</th>
                <th style={{ padding: "10px 16px", fontWeight: 500 }}>Party</th>
                <th style={{ padding: "10px 16px", fontWeight: 500 }}>Retention</th>
                <th style={{ padding: "10px 16px", fontWeight: 500 }}></th>
              </tr>
            </thead>
            <tbody>
              {technologies.map((t) => (
                <tr key={t.id} style={{ borderTop: "1px solid var(--pq-line)", opacity: t.active ? 1 : 0.5 }}>
                  <td style={{ padding: "10px 16px" }}>
                    <strong>{t.name}</strong>
                    {!t.active && (
                      <span style={{ fontSize: 12, color: "var(--pq-ink-muted)" }}> (retired)</span>
                    )}
                    <div style={{ fontSize: 12, color: "var(--pq-ink-muted)" }}>{t.purpose}</div>
                  </td>
                  <td style={{ padding: "10px 16px" }}>{TRACKING_CATEGORY_LABELS[t.category]}</td>
                  <td style={{ padding: "10px 16px" }}>{TRACKING_PARTY_LABELS[t.party]}</td>
                  <td style={{ padding: "10px 16px" }}>{t.retention || "—"}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <form action={t.active ? deactivateTrackingTechnologyAction : reactivateTrackingTechnologyAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <Button type="submit" variant="secondary">
                        {t.active ? "Retire" : "Reactivate"}
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
              {technologies.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 16, color: "var(--pq-ink-muted)" }}>
                    Nothing registered yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        <Card title="Add a tracking technology">
          <form action={addTrackingTechnologyAction} style={{ display: "grid", gap: 10, maxWidth: 480 }}>
            <label>
              Name
              <input name="name" required placeholder="e.g. Google Analytics" style={{ display: "block", width: "100%" }} />
            </label>
            <label>
              Purpose
              <input name="purpose" style={{ display: "block", width: "100%" }} />
            </label>
            <label>
              Category
              <select name="category" defaultValue="other" style={{ display: "block", width: "100%" }}>
                {TRACKING_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {TRACKING_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Party
              <select name="party" defaultValue="third_party" style={{ display: "block", width: "100%" }}>
                {TRACKING_PARTIES.map((p) => (
                  <option key={p} value={p}>
                    {TRACKING_PARTY_LABELS[p]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Retention
              <input name="retention" placeholder="e.g. 2 years" style={{ display: "block", width: "100%" }} />
            </label>
            <div>
              <Button type="submit" variant="primary">
                Add
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
