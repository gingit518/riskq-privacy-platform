import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionCookie } from "@/lib/auth/session";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  const { email, password } = parsed.data;
  const db = getDb();

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  // Same error for "no such user" and "wrong password" — don't leak which one.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  await createSessionCookie({
    userId: user.id,
    orgId: user.orgId,
    role: user.role,
    email: user.email,
  });

  return NextResponse.json({ ok: true });
}
