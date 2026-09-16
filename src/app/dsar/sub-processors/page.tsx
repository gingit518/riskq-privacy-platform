import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import AppShell from "@/components/AppShell";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import { listSubProcessors, subProcessorNoticeTemplate } from "@/lib/dsar/sub-processors";
import { addSubProcessorAction, deactivateSubProcessorAction, reactivateSubProcessorAction } from "./actions";

export default async function SubProcessorsPage() {
  const session = await requireSession();
  if (!session) redirect("/login");

  const processors = await listSubProcessors(session.orgId);

  return (
    <AppShell>
      <div style={{ padding: "24px 28px", maxWidth: 760 }}>
        <h1 style={{ marginTop: 0 }}>Sub-processors</h1>
        <p style={{ color: "var(--pq-ink-muted)", fontSize: 14, marginBottom: 22 }}>
          A GDPR Art. 17(2)-style notification list (§5.10) — downstream processors who may have
          received data that a deletion request now needs to reach. This is deliberately NOT a
          vendor/TPRM risk assessment (that stays out of scope, PRD §4/§10) — just enough to know
          who to notify. Notification is a manual, copy-ready template below, not an automated
          send, since nothing here tracks what a specific processor actually received for a given
          requester.
        </p>

        <Card style={{ marginBottom: 22, padding: processors.length > 0 ? 0 : "18px 20px" }}>
          {processors.length === 0 ? (
            <p style={{ margin: 0, color: "var(--pq-ink-muted)" }}>No sub-processors registered yet.</p>
          ) : (
            <ul style={{ paddingLeft: 0, listStyle: "none", margin: 0 }}>
              {processors.map((p) => (
                <li
                  key={p.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 18px",
                    borderBottom: "1px solid var(--pq-line)",
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 13.5 }}>{p.name}</span>{" "}
                    {!p.active && <Badge variant="neutral">Retired</Badge>}
                    <div style={{ fontSize: 12.5, color: "var(--pq-ink-muted)", marginTop: 2 }}>
                      {p.contactEmail || "No contact set"} {p.dataCategories && `— ${p.dataCategories}`}
                    </div>
                  </div>
                  <form action={p.active ? deactivateSubProcessorAction : reactivateSubProcessorAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <Button type="submit" variant="secondary">
                      {p.active ? "Retire" : "Reactivate"}
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Add a sub-processor" style={{ marginBottom: 22 }}>
          <form action={addSubProcessorAction} style={{ display: "grid", gap: 12, maxWidth: 420 }}>
            <label>
              Name
              <input name="name" required style={{ display: "block", width: "100%", marginTop: 4 }} />
            </label>
            <label>
              Contact email
              <input name="contactEmail" type="email" style={{ display: "block", width: "100%", marginTop: 4 }} />
            </label>
            <label>
              Data categories they receive (free text)
              <input name="dataCategories" style={{ display: "block", width: "100%", marginTop: 4 }} />
            </label>
            <div>
              <Button type="submit" variant="primary">
                Add sub-processor
              </Button>
            </div>
          </form>
        </Card>

        <Card title="Sample notice">
          <p style={{ color: "var(--pq-ink-muted)", fontSize: 13 }}>
            Copy/paste starting point once a deletion executes — fill in the sub-processor name
            and requester email:
          </p>
          <pre
            style={{
              background: "var(--pq-neutral-bg)",
              padding: 12,
              fontSize: 13,
              whiteSpace: "pre-wrap",
              borderRadius: 8,
              margin: 0,
            }}
          >
            {subProcessorNoticeTemplate({
              subProcessorName: "<Sub-processor name>",
              requesterEmail: "<requester email>",
              matter: "deletion",
            }).body}
          </pre>
        </Card>
      </div>
    </AppShell>
  );
}
