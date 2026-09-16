import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import AppShell from "@/components/AppShell";
import { listSubProcessors, subProcessorNoticeTemplate } from "@/lib/dsar/sub-processors";
import { addSubProcessorAction, deactivateSubProcessorAction, reactivateSubProcessorAction } from "./actions";

export default async function SubProcessorsPage() {
  const session = await requireSession();
  if (!session) redirect("/login");

  const processors = await listSubProcessors(session.orgId);

  return (
    <AppShell>
      <main style={{ maxWidth: 700, margin: "40px auto", fontFamily: "system-ui", padding: "0 16px" }}>
        <h1>Sub-processors</h1>
        <p style={{ color: "#666", fontSize: 14 }}>
          A GDPR Art. 17(2)-style notification list (§5.10) — downstream
          processors who may have received data that a deletion request now
          needs to reach. This is deliberately NOT a vendor/TPRM risk
          assessment (that stays out of scope, PRD §4/§10) — just enough to
          know who to notify. Notification is a manual, copy-ready template
          below, not an automated send, since nothing here tracks what a
          specific processor actually received for a given requester.
        </p>

        <ul style={{ paddingLeft: 0, listStyle: "none", marginBottom: 24 }}>
          {processors.map((p) => (
            <li
              key={p.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 0",
                borderBottom: "1px solid #eee",
                opacity: p.active ? 1 : 0.5,
              }}
            >
              <div>
                <strong>{p.name}</strong>
                {!p.active && <span style={{ fontSize: 12, color: "#666" }}> (retired)</span>}
                <div style={{ fontSize: 13, color: "#666" }}>
                  {p.contactEmail || "No contact set"} {p.dataCategories && `— ${p.dataCategories}`}
                </div>
              </div>
              <form action={p.active ? deactivateSubProcessorAction : reactivateSubProcessorAction}>
                <input type="hidden" name="id" value={p.id} />
                <button type="submit">{p.active ? "Retire" : "Reactivate"}</button>
              </form>
            </li>
          ))}
          {processors.length === 0 && (
            <li style={{ color: "#666", padding: "8px 0" }}>No sub-processors registered yet.</li>
          )}
        </ul>

        <h2>Add a sub-processor</h2>
        <form action={addSubProcessorAction} style={{ display: "grid", gap: 8, maxWidth: 400, marginBottom: 24 }}>
          <label>
            Name
            <input name="name" required style={{ display: "block", width: "100%" }} />
          </label>
          <label>
            Contact email
            <input name="contactEmail" type="email" style={{ display: "block", width: "100%" }} />
          </label>
          <label>
            Data categories they receive (free text)
            <input name="dataCategories" style={{ display: "block", width: "100%" }} />
          </label>
          <button type="submit">Add sub-processor</button>
        </form>

        <h2>Sample notice</h2>
        <p style={{ color: "#666", fontSize: 13 }}>
          Copy/paste starting point once a deletion executes — fill in the
          sub-processor name and requester email:
        </p>
        <pre style={{ background: "#f7f7f7", padding: 12, fontSize: 13, whiteSpace: "pre-wrap" }}>
          {subProcessorNoticeTemplate({
            subProcessorName: "<Sub-processor name>",
            requesterEmail: "<requester email>",
            matter: "deletion",
          }).body}
        </pre>
      </main>
    </AppShell>
  );
}
