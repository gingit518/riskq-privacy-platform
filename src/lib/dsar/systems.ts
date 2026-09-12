// Systems Register — Phase 3.1 (2026-09-12). An org-maintained list of
// systems that may hold personal data (their CRM, their database, their
// email tool, whatever). This does NOT locate anyone's data automatically —
// there's no generic way to query an arbitrary third-party stack. What it
// automates is the fan-out and tracking: when a DSAR opens, every active
// system gets its own assigned sub-task instead of one vague "go find it"
// checklist line.

import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { dsarSystems, dsarSystemTasks } from "@/lib/db/schema";

export async function listSystems(orgId: string) {
  const db = getDb();
  return db
    .select()
    .from(dsarSystems)
    .where(eq(dsarSystems.orgId, orgId))
    .orderBy(asc(dsarSystems.name));
}

export async function addSystem(params: {
  orgId: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  dataCategories: string;
}): Promise<void> {
  const db = getDb();
  await db.insert(dsarSystems).values(params);
}

export async function setSystemActive(
  orgId: string,
  id: string,
  active: boolean
): Promise<void> {
  const db = getDb();
  await db
    .update(dsarSystems)
    .set({ active })
    .where(and(eq(dsarSystems.id, id), eq(dsarSystems.orgId, orgId)));
}

/** Called once at request creation (see dsar/create.ts). Snapshots each
 * currently-active system's name/owner into its own task row — editing or
 * retiring a system afterward never rewrites an already-open request's task
 * list, same rule as the checklist snapshot. */
export async function fanOutSystemTasks(orgId: string, requestId: string): Promise<void> {
  const db = getDb();
  const systems = await db
    .select()
    .from(dsarSystems)
    .where(and(eq(dsarSystems.orgId, orgId), eq(dsarSystems.active, true)));

  if (systems.length === 0) return;

  await db.insert(dsarSystemTasks).values(
    systems.map((s) => ({
      requestId,
      orgId,
      systemName: s.name,
      ownerName: s.ownerName,
      ownerEmail: s.ownerEmail,
    }))
  );
}

export async function listSystemTasks(orgId: string, requestId: string) {
  const db = getDb();
  return db
    .select()
    .from(dsarSystemTasks)
    .where(and(eq(dsarSystemTasks.orgId, orgId), eq(dsarSystemTasks.requestId, requestId)))
    .orderBy(asc(dsarSystemTasks.systemName));
}
