import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import AppShell from "@/components/AppShell";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import { getActivity, listActivitySystems, needsDpiaReview } from "@/lib/assessments/ropa";
import { getDpiaForActivity } from "@/lib/assessments/dpia";
import { listTransfersForActivity } from "@/lib/assessments/transfers";
import { listSystems } from "@/lib/dsar/systems";
import { updateActivitySystemsAction, startDpiaAction } from "../actions";

export default async function ActivityDetailPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session) redirect("/login");

  const activity = await getActivity(session.orgId, params.id);
  if (!activity) notFound();

  const [linkedSystems, allSystems, dpia, transfers] = await Promise.all([
    listActivitySystems(activity.id),
    listSystems(session.orgId),
    getDpiaForActivity(session.orgId, activity.id),
    listTransfersForActivity(session.orgId, activity.id),
  ]);

  const linkedIds = new Set(linkedSystems.map((s) => s.id));
  const flagged = needsDpiaReview(activity);

  return (
    <AppShell>
      <div style={{ padding: "24px 28px", maxWidth: 800 }}>
        <p>
          <Link href="/ropa">&larr; All processing activities</Link>
        </p>
        <h1 style={{ marginTop: 0 }}>{activity.name}</h1>

        <Card style={{ marginBottom: 20 }}>
          <table style={{ width: "100%", fontSize: 14 }}>
            <tbody>
              <tr>
                <td style={{ padding: 4, color: "var(--pq-ink-muted)", width: 160 }}>Purpose</td>
                <td style={{ padding: 4 }}>{activity.purpose || "—"}</td>
              </tr>
              <tr>
                <td style={{ padding: 4, color: "var(--pq-ink-muted)" }}>Data categories</td>
                <td style={{ padding: 4 }}>{(activity.dataCategories as string[]).join(", ") || "—"}</td>
              </tr>
              <tr>
                <td style={{ padding: 4, color: "var(--pq-ink-muted)" }}>Data subjects</td>
                <td style={{ padding: 4 }}>{activity.dataSubjects || "—"}</td>
              </tr>
              <tr>
                <td style={{ padding: 4, color: "var(--pq-ink-muted)" }}>Lawful basis</td>
                <td style={{ padding: 4 }}>{activity.lawfulBasis || "—"}</td>
              </tr>
              <tr>
                <td style={{ padding: 4, color: "var(--pq-ink-muted)" }}>Retention period</td>
                <td style={{ padding: 4 }}>{activity.retentionPeriod || "—"}</td>
              </tr>
              <tr>
                <td style={{ padding: 4, color: "var(--pq-ink-muted)" }}>Risk flags</td>
                <td style={{ padding: 4 }}>
                  {[
                    activity.specialCategoryData && "Special-category data",
                    activity.largeScaleProcessing && "Large-scale processing",
                    activity.automatedDecisionMaking && "Automated decision-making",
                  ]
                    .filter(Boolean)
                    .join(", ") || "None"}
                </td>
              </tr>
            </tbody>
          </table>
        </Card>

        <Card
          title="DPIA"
          style={{ marginBottom: 20, background: flagged && !dpia ? "var(--pq-warning-bg)" : undefined }}
        >
          {dpia ? (
            <p style={{ margin: 0 }}>
              Status:{" "}
              <Badge variant={dpia.status === "completed" ? "success" : "warning"}>
                {dpia.status === "completed" ? "Completed" : "Draft"}
              </Badge>
              {dpia.riskRating && ` — risk rating: ${dpia.riskRating}`}
              <br />
              <Link href={`/ropa/${activity.id}/dpia`}>Open DPIA →</Link>
            </p>
          ) : (
            <>
              <p>
                {flagged
                  ? "Recommended based on the risk flags above (PRD §5.5 criteria) — not started yet."
                  : "No risk flags set; a DPIA is optional here, but you can still start one."}
              </p>
              <form action={startDpiaAction}>
                <input type="hidden" name="activityId" value={activity.id} />
                <Button type="submit" variant="primary">
                  Start DPIA
                </Button>
              </form>
            </>
          )}
        </Card>

        <Card title="Systems involved" style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 13, color: "var(--pq-ink-muted)" }}>
            Reflects the live <Link href="/dsar/systems">Systems Register</Link> — unlike a DSAR
            request&apos;s task list, this is NOT a snapshot, so retiring/renaming a system there
            updates what shows here immediately.
          </p>
          <form action={updateActivitySystemsAction}>
            <input type="hidden" name="activityId" value={activity.id} />
            {allSystems.map((s) => (
              <label key={s.id} style={{ display: "block", fontSize: 14, opacity: s.active ? 1 : 0.5 }}>
                <input type="checkbox" name="systemIds" value={s.id} defaultChecked={linkedIds.has(s.id)} />{" "}
                {s.name}
                {!s.active && " (retired)"}
              </label>
            ))}
            {allSystems.length === 0 && (
              <p style={{ fontSize: 13, color: "var(--pq-ink-muted)" }}>No systems registered yet.</p>
            )}
            <Button type="submit" variant="secondary" style={{ marginTop: 8 }}>
              Save systems
            </Button>
          </form>
        </Card>

        <Card title="International transfers">
          {transfers.length > 0 ? (
            <ul style={{ paddingLeft: 16, margin: 0 }}>
              {transfers.map((t) => (
                <li key={t.id} style={{ fontSize: 14 }}>
                  {t.fromJurisdiction} → {t.toJurisdiction} — mechanism: {t.mechanism}
                  {t.mechanism === "none" && (
                    <span style={{ marginLeft: 6 }}>
                      <Badge variant="danger">No mechanism</Badge>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: 13, color: "var(--pq-ink-muted)", margin: 0 }}>
              No transfers logged against this activity yet. Log one from the{" "}
              <Link href="/transfers">International Transfers</Link> registry.
            </p>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
