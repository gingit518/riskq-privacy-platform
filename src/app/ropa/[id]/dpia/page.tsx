import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import AppShell from "@/components/AppShell";
import Card from "@/components/Card";
import Button from "@/components/Button";
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
    <AppShell>
      <div style={{ padding: "24px 28px", maxWidth: 800 }}>
        <p>
          <Link href={`/ropa/${activity.id}`}>&larr; {activity.name}</Link>
        </p>
        <h1 style={{ marginTop: 0 }}>DPIA — {activity.name}</h1>
        <Card style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: "var(--pq-ink-muted)", margin: 0 }}>
            Generic GDPR Art. 35-style question set — a reasonable starting template,{" "}
            <strong>not legally reviewed</strong>. Adapt or supplement before relying on it for a
            regulator-facing assessment (PRD §9).
          </p>
        </Card>

        {isCompleted && (
          <Card style={{ marginBottom: 16, background: "var(--pq-success-bg)" }}>
            <p style={{ margin: 0 }}>
              Completed{dpia!.riskRating ? ` — risk rating: ${DPIA_RISK_RATING_LABELS[dpia!.riskRating]}` : ""}
              . Answers below are read-only until reopened.
            </p>
            <form action={reopenDpiaAction} style={{ marginTop: 8 }}>
              <input type="hidden" name="activityId" value={activity.id} />
              <Button type="submit" variant="secondary">
                Reopen for editing
              </Button>
            </form>
          </Card>
        )}

        <form action={saveDpiaAnswersAction}>
          <input type="hidden" name="activityId" value={activity.id} />
          {DPIA_SECTIONS.map((section) => (
            <Card key={section} title={section} style={{ marginBottom: 14 }}>
              <fieldset disabled={isCompleted} style={{ border: "none", padding: 0, margin: 0 }}>
                {DPIA_QUESTIONS.filter((q) => q.section === section).map((q) => (
                  <div key={q.id} style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", fontSize: 14, marginBottom: 2 }}>{q.question}</label>
                    {q.helpText && (
                      <div style={{ fontSize: 12, color: "var(--pq-ink-muted)", marginBottom: 2 }}>
                        {q.helpText}
                      </div>
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
            </Card>
          ))}
          {!isCompleted && (
            <Button type="submit" variant="primary">
              Save answers
            </Button>
          )}
        </form>

        {!isCompleted && (
          <Card title="Complete this DPIA" style={{ marginTop: 20 }}>
            <form action={completeDpiaAction}>
              <input type="hidden" name="activityId" value={activity.id} />
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
              <Button type="submit" variant="primary">
                Mark completed
              </Button>
              <div style={{ fontSize: 12, color: "var(--pq-ink-muted)", marginTop: 6 }}>
                Also saves whatever answers are currently in the form above.
              </div>
            </form>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
