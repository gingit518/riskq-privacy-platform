import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import AppShell from "@/components/AppShell";
import Card from "@/components/Card";
import Badge, { type BadgeVariant } from "@/components/Badge";
import Button from "@/components/Button";
import { listActivities, needsDpiaReview } from "@/lib/assessments/ropa";
import { getDpiaForActivity } from "@/lib/assessments/dpia";
import { listSystems } from "@/lib/dsar/systems";
import { createActivityAction } from "./actions";

/** RoPA reskinned in the PrivacyQ "Harbor" UI pass, Batch 7 (PRD §5.12),
 * alongside Transfers and Tracking Tech. No mockup exists for this page —
 * direct token application, same treatment as Controls/Assessments in
 * Batch 6. Data queries/actions unchanged. */
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
    <AppShell>
      <div style={{ padding: "24px 28px", maxWidth: 900 }}>
        <h1 style={{ marginTop: 0 }}>Records of Processing Activities (RoPA)</h1>
        <p style={{ color: "var(--pq-ink-muted)", fontSize: 14 }}>
          One row per distinct purpose data is processed for. &quot;Systems
          involved&quot; reuses the DSAR{" "}
          <Link href="/dsar/systems">Systems Register</Link> rather than a
          second list — register a system there first if it&apos;s not in the
          picker below.
        </p>

        <Card style={{ marginBottom: 24, padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--pq-ink-muted)" }}>
                <th style={{ padding: "10px 16px", fontWeight: 500 }}>Activity</th>
                <th style={{ padding: "10px 16px", fontWeight: 500 }}>Lawful basis</th>
                <th style={{ padding: "10px 16px", fontWeight: 500 }}>DPIA</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a, i) => {
                const dpia = dpiaStatuses[i];
                const flagged = needsDpiaReview(a);
                let dpiaLabel: string;
                let dpiaVariant: BadgeVariant;
                if (dpia) {
                  if (dpia.status === "completed") {
                    dpiaLabel = `Completed${dpia.riskRating ? ` (${dpia.riskRating} risk)` : ""}`;
                    dpiaVariant = "success";
                  } else {
                    dpiaLabel = "Draft in progress";
                    dpiaVariant = "warning";
                  }
                } else if (flagged) {
                  dpiaLabel = "Recommended — not started";
                  dpiaVariant = "danger";
                } else {
                  dpiaLabel = "Not flagged";
                  dpiaVariant = "neutral";
                }
                return (
                  <tr key={a.id} style={{ borderTop: "1px solid var(--pq-line)" }}>
                    <td style={{ padding: "10px 16px" }}>
                      <Link href={`/ropa/${a.id}`}>{a.name}</Link>
                      <div style={{ fontSize: 12, color: "var(--pq-ink-muted)" }}>{a.purpose}</div>
                    </td>
                    <td style={{ padding: "10px 16px" }}>{a.lawfulBasis || "—"}</td>
                    <td style={{ padding: "10px 16px" }}>
                      <Badge variant={dpiaVariant}>{dpiaLabel}</Badge>
                    </td>
                  </tr>
                );
              })}
              {activities.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: 16, color: "var(--pq-ink-muted)" }}>
                    No processing activities recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        <Card title="Add a processing activity">
          <form action={createActivityAction} style={{ display: "grid", gap: 10, maxWidth: 560 }}>
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
              <div style={{ fontSize: 12, color: "var(--pq-ink-muted)", marginTop: 4 }}>
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
                <div style={{ fontSize: 13, color: "var(--pq-ink-muted)" }}>
                  No active systems registered — see the{" "}
                  <Link href="/dsar/systems">Systems Register</Link>.
                </div>
              )}
            </div>

            <div>
              <Button type="submit" variant="primary">
                Add activity
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
