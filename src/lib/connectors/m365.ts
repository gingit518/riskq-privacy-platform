// Microsoft 365 connector — STUB. Not usable against real data yet.
//
// A real architectural wrinkle, flagged here rather than glossed over: a
// standard per-user OAuth consent (the same simple pattern Salesforce/Google
// Drive use) only grants access to the CONSENTING user's own mailbox. A
// DSAR search needs to check whether the requester's data appears anywhere
// in the ORG's Outlook — every employee's mailbox, not just whoever clicked
// "Connect." That needs one of:
//   (a) an Azure/Entra app registration with ADMIN-CONSENTED application
//       permissions (Mail.Read, application-level, not delegated) — a
//       customer's Microsoft 365 admin grants this once for the whole
//       tenant, a materially different (and more sensitive) consent flow
//       than a single user clicking "allow"; or
//   (b) the Microsoft Purview eDiscovery / Content Search API, built for
//       exactly this kind of cross-mailbox search, but a separate API
//       surface with its own licensing tier (not included in every M365
//       plan) and its own permission model.
// This needs a decision before real work starts here, not just OAuth
// plumbing — flagging as open rather than picking (a) silently, since (a)
// is the simpler build but asks customers for a materially bigger, scarier
// admin-consent grant than Salesforce/Drive do.
//
// Setup, once a path is chosen:
// 1. Azure Portal → Microsoft Entra ID → App registrations → New
//    registration. Redirect URI: `${APP_BASE_URL}/api/connectors/m365/
//    callback`.
// 2. AZURE_CLIENT_ID / AZURE_CLIENT_SECRET / AZURE_TENANT_ID (or
//    "common" for multi-tenant) env vars (see .env.example).
// 3. search(): Microsoft Graph `/users/{id}/messages?$search="{email}"`
//    per mailbox (path a) or a Content Search job (path b) — V1 search
//    scope is Outlook mail only (Ariel's call 2026-09-12; SharePoint/Teams
//    deferred).
// 4. exportRecords()/deleteRecords(): Graph GET/DELETE per message id.

import type { DsarConnector, MatchedRecord, ExportResult, DeleteResult } from "./types";

export function isM365Configured(): boolean {
  return Boolean(process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET);
}

const NOT_CONFIGURED =
  "M365 connector has no Azure/Entra app registered for this deployment yet, and the admin-consent-vs-Purview approach hasn't been decided — see src/lib/connectors/m365.ts.";
const NOT_IMPLEMENTED = "M365 app registration exists, but the Graph API calls are not wired up yet.";

export const m365Connector: DsarConnector = {
  id: "m365",
  label: "M365",
  async search(_orgId: string, _email: string): Promise<MatchedRecord[]> {
    if (!isM365Configured()) throw new Error(NOT_CONFIGURED);
    throw new Error(NOT_IMPLEMENTED);
  },
  async exportRecords(_orgId: string, _records: MatchedRecord[]): Promise<ExportResult[]> {
    if (!isM365Configured()) throw new Error(NOT_CONFIGURED);
    throw new Error(NOT_IMPLEMENTED);
  },
  async deleteRecords(_orgId: string, _records: MatchedRecord[]): Promise<DeleteResult[]> {
    if (!isM365Configured()) throw new Error(NOT_CONFIGURED);
    throw new Error(NOT_IMPLEMENTED);
  },
};
