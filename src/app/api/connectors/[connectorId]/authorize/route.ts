import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { listConnectorInfo } from "@/lib/connectors/registry";

// STUB — no real OAuth authorization-code redirect for any provider yet.
// Once a Connected App / Azure app / Google OAuth client exists (see
// src/lib/connectors/{salesforce,m365,google-drive}.ts for the exact setup
// steps each needs), this route redirects to that provider's own
// authorization URL with the right client_id/scope/state/redirect_uri.
// Until then it just explains why nothing happened, rather than 404ing or
// silently no-oping — same "fail with a clear message, not a mystery"
// philosophy as getDb()/getSecret() elsewhere in this codebase.
export async function GET(req: NextRequest, { params }: { params: { connectorId: string } }) {
  const session = await requireSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  const info = listConnectorInfo().find((c) => c.id === params.connectorId);
  const message = info?.configured
    ? `${info.label} is configured but the OAuth redirect itself isn't wired up yet.`
    : `${params.connectorId} has no OAuth app registered for this deployment yet — see src/lib/connectors/${params.connectorId === "google_drive" ? "google-drive" : params.connectorId}.ts for the exact setup steps.`;

  return new NextResponse(message, { status: 501, headers: { "content-type": "text/plain" } });
}
