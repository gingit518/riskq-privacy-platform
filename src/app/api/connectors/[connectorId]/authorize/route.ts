import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { listConnectorInfo } from "@/lib/connectors/registry";
import { isSalesforceConfigured } from "@/lib/connectors/salesforce";
import { signOAuthState } from "@/lib/connectors/oauth-state";
import { generateCodeVerifier, codeChallengeFromVerifier, PKCE_COOKIE_NAME } from "@/lib/connectors/pkce";

const SALESFORCE_AUTHORIZE_URL = "https://login.salesforce.com/services/oauth2/authorize";
const PKCE_COOKIE_MAX_AGE_SECONDS = 60 * 10; // matches the OAuth state JWT's own expiry

// Strips a trailing slash so a redirect_uri built from this never produces
// a double slash (e.g. APP_BASE_URL="https://x.vercel.app/" + "/api/..." ->
// ".../.../..." ) — this exact bug caused a live redirect_uri_mismatch
// against Salesforce on 2026-09-15 when the env var was set with a
// trailing slash. Defensive here even though the env var has since been
// corrected, since nothing stops it drifting back.
function appBaseUrl(req: NextRequest): string {
  const base = process.env.APP_BASE_URL || req.nextUrl.origin;
  return base.replace(/\/+$/, "");
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

    // PKCE — RiskQ's Salesforce app (an External Client App) requires a
    // code_challenge or the authorize request is rejected outright (see
    // pkce.ts header comment). The verifier itself is never put in the URL
    // or the state JWT — it's set as an httpOnly cookie below and read back
    // in the callback route, so it's never exposed via browser history,
    // referrer headers, or logs the way a query param would be.
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = codeChallengeFromVerifier(codeVerifier);

    const url = new URL(SALESFORCE_AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "api refresh_token offline_access");
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");

    const response = NextResponse.redirect(url);
    response.cookies.set(PKCE_COOKIE_NAME, codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/connectors/salesforce/callback",
      maxAge: PKCE_COOKIE_MAX_AGE_SECONDS,
    });
    return response;
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
