// Google Drive connector — STUB. Not usable against real data yet.
//
// Same class of architectural wrinkle as M365, flagged rather than glossed
// over: a standard per-user OAuth consent only grants access to files that
// ONE consenting user owns or can already see — not the customer's whole
// Google Workspace. A DSAR search realistically needs either:
//   (a) Google Workspace domain-wide delegation — a service account,
//       authorized once by the customer's Workspace super-admin (Admin
//       console → Security → API controls → Domain-wide delegation), which
//       can then impersonate any user in the domain for Drive API calls; or
//   (b) accept the V1 limitation that only files the connecting user
//       personally owns/can access are searchable — materially incomplete
//       DSAR coverage, but a much simpler and less scary consent ask.
// Also flagging the V1 search-scope call itself (Ariel's, 2026-09-12):
// FILE METADATA only (name, owner, sharing) via `drive.files.list` with a
// query on name/description — not the file CONTENTS. Searching whether a
// person's email appears inside the body of a Doc/Sheet/PDF needs Drive's
// full-text search plus, for non-Google-native files, downloading and
// parsing them — a real step up in scope, correctly deferred.
//
// Setup, once (a) vs. (b) is decided:
// 1. Google Cloud Console → APIs & Services → Credentials → Create OAuth
//    client ID (Web application). Redirect URI: `${APP_BASE_URL}/api/
//    connectors/google-drive/callback`. Enable the Google Drive API for
//    the project.
// 2. GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET env vars (see .env.example).
// 3. search(): `drive.files.list` with `q: name contains '<email-local-
//    part>' or '<email>' in owners` (metadata-level match only, per the
//    scope call above).
// 4. exportRecords(): `drive.files.export`/`get` per file id.
//    deleteRecords(): `drive.files.delete` per file id.

import type { DsarConnector, MatchedRecord, ExportResult, DeleteResult } from "./types";

export function isGoogleDriveConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

const NOT_CONFIGURED =
  "Google Drive connector has no OAuth client registered for this deployment yet, and the domain-wide-delegation-vs-single-user approach hasn't been decided — see src/lib/connectors/google-drive.ts.";
const NOT_IMPLEMENTED = "Google OAuth client exists, but the Drive API calls are not wired up yet.";

export const googleDriveConnector: DsarConnector = {
  id: "google_drive",
  label: "Google Drive",
  async search(_orgId: string, _email: string): Promise<MatchedRecord[]> {
    if (!isGoogleDriveConfigured()) throw new Error(NOT_CONFIGURED);
    throw new Error(NOT_IMPLEMENTED);
  },
  async exportRecords(_orgId: string, _records: MatchedRecord[]): Promise<ExportResult[]> {
    if (!isGoogleDriveConfigured()) throw new Error(NOT_CONFIGURED);
    throw new Error(NOT_IMPLEMENTED);
  },
  async deleteRecords(_orgId: string, _records: MatchedRecord[]): Promise<DeleteResult[]> {
    if (!isGoogleDriveConfigured()) throw new Error(NOT_CONFIGURED);
    throw new Error(NOT_IMPLEMENTED);
  },
};
