// Minimal auth for the Phase 1 scaffold: email + password, JWT session cookie.
//
// This is deliberately NOT Auth.js/Clerk — PRD §6 flags that choice as still
// open (which provider, and OAuth vs. email vs. credentials aren't decided).
// Rather than guess and pull in a library whose config choices would need to
// be redone anyway, this implements just enough real auth — bcrypt-hashed
// passwords, a signed+httpOnly session cookie carrying { userId, orgId, role }
// — to unblock building multi-tenant routes now. Swapping to Auth.js/Clerk
// later means replacing this file, not the schema (users/orgs tables are
// provider-agnostic) or the pages that call requireSession().

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload {
  userId: string;
  orgId: string;
  role: "admin" | "contributor" | "viewer";
  email: string;
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set — see .env.example.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecret());

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export function clearSessionCookie(): void {
  cookies().delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/** Throws-free guard for use in Server Components / route handlers. Callers
 * decide what to do with `null` (usually redirect to /login). */
export async function requireSession(): Promise<SessionPayload | null> {
  return getSession();
}
