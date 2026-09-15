// Signed, short-lived `state` param for the OAuth authorization-code flow
// (authorize -> provider consent screen -> callback). Not a DB-backed
// session store — a signed JWT is enough here: it just needs to prove the
// callback request is (a) genuinely continuing an authorize request THIS
// app issued, for (b) the same session/org/connector, within (c) a short
// window, without needing a table to hold single-use nonces. Reuses
// AUTH_SECRET (see lib/auth/session.ts) rather than adding a second secret
// env var — same trust boundary (server-side, never sent to a client).

import { SignJWT, jwtVerify } from "jose";
import type { ConnectorId } from "./types";

const STATE_DURATION_SECONDS = 60 * 10; // 10 minutes — plenty for a user to click through a consent screen

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set — see .env.example.");
  return new TextEncoder().encode(secret);
}

export interface OAuthStatePayload {
  orgId: string;
  userId: string;
  connectorId: ConnectorId;
}

export async function signOAuthState(payload: OAuthStatePayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${STATE_DURATION_SECONDS}s`)
    .sign(getSecret());
}

/** Returns null on any failure (expired, tampered, malformed) — callers
 * treat that as "reject the callback," never as a reason to proceed with
 * defaults. */
export async function verifyOAuthState(token: string): Promise<OAuthStatePayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const p = payload as unknown as OAuthStatePayload;
    if (!p.orgId || !p.userId || !p.connectorId) return null;
    return p;
  } catch {
    return null;
  }
}
