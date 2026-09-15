import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { verifyOAuthState } from "@/lib/connectors/oauth-state";
import { isSalesforceConfigured, fetchSalesforceIdentityLabel } from "@/lib/connectors/salesforce";
import { upsertConnection } from "@/lib/connectors/connections";
import { PKCE_COOKIE_NAME } from "@/lib/connectors/pkce";

const SALESFORCE_TOKEN_URL = "https://login.salesforce.com/services/oauth2/token";

// Same trailing-slash defense as authorize/route.ts — see that file's
// comment. A double slash here would break the token exchange the same way
// it broke the authorize redirect on 2026-09-15.
function appBaseUrl(req: NextRequest): string {
  const base = process.env.APP_BASE_URL || req.nextUrl.origin;
  return base.replace(/\/+$/, "");
}

function redirectToConnectors(req: NextRequest, message: string): NextResponse {
  const url = new URL("/connectors", appBaseUrl(req));
  url.searchParams.set("connectorMessage", message);
  const response = NextResponse.redirect(url);
  // Single-use — clear the PKCE cookie on every exit from this route
  // (success or any error branch) so a stale verifier never lingers for a
  // retried connection attempt. Must repeat the same `path` used when the
  // cookie was set in authorize/route.ts — cookies are scoped by path, so a
  // delete/clear at a different path silently no-ops and leaves the
  // original cookie in the browser.
  response.cookies.set(PKCE_COOKIE_NAME, "", { path: "/api/connectors/salesforce/callback", maxAge: 0 });
  return response;
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

  // PKCE — the verifier set as an httpOnly cookie in authorize/route.ts,
  // never sent through the URL/state param (see pkce.ts). Salesforce's
  // token endpoint requires this alongside code_challenge on the authorize
  // request, or the exchange itself is rejected the same way the authorize
  // request was without code_challenge (confirmed live 2026-09-15).
  const codeVerifier = req.cookies.get(PKCE_COOKIE_NAME)?.value;
  if (!codeVerifier) {
    return redirectToConnectors(req, "Salesforce connection request expired (PKCE verifier missing) — please try connecting again.");
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
    code_verifier: codeVerifier,
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
