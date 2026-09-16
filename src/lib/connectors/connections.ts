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

/** Real-OAuth callback path (currently: Salesforce — see
 * src/app/api/connectors/[connectorId]/callback/route.ts). Encrypts the
 * plaintext refresh token before it ever touches the DB. Upserts on the
 * (orgId, connectorId) unique index: a re-auth (token rotated, scopes
 * changed, user reconnects after revoking access on the provider side)
 * replaces the stored token and reactivates the row rather than creating a
 * second connector_connections row for the same org+connector, which would
 * violate that unique index anyway. */
/** Persists a rotated refresh token onto the existing active connection row,
 * without touching accountLabel/connectedBy. Salesforce can (and, per live
 * testing 2026-09-16, does) return a new refresh_token in the response to a
 * grant_type=refresh_token call — when it does, the old refresh token is
 * invalidated immediately. salesforce.ts's refreshAccessToken() calls this
 * whenever the token response includes one, so the next operation (search,
 * export, delete) uses the current token instead of a stale one Salesforce
 * has already rotated past. No-ops if there's no active row — that
 * shouldn't happen in practice since this only runs right after a
 * successful refresh against an existing connection, but a disconnect
 * racing a refresh isn't worth throwing over. */
export async function updateRefreshToken(
  orgId: string,
  connectorId: ConnectorId,
  refreshToken: string
): Promise<void> {
  const db = getDb();
  await db
    .update(connectorConnections)
    .set({ encryptedRefreshToken: encryptSecret(refreshToken) })
    .where(
      and(
        eq(connectorConnections.orgId, orgId),
        eq(connectorConnections.connectorId, connectorId),
        eq(connectorConnections.active, true)
      )
    );
}

export async function upsertConnection(params: {
  orgId: string;
  connectorId: ConnectorId;
  accountLabel: string;
  refreshToken: string;
  connectedBy: string;
}): Promise<void> {
  const db = getDb();
  const encrypted = encryptSecret(params.refreshToken);
  await db
    .insert(connectorConnections)
    .values({
      orgId: params.orgId,
      connectorId: params.connectorId,
      accountLabel: params.accountLabel,
      encryptedRefreshToken: encrypted,
      connectedBy: params.connectedBy,
      active: true,
    })
    .onConflictDoUpdate({
      target: [connectorConnections.orgId, connectorConnections.connectorId],
      set: {
        accountLabel: params.accountLabel,
        encryptedRefreshToken: encrypted,
        connectedBy: params.connectedBy,
        connectedAt: new Date(),
        active: true,
      },
    });
}
