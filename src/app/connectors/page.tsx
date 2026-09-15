import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import Nav from "@/components/Nav";
import { listConnectorInfo } from "@/lib/connectors/registry";
import { listConnections } from "@/lib/connectors/connections";
import { connectMockAction, disconnectConnectorAction } from "./actions";

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
    <>
      <Nav />
      <main style={{ maxWidth: 700, margin: "40px auto", fontFamily: "system-ui", padding: "0 16px" }}>
        <h1>Connectors</h1>
        {searchParams.connectorMessage && (
          <p
            style={{
              background: "#f5f5f5",
              border: "1px solid #ddd",
              borderRadius: 4,
              padding: "10px 12px",
              fontSize: 14,
            }}
          >
            {searchParams.connectorMessage}
          </p>
        )}
        <p style={{ color: "#666", fontSize: 14 }}>
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

        <ul style={{ paddingLeft: 0, listStyle: "none" }}>
          {info.map((c) => {
            const conn = connections.find((row) => row.connectorId === c.id && row.active);
            return (
              <li
                key={c.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 0",
                  borderBottom: "1px solid #eee",
                }}
              >
                <div>
                  <strong>{c.label}</strong>
                  <div style={{ fontSize: 13, color: "#666" }}>
                    {conn
                      ? `Connected — ${conn.accountLabel || "no label"}`
                      : c.configured
                        ? "Not connected"
                        : "Not configured for this deployment yet — see README \"Phase 7\""}
                  </div>
                </div>
                {conn ? (
                  <form action={disconnectConnectorAction}>
                    <input type="hidden" name="connectorId" value={c.id} />
                    <button type="submit">Disconnect</button>
                  </form>
                ) : mockMode ? (
                  <form action={connectMockAction}>
                    <input type="hidden" name="connectorId" value={c.id} />
                    <button type="submit">Connect (mock)</button>
                  </form>
                ) : (
                  <a href={`/api/connectors/${c.id}/authorize`}>
                    <button type="button" disabled={!c.configured}>
                      Connect
                    </button>
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}
