import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import Nav from "@/components/Nav";
import { getActivity } from "@/lib/assessments/ropa";
import { getDpiaForActivity } from "@/lib/assessments/dpia";
import { DPIA_QUESTIONS, DPIA_SECTIONS } from "@/lib/assessments/dpia-questions";
import { DPIA_RISK_RATINGS, DPIA_RISK_RATING_LABELS } from "@/lib/assessments/types";
import { saveDpiaAnswersAction, completeDpiaAction, reopenDpiaAction } from "../../actions";

export default async function DpiaPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session) redirect("/login");

  const activity = await getActivity(session.orgId, params.id);
  if (!activity) notFound();

  const dpia = await getDpiaForActivity(session.orgId, activity.id);
  if (!dpia) {
    // Not started — send back to the activity page, which has the "Start
    // DPIA" button (idempotent create), rather than duplicating that here.
    redirect(`/ropa/${activity.id}`);
  }

  const answers = (dpia!.answers as Record<string, string>) ?? {};
  const isCompleted = dpia!.status === "completed";

  return (
    <>
      <Nav />
      <main style={{ maxWidth: 800, margin: "40px auto", fontFamily: "system-ui", padding: "0 16px" }}>
        <p>
          <Link href={`/ropa/${activity.id}`}>&larr; {activity.name}</Link>
        </p>
        <h1>DPIA — {activity.name}</h1>
        <p style={{ fontSize: 13, color: "#666", padding: 8, background: "#f5f5f5" }}>
          Generic GDPR Art. 35-style question set — a reasonable starting template, <strong>not
          legally reviewed</strong>. Adapt or supplement before relying on it for a regulator-facing
          assessment (PRD §9).
        </p>

        {isCompleted && (
          <div style={{ padding: 8, background: "#ecfdf5", marginBottom: 16 }}>
            Completed{dpia!.riskRating ? ` — risk rating: ${DPIA_RISK_RATING_LABELS[dpia!.riskRating]}` : ""}
            . Answers below are read-only until reopened.
            <form action={reopenDpiaAction} style={{ marginTop: 8 }}>
              <input type="hidden" name="activityId" value={activity.id} />
              <button type="submit">Reopen for editing</button>
            </form>
          </div>
        )}

        <form action={saveDpiaAnswersAction}>
          <input type="hidden" name="activityId" value={activity.id} />
          {DPIA_SECTIONS.map((section) => (
            <fieldset key={section} disabled={isCompleted} style={{ marginBottom: 16, border: "1px solid #ddd", padding: 12 }}>
              <legend style={{ fontWeight: 600 }}>{section}</legend>
              {DPIA_QUESTIONS.filter((q) => q.section === section).map((q) => (
                <div key={q.id} style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 14, marginBottom: 2 }}>{q.question}</label>
                  {q.helpText && (
                    <div style={{ fontSize: 12, color: "#666", marginBottom: 2 }}>{q.helpText}</div>
                  )}
                  <textarea
                    name={q.id}
                    rows={2}
                    defaultValue={answers[q.id] ?? ""}
                    style={{ display: "block", width: "100%" }}
                  />
                </div>
              ))}
            </fieldset>
          ))}
          {!isCompleted && <button type="submit">Save answers</button>}
        </form>

        {!isCompleted && (
          <form action={completeDpiaAction} style={{ marginTop: 24, padding: 12, border: "1px solid #ddd" }}>
            <input type="hidden" name="activityId" value={activity.id} />
            <h2 style={{ marginTop: 0 }}>Complete this DPIA</h2>
            <label style={{ display: "block", marginBottom: 8 }}>
              Overall risk rating
              <select name="riskRating" defaultValue={dpia!.riskRating ?? "low"} style={{ display: "block" }}>
                {DPIA_RISK_RATINGS.map((r) => (
                  <option key={r} value={r}>
                    {DPIA_RISK_RATING_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "block", marginBottom: 8 }}>
              Mitigations / residual risk summary
              <textarea
                name="mitigations"
                rows={3}
                defaultValue={dpia!.mitigations ?? ""}
                style={{ display: "block", width: "100%" }}
              />
            </label>
            <button type="submit">Mark completed</button>
            <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
              Also saves whatever answers are currently in the form above.
            </div>
          </form>
        )}
      </main>
    </>
  );
}
