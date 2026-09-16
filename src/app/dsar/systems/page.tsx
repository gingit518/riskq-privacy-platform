import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import AppShell from "@/components/AppShell";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import { listSystems } from "@/lib/dsar/systems";
import { addSystemAction, deactivateSystemAction, reactivateSystemAction } from "./actions";

export default async function DsarSystemsSettingsPage() {
  const session = await requireSession();
  if (!session) redirect("/login");

  const systems = await listSystems(session.orgId);

  return (
    <AppShell>
      <div style={{ padding: "24px 28px", maxWidth: 760 }}>
        <h1 style={{ marginTop: 0 }}>Systems Register</h1>
        <p style={{ color: "var(--pq-ink-muted)", fontSize: 14, marginBottom: 22 }}>
          Every system that may hold personal data, with an owner to notify. This does not search
          anything automatically — there is no generic way to query an arbitrary third-party
          system. What it does: every new DSAR request auto-creates one tracked, assignable task
          per active system below, so &quot;locate the data&quot; becomes a checklist of named
          owners instead of one vague instruction. Retiring a system here never changes the task
          list on a request already created against it (audit trail).
        </p>

        <Card style={{ marginBottom: 22, padding: systems.length > 0 ? 0 : "18px 20px" }}>
          {systems.length === 0 ? (
            <p style={{ margin: 0, color: "var(--pq-ink-muted)" }}>No systems registered yet.</p>
          ) : (
            <ul style={{ paddingLeft: 0, listStyle: "none", margin: 0 }}>
              {systems.map((s) => (
                <li
                  key={s.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 18px",
                    borderBottom: "1px solid var(--pq-line)",
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 13.5 }}>{s.name}</span>{" "}
                    {!s.active && <Badge variant="neutral">Retired</Badge>}
                    <div style={{ fontSize: 12.5, color: "var(--pq-ink-muted)", marginTop: 2 }}>
                      {s.ownerName || "No owner set"} {s.ownerEmail && `— ${s.ownerEmail}`}
                    </div>
                    {s.dataCategories && (
                      <div style={{ fontSize: 11.5, color: "var(--pq-ink-muted)" }}>{s.dataCategories}</div>
                    )}
                  </div>
                  <form action={s.active ? deactivateSystemAction : reactivateSystemAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <Button type="submit" variant="secondary">
                      {s.active ? "Retire" : "Reactivate"}
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Add a system">
          <form action={addSystemAction} style={{ display: "grid", gap: 12, maxWidth: 420 }}>
            <label>
              System name
              <input name="name" required style={{ display: "block", width: "100%", marginTop: 4 }} />
            </label>
            <label>
              Owner name
              <input name="ownerName" style={{ display: "block", width: "100%", marginTop: 4 }} />
            </label>
            <label>
              Owner email
              <input name="ownerEmail" type="email" style={{ display: "block", width: "100%", marginTop: 4 }} />
            </label>
            <label>
              Data categories held (free text)
              <input name="dataCategories" style={{ display: "block", width: "100%", marginTop: 4 }} />
            </label>
            <div>
              <Button type="submit" variant="primary">
                Add system
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
