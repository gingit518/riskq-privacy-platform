import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orgs, users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { createSessionCookie } from "@/lib/auth/session";

const SignupSchema = z.object({
  orgName: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "org"
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { orgName, email, password } = parsed.data;
  const db = getDb();

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  // Not race-safe against concurrent identical org names — acceptable for
  // Phase 1 (low-volume signup); add a retry-with-suffix if that becomes real.
  const baseSlug = slugify(orgName);
  let slug = baseSlug;
  let attempt = 1;
  while ((await db.select().from(orgs).where(eq(orgs.slug, slug)).limit(1)).length > 0) {
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }

  const [org] = await db.insert(orgs).values({ name: orgName, slug }).returning();
  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({ orgId: org.id, email, passwordHash, role: "admin" })
    .returning();

  await createSessionCookie({ userId: user.id, orgId: org.id, role: "admin", email });

  return NextResponse.json({ ok: true, orgSlug: org.slug });
}
