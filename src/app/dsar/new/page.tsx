import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import AppShell from "@/components/AppShell";
import Card from "@/components/Card";
import Button from "@/components/Button";
import { DSAR_REQUEST_TYPES, DSAR_REQUEST_TYPE_LABELS } from "@/lib/dsar/types";
import { createInternalDsarRequest } from "../actions";

export default async function NewDsarRequestPage() {
  const session = await requireSession();
  if (!session) redirect("/login");

  return (
    <AppShell>
      <div style={{ padding: "24px 28px", maxWidth: 520 }}>
        <h1 style={{ marginTop: 0 }}>Log a DSAR request</h1>
        <p style={{ color: "var(--pq-ink-muted)", fontSize: 14, marginBottom: 20 }}>
          For requests that come in by phone, mail, or another channel besides the public intake
          form. The SLA due date is computed automatically from your organization&apos;s current
          in-scope regulations (shortest applicable statutory response window).
        </p>
        <Card>
          <form action={createInternalDsarRequest} style={{ display: "grid", gap: 14 }}>
            <label style={{ display: "block" }}>
              Requester name
              <input required name="requesterName" style={{ display: "block", width: "100%", marginTop: 4 }} />
            </label>
            <label style={{ display: "block" }}>
              Requester email
              <input
                required
                type="email"
                name="requesterEmail"
                style={{ display: "block", width: "100%", marginTop: 4 }}
              />
            </label>
            <label style={{ display: "block" }}>
              Request type
              <select name="requestType" style={{ display: "block", width: "100%", marginTop: 4 }}>
                {DSAR_REQUEST_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {DSAR_REQUEST_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <Button type="submit" variant="primary">
                Log request
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
