import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";

// Redirects rather than returning JSON — the Phase 2 nav (src/components/Nav)
// posts here as a plain HTML form (no client JS), so a JSON response would
// navigate the browser to a raw {"ok":true} page instead of back to /login.
export async function POST(req: NextRequest) {
  clearSessionCookie();
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
