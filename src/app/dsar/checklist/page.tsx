import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import AppShell from "@/components/AppShell";
import Card from "@/components/Card";
import Button from "@/components/Button";
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
    <AppShell>
      <div style={{ padding: "24px 28px", maxWidth: 760 }}>
        <h1 style={{ marginTop: 0 }}>DSAR checklist settings</h1>
        <p style={{ color: "var(--pq-ink-muted)", fontSize: 14, marginBottom: 22 }}>
          Per request-type checklists, seeded with a generic default the first time each type is
          touched. Changes here only affect <strong>new</strong> requests going forward —
          already-open requests keep the checklist they were created with (audit trail).
        </p>

        {templatesByType.map(({ type, items }) => (
          <Card key={type} title={DSAR_REQUEST_TYPE_LABELS[type]} style={{ marginBottom: 16 }}>
            <ul style={{ paddingLeft: 0, listStyle: "none", margin: "0 0 12px" }}>
              {items.map((item) => (
                <li
                  key={item.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    borderTop: "1px solid var(--pq-line)",
                    fontSize: 13,
                  }}
                >
                  <span>{item.label}</span>
                  <form action={removeChecklistTemplateItem}>
                    <input type="hidden" name="id" value={item.id} />
                    <Button type="submit" variant="ghost">
                      Remove
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
            <form action={addChecklistTemplateItem} style={{ display: "flex", gap: 8 }}>
              <input type="hidden" name="requestType" value={type} />
              <input name="label" placeholder="New checklist item" style={{ flex: 1 }} required />
              <Button type="submit" variant="secondary">
                Add
              </Button>
            </form>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
