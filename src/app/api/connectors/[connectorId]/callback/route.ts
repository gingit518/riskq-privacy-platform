import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { verifyOAuthState } from "@/lib/connectors/oauth-state";
import { isSalesforceConfigured, fetchSalesforceIdentityLabel } from "@/lib/connectors/salesforce";
import { upsertConnection } from "@/lib/connectors/connections";

const SALESFORCE_TOKEN_URL = "https://login.salesforce.com/services/oauth2/token";

function appBaseUrl(req: NextRequest): string {
  return process.env.APP_BASE_URL || req.nextUrl.origin;
}

function redirectToConnectors(req: NextRequest, message: string): NextResponse {
  const url = new URL("/connectors", appBaseUrl(req));
  url.searchParams.set("connectorMessage", message);
  return NextResponse.redirect(url);
}

// Real OAuth callback for Salesforce (2026-09-15) — paired with
// .../authorize/route.ts. M365/Google Drive stay on the STUB response below
// per Ariel's "Let's just do Salesforce" scoping (2026-09-15).
export async function GET(req: NextRequest, { params }: { params: { connectorId: string } }) {
  if (params.connectorId !== "salesforce") {
    return new NextResponse(
      `${params.connectorId} OAuth callback is not implemented yet — see src/app/api/connectors/[connectorId]/authorize/route.ts.`,
      { status: 501, headers: { "content-type": "text/plain" } }
    );
  }

  const session = await requireSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  if (!isSalesforceConfigured()) {
    return redirectToConnectors(req, "Salesforce is not configured for this deployment.");
  }

  const error = req.nextUrl.searchParams.get("error");
  if (error) {
    const description = req.nextUrl.searchParams.get("error_description") || error;
    return redirectToConnectors(req, `Salesforce declined the connection request: ${description}`);
  }

  const code = req.nextUrl.searchParams.get("code");
  const stateParam = req.nextUrl.searchParams.get("state");
  if (!code || !stateParam) {
    return redirectToConnectors(req, "Salesforce callback was missing an authorization code.");
  }

  const state = await verifyOAuthState(stateParam);
  // Reject on any state mismatch — expired, tampered, or (defense in depth,
  // shouldn't normally happen since the session cookie already scopes this
  // request) belonging to a different org/user than the one currently
  // signed in. Never proceed with defaults here.
  if (!state || state.connectorId !== "salesforce" || state.orgId !== session.orgId || state.userId !== session.userId) {
    return redirectToConnectors(req, "Salesforce connection request expired or was invalid — please try connecting again.");
  }

  const clientId = process.env.SALESFORCE_CLIENT_ID!;
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET!;
  const redirectUri = `${appBaseUrl(req)}/api/connectors/salesforce/callback`;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });

  let tokenJson: { access_token?: string; refresh_token?: string; instance_url?: string };
  try {
    const tokenRes = await fetch(SALESFORCE_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!tokenRes.ok) {
      const detail = await tokenRes.text().catch(() => "");
      return redirectToConnectors(req, `Salesforce token exchange failed (HTTP ${tokenRes.status}): ${detail.slice(0, 200)}`);
    }
    tokenJson = await tokenRes.json();
  } catch (err) {
    return redirectToConnectors(req, `Salesforce token exchange failed: ${err instanceof Error ? err.message : "unknown error"}`);
  }

  if (!tokenJson.access_token || !tokenJson.refresh_token || !tokenJson.instance_url) {
    return redirectToConnectors(req, "Salesforce token response was missing required fields.");
  }

  // Best-effort friendly label — a failure here must never block a
  // successful connection (see fetchSalesforceIdentityLabel doc comment).
  let accountLabel = "Salesforce (connected)";
  try {
    const label = await fetchSalesforceIdentityLabel(tokenJson.access_token, tokenJson.instance_url);
    if (label) accountLabel = label;
  } catch {
    // ignore — fall back to the generic label above
  }

  await upsertConnection({
    orgId: session.orgId,
    connectorId: "salesforce",
    accountLabel,
    refreshToken: tokenJson.refresh_token,
    connectedBy: session.userId,
  });

  return redirectToConnectors(req, "Salesforce connected successfully.");
}
