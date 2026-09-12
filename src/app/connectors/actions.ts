"use server";

// Connector connect/disconnect actions (Phase 7, PRD §5.10). connectMockAction
// only works when CONNECTOR_MOCK_MODE=true (connections.ts refuses
// otherwise via the registry not being mock) — until real OAuth exists for
// a provider, "Connect" for it links to /api/connectors/[id]/authorize,
// which explains that plainly rather than doing anything (see that route).

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { connectMock, disconnectConnector } from "@/lib/connectors/connections";
import { isMockModeEnabled } from "@/lib/connectors/mock";
import type { ConnectorId } from "@/lib/connectors/types";

export async function connectMockAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;
  if (!isMockModeEnabled()) return;
  const connectorId = String(formData.get("connectorId") || "") as ConnectorId;
  await connectMock({ orgId: session.orgId, connectorId, connectedBy: session.userId });
  revalidatePath("/connectors");
}

export async function disconnectConnectorAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;
  const connectorId = String(formData.get("connectorId") || "") as ConnectorId;
  await disconnectConnector(session.orgId, connectorId);
  revalidatePath("/connectors");
}
