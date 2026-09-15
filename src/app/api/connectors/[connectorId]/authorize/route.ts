import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { listConnectorInfo } from "@/lib/connectors/registry";
import { isSalesforceConfigured } from "@/lib/connectors/salesforce";
import { signOAuthState } from "@/lib/connectors/oauth-state";

const SALESFORCE_AUTHORIZE_URL = "https://login.salesforce.com/services/oauth2/authorize";

function appBaseUrl(req: NextRequest): string {
  return process.env.APP_BASE_URL || req.nextUrl.origin;
}

// Real OAuth authorization-code redirect for Salesforce (2026-09-15) — see
// src/lib/connectors/salesforce.ts for the token-exchange/API side and
// .../callback/route.ts for the other half of this flow. M365/Google Drive
// are deliberately left on the STUB behavior below (Ariel's call
// 2026-09-15: "Let's just do Salesforce" — Azure app/env vars exist and are
// ready, but the code isn't built until asked for).
export async function GET(req: NextRequest, { params }: { params: { connectorId: string } }) {
  const session = await requireSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  if (params.connectorId === "salesforce" && isSalesforceConfigured()) {
    const clientId = process.env.SALESFORCE_CLIENT_ID!;
    const redirectUri = `${appBaseUrl(req)}/api/connectors/salesforce/callback`;
    const state = await signOAuthState({ orgId: session.orgId, userId: session.userId, connectorId: "salesforce" });

    const url = new URL(SALESFORCE_AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "api refresh_token offline_access");
    url.searchParams.set("state", state);

    return NextResponse.redirect(url);
  }

  // STUB — unchanged for m365/google_drive (and for salesforce if somehow
  // reached while not configured, though the /connectors page hides the
  // Connect link in that case).
  const info = listConnectorInfo().find((c) => c.id === params.connectorId);
  const message = info?.configured
    ? `${info.label} is configured but the OAuth redirect itself isn't wired up yet.`
    : `${params.connectorId} has no OAuth app registered for this deployment yet — see src/lib/connectors/${params.connectorId === "google_drive" ? "google-drive" : params.connectorId}.ts for the exact setup steps.`;

  return new NextResponse(message, { status: 501, headers: { "content-type": "text/plain" } });
}
