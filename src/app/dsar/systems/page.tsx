import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import Nav from "@/components/Nav";
import { listSystems } from "@/lib/dsar/systems";
import { addSystemAction, deactivateSystemAction, reactivateSystemAction } from "./actions";

export default async function DsarSystemsSettingsPage() {
  const session = await requireSession();
  if (!session) redirect("/login");

  const systems = await listSystems(session.orgId);

  return (
    <>
      <Nav />
      <main style={{ maxWidth: 700, margin: "40px auto", fontFamily: "system-ui", padding: "0 16px" }}>
        <h1>Systems Register</h1>
        <p style={{ color: "#666", fontSize: 14 }}>
          Every system that may hold personal data, with an owner to notify.
          This does not search anything automatically — there is no generic
          way to query an arbitrary third-party system. What it does: every
          new DSAR request auto-creates one tracked, assignable task per
          active system below, so &quot;locate the data&quot; becomes a
          checklist of named owners instead of one vague instruction.
          Retiring a system here never changes the task list on a request
          already created against it (audit trail).
        </p>

        <ul style={{ paddingLeft: 0, listStyle: "none", marginBottom: 24 }}>
          {systems.map((s) => (
            <li
              key={s.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 0",
                borderBottom: "1px solid #eee",
                opacity: s.active ? 1 : 0.5,
              }}
            >
              <div>
                <strong>{s.name}</strong>
                {!s.active && <span style={{ fontSize: 12, color: "#666" }}> (retired)</span>}
                <div style={{ fontSize: 13, color: "#666" }}>
                  {s.ownerName || "No owner set"} {s.ownerEmail && `— ${s.ownerEmail}`}
                </div>
                {s.dataCategories && (
                  <div style={{ fontSize: 12, color: "#888" }}>{s.dataCategories}</div>
                )}
              </div>
              <form action={s.active ? deactivateSystemAction : reactivateSystemAction}>
                <input type="hidden" name="id" value={s.id} />
                <button type="submit">{s.active ? "Retire" : "Reactivate"}</button>
              </form>
            </li>
          ))}
          {systems.length === 0 && (
            <li style={{ color: "#666", padding: "8px 0" }}>No systems registered yet.</li>
          )}
        </ul>

        <h2>Add a system</h2>
        <form action={addSystemAction} style={{ display: "grid", gap: 8, maxWidth: 400 }}>
          <label>
            System name
            <input name="name" required style={{ display: "block", width: "100%" }} />
          </label>
          <label>
            Owner name
            <input name="ownerName" style={{ display: "block", width: "100%" }} />
          </label>
          <label>
            Owner email
            <input name="ownerEmail" type="email" style={{ display: "block", width: "100%" }} />
          </label>
          <label>
            Data categories held (free text)
            <input name="dataCategories" style={{ display: "block", width: "100%" }} />
          </label>
          <button type="submit">Add system</button>
        </form>
      </main>
    </>
  );
}
