// Legal hold cross-reference — Phase 3.1 (2026-09-12). See schema.ts
// legalHolds for why this is checked LIVE on every render rather than
// snapshotted at request creation: a hold can be placed after intake but
// before the response goes out.
//
// This is a lookup, not a decision — it surfaces a flag for a human to act
// on. It never blocks status changes or the send-response action.

import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { legalHolds } from "@/lib/db/schema";

export interface ActiveLegalHold {
  id: string;
  subjectName: string;
  matter: string;
}

export async function findActiveLegalHold(
  orgId: string,
  requesterEmail: string
): Promise<ActiveLegalHold | null> {
  const db = getDb();
  const [hit] = await db
    .select({ id: legalHolds.id, subjectName: legalHolds.subjectName, matter: legalHolds.matter })
    .from(legalHolds)
    .where(
      and(
        eq(legalHolds.orgId, orgId),
        eq(legalHolds.active, true),
        // Case-insensitive match — email casing isn't meaningful and
        // requesters/staff won't always enter it identically.
        sql`lower(${legalHolds.subjectEmail}) = lower(${requesterEmail})`
      )
    )
    .limit(1);
  return hit ?? null;
}
