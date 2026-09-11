"use server";

// Cyber Controls (PRD §5.4, Phase 2). See src/lib/controls/data.ts and
// types.ts for the important caveat: the seeded library is NIST CSF 2.0's
// public taxonomy plus an indicative (not legally-reviewed) regulation-group
// tag, not a verified control-to-regulation compliance mapping.

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { controlsLibrary, orgControls } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import { uploadEvidence } from "@/lib/evidence";
import { CONTROLS } from "@/lib/controls/data";

/** Self-seeding, same pattern as regulation_sets in profile/actions.ts — no
 * separate seed step required. Safe to call on every page load. */
export async function ensureControlsSeeded(): Promise<void> {
  const db = getDb();
  await db
    .insert(controlsLibrary)
    .values(
      CONTROLS.map((c) => ({
        code: c.code,
        framework: c.framework,
        function: c.function,
        category: c.category,
        description: c.description,
        regulationGroupsTag: c.regulationGroupsTag,
      }))
    )
    .onConflictDoNothing();
}

export async function updateControlStatus(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;

  const controlId = String(formData.get("controlId") || "");
  if (!controlId) return;

  const status = String(formData.get("status") || "not_implemented") as
    | "not_implemented"
    | "partial"
    | "implemented";
  const evidenceNote = String(formData.get("evidenceNote") || "");
  const lastTestedRaw = String(formData.get("lastTestedAt") || "");

  const db = getDb();
  await db
    .insert(orgControls)
    .values({
      orgId: session.orgId,
      controlId,
      status,
      evidenceNote,
      lastTestedAt: lastTestedRaw ? new Date(lastTestedRaw) : null,
    })
    .onConflictDoUpdate({
      target: [orgControls.orgId, orgControls.controlId],
      set: {
        status,
        evidenceNote,
        lastTestedAt: lastTestedRaw ? new Date(lastTestedRaw) : null,
        updatedAt: new Date(),
      },
    });

  revalidatePath("/controls");
}

/** Uploads an evidence file for one control (PRD §5.4 "evidence upload").
 * `controlId` here is controls_library.id (see schema.ts comment on
 * evidenceFiles) — works even if this org has never saved a status for this
 * control yet. Same known gap as obligations: failures surface as Next's
 * generic error page, no inline message yet. */
export async function uploadControlEvidence(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) return;

  const controlId = String(formData.get("controlId") || "");
  const file = formData.get("file");
  if (!controlId || !(file instanceof File)) return;

  await uploadEvidence({
    orgId: session.orgId,
    uploadedBy: session.userId,
    controlId,
    file,
  });

  revalidatePath("/controls");
}
