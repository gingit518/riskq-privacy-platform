// Shared "who can this be assigned to" lookup — added 2026-09-16 for the
// owner-picker on Obligations/DSAR and the Management Summary View's "My
// Pending" feature. Users have no `name` column today (schema.ts — auth is
// email/password only), so email is the only display label available.

import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

export interface OrgUser {
  id: string;
  email: string;
}

export async function listOrgUsers(orgId: string): Promise<OrgUser[]> {
  const db = getDb();
  const rows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.orgId, orgId))
    .orderBy(asc(users.email));
  return rows;
}
