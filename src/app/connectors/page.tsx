import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import AppShell from "@/components/AppShell";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import { listConnectorInfo } from "@/lib/connectors/registry";
import { listConnections } from "@/lib/connectors/connections";
import { connectMockAction, disconnectConnectorAction } from "./actions";

/** Connectors, reskinned Batch 8 (PRD §5.12) alongside Compliance,
 * Regulations/scope, and Profile — direct token application, no mockup.
 * Data queries/actions unchanged. */
export default async function ConnectorsPage({
  searchParams,
}: {
  searchParams: { connectorMessage?: string };
}) {
  const session = await requireSession();
  if (!session) redirect("/login");

  const info = listConnectorInfo();
  const connections = await listConnections(session.orgId);
  const mockMode = info.length > 0 && info[0].mock;

  return (
    <AppShell>
      <div style={{ padding: "24px 28px", maxWidth: 700 }}>
        <h1 style={{ marginTop: 0 }}>Connectors</h1>
        {searchParams.connectorMessage && (
          <Card style={{ marginBottom: 16 }}>{searchParams.connectorMessage}</Card>
        )}
        <p style={{ color: "var(--pq-ink-muted)", fontSize: 14 }}>
          Connect systems here so a DSAR request can search them for a
          requester&apos;s data (§5.10). Every match found still requires a
          human to review and approve before anything is exported or deleted
          — see the &quot;Fulfillment&quot; section on an individual DSAR
          request. {mockMode && (
            <strong>
              {" "}
              This deployment is running in mock mode (CONNECTOR_MOCK_MODE=true)
              — connecting here writes a fake connection so the review
              pipeline is testable; no real Salesforce/M365/Google Drive
              account is touched.
            </strong>
          )}
        </p>

        <Card style={{ padding: 0, overflow: "hidden" }}>
          {info.map((c, i) => {
            const conn = connections.find((row) => row.connectorId === c.id && row.active);
            return (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 18px",
                  borderTop: i === 0 ? "none" : "1px solid var(--pq-line)",
                }}
              >
                <div>
                  <div style={{ fontSize: 13.5, marginBottom: 4 }}>
                    <strong>{c.label}</strong>
                  </div>
                  <Badge variant={conn ? "success" : c.configured ? "neutral" : "danger"}>
                    {conn
                      ? `Connected — ${conn.accountLabel || "no label"}`
                      : c.configured
                        ? "Not connected"
                        : "Not configured for this deployment yet — see README \"Phase 7\""}
                  </Badge>
                </div>
                {conn ? (
                  <form action={disconnectConnectorAction}>
                    <input type="hidden" name="connectorId" value={c.id} />
                    <Button type="submit" variant="secondary">
                      Disconnect
                    </Button>
                  </form>
                ) : mockMode ? (
                  <form action={connectMockAction}>
                    <input type="hidden" name="connectorId" value={c.id} />
                    <Button type="submit" variant="primary">
                      Connect (mock)
                    </Button>
                  </form>
                ) : (
                  <a href={`/api/connectors/${c.id}/authorize`}>
                    <Button type="button" variant="primary" disabled={!c.configured}>
                      Connect
                    </Button>
                  </a>
                )}
              </div>
            );
          })}
        </Card>
      </div>
    </AppShell>
  );
}
