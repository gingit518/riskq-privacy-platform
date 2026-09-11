// Default checklist items seeded per (org, request type) the first time
// that combination is touched — see dsar/actions.ts ensureChecklistTemplate.
// Per Ariel's explicit call (2026-09-11), checklists are configurable per
// org from day one, not a fixed global list like Cyber Controls' NIST seed —
// these defaults are just the starting point an org can edit, reorder
// (by re-adding), or delete items from.
//
// Generic, not regulation-specific — the ported regulation data doesn't
// carry per-right procedural steps, so these are common-sense compliance
// workflow steps for each request type. Worth a legal review pass alongside
// PRD §9 item 3/7, same as the rest of this app's compliance content.

import type { DsarRequestType } from "./types";

export const DEFAULT_CHECKLIST_ITEMS: Record<DsarRequestType, string[]> = {
  access: [
    "Verify requester identity",
    "Locate all systems/records containing the requester's data",
    "Compile the data into an exportable format",
    "Redact third-party personal data or trade secrets",
    "Review for legal holds or statutory exemptions",
    "Send the response to the requester",
    "Log completion",
  ],
  deletion: [
    "Verify requester identity",
    "Confirm no legal hold or retention obligation applies",
    "Identify all systems/records containing the requester's data",
    "Delete or anonymize the records",
    "Notify downstream processors/sub-processors if required",
    "Confirm deletion with the requester",
    "Log completion",
  ],
  correction: [
    "Verify requester identity",
    "Confirm the specific fields to correct and the correct values",
    "Locate all systems containing the inaccurate data",
    "Apply the correction",
    "Notify downstream processors if required",
    "Confirm the correction with the requester",
    "Log completion",
  ],
  portability: [
    "Verify requester identity",
    "Locate all systems/records containing the requester's data",
    "Export the data in a structured, machine-readable format",
    "Review for third-party data or trade secrets to exclude",
    "Deliver the export securely to the requester",
    "Log completion",
  ],
  opt_out: [
    "Verify requester identity (if required by the applicable law)",
    "Identify all vendors/partners the data is sold or shared with",
    "Instruct vendors/partners to stop the sale/sharing",
    "Update internal systems/flags to honor the opt-out",
    "Confirm the opt-out with the requester",
    "Log completion",
  ],
};
