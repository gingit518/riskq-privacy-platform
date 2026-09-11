import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import Nav from "@/components/Nav";
import { getChecklistTemplate } from "@/lib/dsar/checklist";
import { DSAR_REQUEST_TYPES, DSAR_REQUEST_TYPE_LABELS } from "@/lib/dsar/types";
import { addChecklistTemplateItem, removeChecklistTemplateItem } from "../actions";

export default async function DsarChecklistSettingsPage() {
  const session = await requireSession();
  if (!session) redirect("/login");

  const templatesByType = await Promise.all(
    DSAR_REQUEST_TYPES.map(async (type) => ({
      type,
      items: await getChecklistTemplate(session.orgId, type),
    }))
  );

  return (
    <>
      <Nav />
      <main style={{ maxWidth: 700, margin: "40px auto", fontFamily: "system-ui", padding: "0 16px" }}>
        <h1>DSAR checklist settings</h1>
        <p style={{ color: "#666", fontSize: 14 }}>
          Per request-type checklists, seeded with a generic default the first
          time each type is touched. Changes here only affect{" "}
          <strong>new</strong> requests going forward — already-open requests
          keep the checklist they were created with (audit trail).
        </p>

        {templatesByType.map(({ type, items }) => (
          <section key={type} style={{ marginBottom: 32 }}>
            <h2>{DSAR_REQUEST_TYPE_LABELS[type]}</h2>
            <ul style={{ paddingLeft: 0, listStyle: "none" }}>
              {items.map((item) => (
                <li
                  key={item.id}
                  style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}
                >
                  <span>{item.label}</span>
                  <form action={removeChecklistTemplateItem}>
                    <input type="hidden" name="id" value={item.id} />
                    <button type="submit">Remove</button>
                  </form>
                </li>
              ))}
            </ul>
            <form action={addChecklistTemplateItem} style={{ display: "flex", gap: 8 }}>
              <input type="hidden" name="requestType" value={type} />
              <input name="label" placeholder="New checklist item" style={{ flex: 1 }} required />
              <button type="submit">Add</button>
            </form>
          </section>
        ))}
      </main>
    </>
  );
}
