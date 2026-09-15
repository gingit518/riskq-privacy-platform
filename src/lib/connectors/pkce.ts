// PKCE (RFC 7636) for the Salesforce OAuth authorization-code flow.
//
// Needed because RiskQ's Salesforce app is registered as an External Client
// App (Salesforce's Winter '24+ successor to the classic Connected App),
// which by default requires a code_challenge on the authorize request —
// omitting it fails with error=invalid_request, "missing required code
// challenge" (confirmed live 2026-09-15). This isn't optional hardening
// bolted on after the fact; Salesforce's endpoint rejects the request
// without it.
//
// code_verifier deliberately never travels in the state param or any URL —
// it's set as a short-lived httpOnly cookie on the authorize redirect and
// read back on the callback, so it never appears in browser history,
// referrer headers, or server access logs the way a query/state param
// would. That's the actual security property PKCE is for: even if an
// attacker intercepts the authorization code (e.g. via a referrer leak or a
// compromised redirect), they can't complete the token exchange without the
// verifier a browser cookie never exposed.

import { randomBytes, createHash } from "crypto";

export const PKCE_COOKIE_NAME = "sf_pkce_verifier";

function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 43-128 chars per RFC 7636 — 32 random bytes base64url-encoded lands at 43. */
export function generateCodeVerifier(): string {
  return base64url(randomBytes(32));
}

export function codeChallengeFromVerifier(verifier: string): string {
  return base64url(createHash("sha256").update(verifier).digest());
}
