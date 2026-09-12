// Salesforce connector — STUB. Not usable against real data yet.
//
// What real wiring needs, in order:
// 1. A Salesforce Connected App, registered ONCE by RiskQ (any Salesforce
//    org works as the "home" — the connected app is then authorizable by
//    users from ANY Salesforce org via the standard OAuth consent screen;
//    you do not need one Connected App per customer). Setup → App Manager →
//    New Connected App. OAuth scopes needed: `api` and `refresh_token,
//    offline_access`. Callback URL: `${APP_BASE_URL}/api/connectors/
//    salesforce/callback`.
// 2. SALESFORCE_CLIENT_ID / SALESFORCE_CLIENT_SECRET env vars (see
//    .env.example) from that Connected App.
// 3. The OAuth authorization-code flow (src/app/api/connectors/salesforce/
//    authorize + callback routes) exchanging the code for a refresh token,
//    stored via connections.ts (encrypted, see connectors/crypto.ts).
//    Salesforce's token response also includes an org-specific
//    `instance_url` — every subsequent API call must hit that URL, not a
//    generic one. Not yet modeled: connector_connections.accountLabel can
//    hold it as plain text (it's not secret) but that's a follow-up wiring
//    task, not solved here.
// 4. search(): exchange the stored refresh token for a fresh access token
//    (refresh-token grant), then SOQL via the REST API `/query` endpoint —
//    `SELECT Id, Name, Email FROM Contact WHERE Email = :email` and the
//    same shape for Lead (V1 search scope, Ariel's call 2026-09-12 — Case/
//    Opportunity deferred).
// 5. exportRecords()/deleteRecords(): REST API GET/DELETE per sObject id.
//
// isSalesforceConfigured() is the one thing the rest of the app checks
// before offering this connector — everything else here intentionally
// throws until steps 1-5 are done.

import type { DsarConnector, MatchedRecord, ExportResult, DeleteResult } from "./types";

export function isSalesforceConfigured(): boolean {
  return Boolean(process.env.SALESFORCE_CLIENT_ID && process.env.SALESFORCE_CLIENT_SECRET);
}

const NOT_CONFIGURED =
  "Salesforce connector has no Connected App registered for this deployment yet — see src/lib/connectors/salesforce.ts for the setup steps.";
const NOT_IMPLEMENTED =
  "Salesforce OAuth app exists, but the API calls themselves are not wired up yet.";

export const salesforceConnector: DsarConnector = {
  id: "salesforce",
  label: "Salesforce",
  async search(_orgId: string, _email: string): Promise<MatchedRecord[]> {
    if (!isSalesforceConfigured()) throw new Error(NOT_CONFIGURED);
    throw new Error(NOT_IMPLEMENTED);
  },
  async exportRecords(_orgId: string, _records: MatchedRecord[]): Promise<ExportResult[]> {
    if (!isSalesforceConfigured()) throw new Error(NOT_CONFIGURED);
    throw new Error(NOT_IMPLEMENTED);
  },
  async deleteRecords(_orgId: string, _records: MatchedRecord[]): Promise<DeleteResult[]> {
    if (!isSalesforceConfigured()) throw new Error(NOT_CONFIGURED);
    throw new Error(NOT_IMPLEMENTED);
  },
};
