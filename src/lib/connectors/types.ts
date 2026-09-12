// Phase 7 (PRD §5.10) — connector interface. Deliberately three methods,
// not four: search/export/delete only. "correct" (data correction, one of
// the PRD's named DSAR request types alongside access/deletion/portability)
// is dropped from V1 because it needs a per-org field-mapping config (which
// Salesforce field is "mailing address," which M365/Drive property to
// overwrite) that's a materially separate piece of scope — flagged in
// README as a known gap, not silently dropped. Correction stays a manual
// process, same as it is today with no connectors at all.
//
// Every method takes/returns plain data, never a raw provider SDK object —
// keeps dsarConnectorMatches.snapshot (schema.ts) a deliberately small,
// reviewable payload rather than an entire external record.

// Plain union, not derived from the schema.ts pgEnum — same convention as
// DsarRequestType/DsarStatus in lib/dsar/types.ts (this codebase hand-writes
// these rather than inferring from Drizzle's enum type).
export type ConnectorId = "salesforce" | "m365" | "google_drive";

export interface MatchedRecord {
  externalObjectType: string; // e.g. "Contact", "Message", "DriveFile"
  externalRecordId: string;
  // Small, human-reviewable snapshot — enough for a staff member to
  // recognize the record on the approval screen. Never the full record.
  snapshot: Record<string, string>;
}

export interface ExportResult {
  externalRecordId: string;
  ok: boolean;
  // Plain-text/JSON export payload for this one record, or an error detail
  // if ok is false. Caller (fulfillment.ts) is responsible for attaching
  // this to the DSAR request as evidence — connectors never touch
  // evidence_files or Blob storage directly.
  data?: string;
  errorDetail?: string;
}

export interface DeleteResult {
  externalRecordId: string;
  ok: boolean;
  errorDetail?: string;
}

export interface DsarConnector {
  id: ConnectorId;
  label: string;
  /** Narrow, exact-match search — see schema.ts Phase 7 comment for why. */
  search(orgId: string, email: string): Promise<MatchedRecord[]>;
  exportRecords(orgId: string, records: MatchedRecord[]): Promise<ExportResult[]>;
  deleteRecords(orgId: string, records: MatchedRecord[]): Promise<DeleteResult[]>;
}
