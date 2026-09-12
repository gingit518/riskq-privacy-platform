import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import Nav from "@/components/Nav";
import { listActivities, needsDpiaReview } from "@/lib/assessments/ropa";
import { getDpiaForActivity } from "@/lib/assessments/dpia";
import { listSystems } from "@/lib/dsar/systems";
import { createActivityAction } from "./actions";

export default async function RopaPage() {
  const session = await requireSession();
  if (!session) redirect("/login");

  const [activities, systems] = await Promise.all([
    listActivities(session.orgId),
    listSystems(session.orgId),
  ]);

  const dpiaStatuses = await Promise.all(
    activities.map((a) => getDpiaForActivity(session.orgId, a.id))
  );

  return (
    <>
      <Nav />
      <main style={{ maxWidth: 900, margin: "40px auto", fontFamily: "system-ui", padding: "0 16px" }}>
        <h1>Records of Processing Activities (RoPA)</h1>
        <p style={{ color: "#666", fontSize: 14 }}>
          One row per distinct purpose data is processed for. &quot;Systems
          involved&quot; reuses the DSAR{" "}
          <Link href="/dsar/systems">Systems Register</Link> rather than a
          second list — register a system there first if it&apos;s not in the
          picker below.
        </p>

        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
              <th style={{ padding: 4 }}>Activity</th>
              <th style={{ padding: 4 }}>Lawful basis</th>
              <th style={{ padding: 4 }}>DPIA</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((a, i) => {
              const dpia = dpiaStatuses[i];
              const flagged = needsDpiaReview(a);
              return (
                <tr key={a.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 4 }}>
                    <Link href={`/ropa/${a.id}`}>{a.name}</Link>
                    <div style={{ fontSize: 12, color: "#666" }}>{a.purpose}</div>
                  </td>
                  <td style={{ padding: 4, fontSize: 13 }}>{a.lawfulBasis || "—"}</td>
                  <td style={{ padding: 4, fontSize: 13 }}>
                    {dpia ? (
                      dpia.status === "completed" ? (
                        <span>Completed{dpia.riskRating ? ` (${dpia.riskRating} risk)` : ""}</span>
                      ) : (
                        <span>Draft in progress</span>
                      )
                    ) : flagged ? (
                      <span style={{ color: "#b45309" }}>Recommended — not started</span>
                    ) : (
                      <span style={{ color: "#999" }}>Not flagged</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {activities.length === 0 && (
              <tr>
                <td colSpan={3} style={{ padding: 8, color: "#666" }}>
                  No processing activities recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <h2>Add a processing activity</h2>
        <form action={createActivityAction} style={{ display: "grid", gap: 8, maxWidth: 560 }}>
          <label>
            Activity name
            <input name="name" required style={{ display: "block", width: "100%" }} />
          </label>
          <label>
            Purpose
            <textarea name="purpose" rows={2} style={{ display: "block", width: "100%" }} />
          </label>
          <label>
            Data categories (comma-separated)
            <input name="dataCategories" style={{ display: "block", width: "100%" }} />
          </label>
          <label>
            Data subjects
            <input name="dataSubjects" placeholder="e.g. Customers, employees" style={{ display: "block", width: "100%" }} />
          </label>
          <label>
            Lawful basis
            <input name="lawfulBasis" style={{ display: "block", width: "100%" }} />
          </label>
          <label>
            Retention period
            <input name="retentionPeriod" style={{ display: "block", width: "100%" }} />
          </label>

          <div>
            <label style={{ display: "block" }}>
              <input type="checkbox" name="specialCategoryData" /> Involves special-category /
              sensitive data
            </label>
            <label style={{ display: "block" }}>
              <input type="checkbox" name="largeScaleProcessing" /> Large-scale processing
            </label>
            <label style={{ display: "block" }}>
              <input type="checkbox" name="automatedDecisionMaking" /> Automated
              decision-making
            </label>
            <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
              Checking any of these flags this activity as DPIA-recommended (PRD §5.5
              criteria) — it does not force one; a human still decides.
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Systems involved</div>
            {systems.filter((s) => s.active).map((s) => (
              <label key={s.id} style={{ display: "block", fontSize: 14 }}>
                <input type="checkbox" name="systemIds" value={s.id} /> {s.name}
              </label>
            ))}
            {systems.filter((s) => s.active).length === 0 && (
              <div style={{ fontSize: 13, color: "#666" }}>
                No active systems registered — see the{" "}
                <Link href="/dsar/systems">Systems Register</Link>.
              </div>
            )}
          </div>

          <button type="submit">Add activity</button>
        </form>
      </main>
    </>
  );
}
