// A fully-fake connector so the search → approval-gate → execute → log
// pipeline is buildable, clickable, and reviewable end to end before any
// real Salesforce/M365/Google Drive OAuth credential exists (see
// schema.ts's Phase 7 comment for why nothing real is wired up yet).
//
// Gated behind CONNECTOR_MOCK_MODE=true so it can never be mistaken for a
// real connector in a real deployment — registry.ts only offers this in
// place of the three real (stubbed) connectors when that flag is set.
// "Records" are generated deterministically from the search email itself
// (no database, no state) so a search always returns the same fake matches
// for the same email — good enough to exercise the review UI honestly
// without needing a fake backing store.

import type { DsarConnector, MatchedRecord, ExportResult, DeleteResult } from "./types";

export function isMockModeEnabled(): boolean {
  return process.env.CONNECTOR_MOCK_MODE === "true";
}

function fakeMatchesFor(connectorId: string, email: string): MatchedRecord[] {
  const local = email.split("@")[0] || "person";
  if (connectorId === "salesforce") {
    return [
      {
        externalObjectType: "Contact",
        externalRecordId: "003MOCK0000001",
        snapshot: { Name: `${local} (mock Contact)`, Email: email },
      },
      {
        externalObjectType: "Lead",
        externalRecordId: "00QMOCK0000001",
        snapshot: { Name: `${local} (mock Lead)`, Email: email, Status: "Open" },
      },
    ];
  }
  if (connectorId === "m365") {
    return [
      {
        externalObjectType: "Message",
        externalRecordId: "AAMkMOCK0000001",
        snapshot: { Subject: `(mock) Re: your request`, From: email },
      },
    ];
  }
  // google_drive
  return [
    {
      externalObjectType: "DriveFile",
      externalRecordId: "1MOCKfileID0000001",
      snapshot: { Name: `${local}-notes.docx (mock)`, Owner: "mock-owner@example.com" },
    },
  ];
}

function makeMockConnector(id: "salesforce" | "m365" | "google_drive", label: string): DsarConnector {
  return {
    id,
    label: `${label} (mock)`,
    async search(_orgId: string, email: string): Promise<MatchedRecord[]> {
      return fakeMatchesFor(id, email);
    },
    async exportRecords(_orgId: string, records: MatchedRecord[]): Promise<ExportResult[]> {
      return records.map((r) => ({
        externalRecordId: r.externalRecordId,
        ok: true,
        data: JSON.stringify(r.snapshot, null, 2),
      }));
    },
    async deleteRecords(_orgId: string, records: MatchedRecord[]): Promise<DeleteResult[]> {
      return records.map((r) => ({ externalRecordId: r.externalRecordId, ok: true }));
    },
  };
}

export const mockSalesforceConnector = makeMockConnector("salesforce", "Salesforce");
export const mockM365Connector = makeMockConnector("m365", "M365");
export const mockGoogleDriveConnector = makeMockConnector("google_drive", "Google Drive");
