import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { legalHolds } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import AppShell from "@/components/AppShell";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import { addLegalHoldAction, releaseLegalHoldAction } from "./actions";

export default async function LegalHoldsSettingsPage() {
  const session = await requireSession();
  if (!session) redirect("/login");

  const db = getDb();
  const holds = await db
    .select()
    .from(legalHolds)
    .where(eq(legalHolds.orgId, session.orgId))
    .orderBy(desc(legalHolds.createdAt));

  return (
    <AppShell>
      <div style={{ padding: "24px 28px", maxWidth: 760 }}>
        <h1 style={{ marginTop: 0 }}>Legal Holds</h1>
        <p style={{ color: "var(--pq-ink-muted)", fontSize: 14, marginBottom: 22 }}>
          Names/emails under an active hold or litigation matter. Every DSAR request detail page
          checks the requester&apos;s email against this list <strong>live</strong> (not just at
          intake), since a hold can be placed after a request is already open. This is a flag for
          a human reviewer, not a block — whether the hold actually justifies withholding data is
          still a legal judgment call.
        </p>

        <Card style={{ marginBottom: 22, padding: holds.length > 0 ? 0 : "18px 20px" }}>
          {holds.length === 0 ? (
            <p style={{ margin: 0, color: "var(--pq-ink-muted)" }}>No legal holds on file.</p>
          ) : (
            <ul style={{ paddingLeft: 0, listStyle: "none", margin: 0 }}>
              {holds.map((h) => (
                <li
                  key={h.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 18px",
                    borderBottom: "1px solid var(--pq-line)",
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 13.5 }}>{h.subjectName || h.subjectEmail}</span>{" "}
                    {!h.active && <Badge variant="neutral">Released</Badge>}
                    <div style={{ fontSize: 12.5, color: "var(--pq-ink-muted)", marginTop: 2 }}>{h.subjectEmail}</div>
                    {h.matter && <div style={{ fontSize: 11.5, color: "var(--pq-ink-muted)" }}>{h.matter}</div>}
                  </div>
                  {h.active && (
                    <form action={releaseLegalHoldAction}>
                      <input type="hidden" name="id" value={h.id} />
                      <Button type="submit" variant="secondary">
                        Release
                      </Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Add a hold">
          <form action={addLegalHoldAction} style={{ display: "grid", gap: 12, maxWidth: 420 }}>
            <label>
              Subject name
              <input name="subjectName" style={{ display: "block", width: "100%", marginTop: 4 }} />
            </label>
            <label>
              Subject email
              <input name="subjectEmail" type="email" required style={{ display: "block", width: "100%", marginTop: 4 }} />
            </label>
            <label>
              Matter
              <input name="matter" style={{ display: "block", width: "100%", marginTop: 4 }} />
            </label>
            <div>
              <Button type="submit" variant="primary">
                Add hold
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
