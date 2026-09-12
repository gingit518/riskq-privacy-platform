// International Transfers registry (PRD §5.7, Phase 4). Same lib-layer
// pattern as ropa.ts/dpia.ts — thin, typed wrappers around the schema so
// server actions stay dumb (parse formData, call this, revalidate).

import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { internationalTransfers } from "@/lib/db/schema";
import type { TransferMechanism, TiaStatus } from "./types";

export interface CreateTransferParams {
  orgId: string;
  createdBy: string;
  activityId: string | null;
  fromJurisdiction: string;
  toJurisdiction: string;
  mechanism: TransferMechanism;
  tiaStatus: TiaStatus;
  notes: string;
}

export async function createTransfer(params: CreateTransferParams): Promise<string> {
  const db = getDb();
  const [row] = await db
    .insert(internationalTransfers)
    .values({
      orgId: params.orgId,
      createdBy: params.createdBy,
      activityId: params.activityId,
      fromJurisdiction: params.fromJurisdiction,
      toJurisdiction: params.toJurisdiction,
      mechanism: params.mechanism,
      tiaStatus: params.tiaStatus,
      notes: params.notes,
    })
    .returning({ id: internationalTransfers.id });
  return row.id;
}

export async function listTransfers(orgId: string) {
  const db = getDb();
  return db
    .select()
    .from(internationalTransfers)
    .where(eq(internationalTransfers.orgId, orgId))
    .orderBy(internationalTransfers.fromJurisdiction);
}

export async function listTransfersForActivity(orgId: string, activityId: string) {
  const db = getDb();
  return db
    .select()
    .from(internationalTransfers)
    .where(
      and(eq(internationalTransfers.orgId, orgId), eq(internationalTransfers.activityId, activityId))
    );
}

export async function updateTransfer(params: {
  orgId: string;
  id: string;
  mechanism: TransferMechanism;
  tiaStatus: TiaStatus;
  notes: string;
}): Promise<void> {
  const db = getDb();
  await db
    .update(internationalTransfers)
    .set({
      mechanism: params.mechanism,
      tiaStatus: params.tiaStatus,
      notes: params.notes,
      updatedAt: new Date(),
    })
    .where(and(eq(internationalTransfers.id, params.id), eq(internationalTransfers.orgId, params.orgId)));
}
