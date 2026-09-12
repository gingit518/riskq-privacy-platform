import { NextRequest, NextResponse } from "next/server";

// STUB — paired with authorize/route.ts. Once a real provider redirects
// here with an authorization code, this exchanges it for a refresh token
// and calls connections.ts to store it (encrypted — see
// src/lib/connectors/crypto.ts) via upsertConnection (not yet written; add
// alongside the first real provider wiring, since its exact shape depends
// on what each provider's token response includes — e.g. Salesforce's
// instance_url, see salesforce.ts).
export async function GET(_req: NextRequest, { params }: { params: { connectorId: string } }) {
  return new NextResponse(
    `${params.connectorId} OAuth callback is not implemented yet — see src/app/api/connectors/[connectorId]/authorize/route.ts.`,
    { status: 501, headers: { "content-type": "text/plain" } }
  );
}
