// connector_connections CRUD (schema.ts). The "connect" side (real OAuth
// authorize/callback) doesn't exist yet for any real provider — see
// src/app/api/connectors/[connectorId]/{authorize,callback}/route.ts, which
// currently just explain that plainly rather than pretending to work.
// connectMock() below exists solely so the mock-mode pipeline (mock.ts) is
// clickable end to end without real OAuth — it's the one path that writes a
// connector_connections row today.

import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { connectorConnections } from "@/lib/db/schema";
import type { ConnectorId } from "./types";
import { encryptSecret } from "./crypto";

export async function listConnections(orgId: string) {
  const db = getDb();
  return db.select().from(connectorConnections).where(eq(connectorConnections.orgId, orgId));
}

export async function getActiveConnection(orgId: string, connectorId: ConnectorId) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(connectorConnections)
    .where(
      and(
        eq(connectorConnections.orgId, orgId),
        eq(connectorConnections.connectorId, connectorId),
        eq(connectorConnections.active, true)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function disconnectConnector(orgId: string, connectorId: ConnectorId): Promise<void> {
  const db = getDb();
  await db
    .update(connectorConnections)
    .set({ active: false })
    .where(and(eq(connectorConnections.orgId, orgId), eq(connectorConnections.connectorId, connectorId)));
}

/** Mock-mode only — see mock.ts. Writes a real row with a fake "refresh
 * token" (still passed through real encryption, since the column doesn't
 * know it's fake) so the connect/disconnect UI and the fulfillment flow
 * both behave exactly as they will once a real OAuth callback exists. */
export async function connectMock(params: {
  orgId: string;
  connectorId: ConnectorId;
  connectedBy: string;
}): Promise<void> {
  const db = getDb();
  const existing = await getActiveConnection(params.orgId, params.connectorId);
  if (existing) return;
  await db.insert(connectorConnections).values({
    orgId: params.orgId,
    connectorId: params.connectorId,
    accountLabel: "Mock connection (no real account)",
    encryptedRefreshToken: encryptSecret("mock-refresh-token"),
    connectedBy: params.connectedBy,
  });
}
