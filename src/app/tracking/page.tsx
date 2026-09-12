import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import Nav from "@/components/Nav";
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

export default async function TrackingPage() {
  const session = await requireSession();
  if (!session) redirect("/login");

  const [technologies, consentRegs] = await Promise.all([
    listTrackingTechnologies(session.orgId),
    listConsentRequiredRegulationsInScope(session.orgId),
  ]);

  return (
    <>
      <Nav />
      <main style={{ maxWidth: 900, margin: "40px auto", fontFamily: "system-ui", padding: "0 16px" }}>
        <h1>Tracking technologies</h1>
        <p style={{ color: "#666", fontSize: 14 }}>
          Manual registry of cookies, tags, SDKs, and pixels — nothing here scans your site
          automatically; live scanning and consent enforcement (CMP) is a separate, larger build
          not yet started (PRD §5.9).
        </p>

        <div style={{ padding: 8, background: consentRegs.length > 0 ? "#fff7ed" : "#f5f5f5", marginBottom: 16 }}>
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
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
              <th style={{ padding: 4 }}>Name</th>
              <th style={{ padding: 4 }}>Category</th>
              <th style={{ padding: 4 }}>Party</th>
              <th style={{ padding: 4 }}>Retention</th>
              <th style={{ padding: 4 }}></th>
            </tr>
          </thead>
          <tbody>
            {technologies.map((t) => (
              <tr key={t.id} style={{ borderBottom: "1px solid #eee", opacity: t.active ? 1 : 0.5 }}>
                <td style={{ padding: 4 }}>
                  <strong>{t.name}</strong>
                  {!t.active && <span style={{ fontSize: 12, color: "#666" }}> (retired)</span>}
                  <div style={{ fontSize: 12, color: "#666" }}>{t.purpose}</div>
                </td>
                <td style={{ padding: 4, fontSize: 13 }}>{TRACKING_CATEGORY_LABELS[t.category]}</td>
                <td style={{ padding: 4, fontSize: 13 }}>{TRACKING_PARTY_LABELS[t.party]}</td>
                <td style={{ padding: 4, fontSize: 13 }}>{t.retention || "—"}</td>
                <td style={{ padding: 4 }}>
                  <form action={t.active ? deactivateTrackingTechnologyAction : reactivateTrackingTechnologyAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <button type="submit">{t.active ? "Retire" : "Reactivate"}</button>
                  </form>
                </td>
              </tr>
            ))}
            {technologies.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 8, color: "#666" }}>
                  Nothing registered yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <h2>Add a tracking technology</h2>
        <form action={addTrackingTechnologyAction} style={{ display: "grid", gap: 8, maxWidth: 480 }}>
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
          <button type="submit">Add</button>
        </form>
      </main>
    </>
  );
}
