import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import Nav from "@/components/Nav";
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
    <>
      <Nav />
      <main style={{ maxWidth: 800, margin: "40px auto", fontFamily: "system-ui", padding: "0 16px" }}>
        <p>
          <Link href="/ropa">&larr; All processing activities</Link>
        </p>
        <h1>{activity.name}</h1>

        <table style={{ width: "100%", marginBottom: 24, fontSize: 14 }}>
          <tbody>
            <tr>
              <td style={{ padding: 4, color: "#666", width: 160 }}>Purpose</td>
              <td style={{ padding: 4 }}>{activity.purpose || "—"}</td>
            </tr>
            <tr>
              <td style={{ padding: 4, color: "#666" }}>Data categories</td>
              <td style={{ padding: 4 }}>{(activity.dataCategories as string[]).join(", ") || "—"}</td>
            </tr>
            <tr>
              <td style={{ padding: 4, color: "#666" }}>Data subjects</td>
              <td style={{ padding: 4 }}>{activity.dataSubjects || "—"}</td>
            </tr>
            <tr>
              <td style={{ padding: 4, color: "#666" }}>Lawful basis</td>
              <td style={{ padding: 4 }}>{activity.lawfulBasis || "—"}</td>
            </tr>
            <tr>
              <td style={{ padding: 4, color: "#666" }}>Retention period</td>
              <td style={{ padding: 4 }}>{activity.retentionPeriod || "—"}</td>
            </tr>
            <tr>
              <td style={{ padding: 4, color: "#666" }}>Risk flags</td>
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

        <section style={{ marginBottom: 24, padding: 12, background: flagged ? "#fff7ed" : "#f5f5f5" }}>
          <h2 style={{ marginTop: 0 }}>DPIA</h2>
          {dpia ? (
            <p>
              Status: <strong>{dpia.status === "completed" ? "Completed" : "Draft"}</strong>
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
                <button type="submit">Start DPIA</button>
              </form>
            </>
          )}
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2>Systems involved</h2>
          <p style={{ fontSize: 13, color: "#666" }}>
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
              <p style={{ fontSize: 13, color: "#666" }}>No systems registered yet.</p>
            )}
            <button type="submit" style={{ marginTop: 8 }}>
              Save systems
            </button>
          </form>
        </section>

        <section>
          <h2>International transfers</h2>
          {transfers.length > 0 ? (
            <ul style={{ paddingLeft: 16 }}>
              {transfers.map((t) => (
                <li key={t.id} style={{ fontSize: 14 }}>
                  {t.fromJurisdiction} → {t.toJurisdiction} — mechanism: {t.mechanism}
                  {t.mechanism === "none" && (
                    <span style={{ color: "#b91c1c" }}> (no mechanism in place)</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: 13, color: "#666" }}>
              No transfers logged against this activity yet. Log one from the{" "}
              <Link href="/transfers">International Transfers</Link> registry.
            </p>
          )}
        </section>
      </main>
    </>
  );
}
