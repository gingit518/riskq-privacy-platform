// Salesforce connector — real implementation (2026-09-15). RiskQ's own
// Connected App/External Client App ("RiskQ Privacy Platform"), authorized
// per-org via standard OAuth 2.0 web-server (authorization code) flow. See
// src/app/api/connectors/[connectorId]/{authorize,callback}/route.ts for the
// redirect/exchange side; this file is the token-refresh + Data API side.
//
// Scope (Ariel's call, 2026-09-14/15): Salesforce only for now — M365/Google
// Drive stay stubbed (see m365.ts/google-drive.ts). RiskQ's own Salesforce
// tenant only, not customer orgs.
//
// V1 search scope (Ariel's call 2026-09-12): Contact and Lead by exact email
// match. Case/Opportunity deferred — see types.ts header for why "correct"
// (data correction) is out of scope entirely for V1.
//
// Token handling: refresh-token grant always goes to
// https://login.salesforce.com/services/oauth2/token — this works even for
// custom-domain ("My Domain") orgs per Salesforce's own docs, so there's no
// need to persist a per-org login host. Every refresh response includes a
// fresh instance_url; that's what every subsequent Data API call in the same
// operation must use — instance_url is NOT persisted in the DB, it's
// re-fetched every time (connections.ts stores accountLabel as a
// human-readable display value only, not for routing API calls).

import type { DsarConnector, MatchedRecord, ExportResult, DeleteResult } from "./types";
import { getActiveConnection, updateRefreshToken } from "./connections";
import { decryptSecret } from "./crypto";

export function isSalesforceConfigured(): boolean {
  return Boolean(process.env.SALESFORCE_CLIENT_ID && process.env.SALESFORCE_CLIENT_SECRET);
}

const NOT_CONFIGURED =
  "Salesforce connector has no Connected App registered for this deployment yet — see src/lib/connectors/salesforce.ts for the setup steps.";
const NOT_CONNECTED =
  "Salesforce is configured but not connected yet — go to /connectors and click Connect.";

const TOKEN_URL = "https://login.salesforce.com/services/oauth2/token";
const API_VERSION = "v61.0";

function requireClientCreds(): { clientId: string; clientSecret: string } {
  const clientId = process.env.SALESFORCE_CLIENT_ID;
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error(NOT_CONFIGURED);
  return { clientId, clientSecret };
}

/** Exchanges the stored (encrypted) refresh token for a fresh access token +
 * instance_url. Called once per search/export/delete operation — Salesforce
 * access tokens are short-lived (~2h default, sometimes less), so refreshing
 * per-operation rather than caching keeps this simple and avoids a second
 * "is my cached token still good" failure mode. Never logs the token. */
async function refreshAccessToken(orgId: string): Promise<{ accessToken: string; instanceUrl: string }> {
  const { clientId, clientSecret } = requireClientCreds();
  const connection = await getActiveConnection(orgId, "salesforce");
  if (!connection) throw new Error(NOT_CONNECTED);
  const refreshToken = decryptSecret(connection.encryptedRefreshToken);

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Salesforce token refresh failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const json = (await res.json()) as { access_token?: string; instance_url?: string; refresh_token?: string };
  if (!json.access_token || !json.instance_url) {
    throw new Error("Salesforce token refresh response missing access_token/instance_url.");
  }

  // Salesforce refresh-token rotation (confirmed live 2026-09-16): a
  // grant_type=refresh_token call can come back with a NEW refresh_token,
  // which immediately invalidates the one we sent. If we don't persist it,
  // the next operation (e.g. export right after search) reuses the
  // now-stale token from the DB and fails with invalid_grant/expired
  // access-refresh-token even though the connection is perfectly healthy.
  // Only Salesforce's OWN response tells us whether rotation happened on
  // this call — some orgs/policies rotate, some don't — so this check has
  // to run on every refresh, not just once.
  if (json.refresh_token && json.refresh_token !== refreshToken) {
    await updateRefreshToken(orgId, "salesforce", json.refresh_token);
  }

  return { accessToken: json.access_token, instanceUrl: json.instance_url };
}

/** Fetches the connected org/user's display name via Salesforce's identity
 * URL, for a human-readable accountLabel on the connectors page. Best-effort
 * only — a failure here must never block a successful OAuth connection, so
 * callers wrap this in try/catch and fall back to a generic label. */
export async function fetchSalesforceIdentityLabel(accessToken: string, instanceUrl: string): Promise<string | null> {
  // The identity URL itself comes back in the token response as `id`, but
  // callers here only have accessToken/instanceUrl — re-derive it via the
  // standard userinfo-style endpoint instead of requiring the caller to
  // thread the id URL through.
  const res = await fetch(`${instanceUrl}/services/oauth2/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { organization_id?: string; preferred_username?: string; name?: string };
  const org = json.organization_id ? `org ${json.organization_id}` : null;
  const who = json.name || json.preferred_username || null;
  if (who && org) return `${who} (${org})`;
  return who || org;
}

/** Escapes a value for interpolation inside a single-quoted SOQL string
 * literal. Backslash first (so an escaped backslash doesn't get
 * double-escaped by the quote replacement that follows), then single quote —
 * matches Salesforce's documented SOQL/SOSL escaping rules. */
function escapeSoql(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function soqlQuery(
  accessToken: string,
  instanceUrl: string,
  soql: string
): Promise<Array<Record<string, unknown>>> {
  const url = `${instanceUrl}/services/data/${API_VERSION}/query?q=${encodeURIComponent(soql)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Salesforce SOQL query failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  const json = (await res.json()) as { records?: Array<Record<string, unknown>> };
  return json.records ?? [];
}

function asString(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

export const salesforceConnector: DsarConnector = {
  id: "salesforce",
  label: "Salesforce",

  async search(orgId: string, email: string): Promise<MatchedRecord[]> {
    if (!isSalesforceConfigured()) throw new Error(NOT_CONFIGURED);
    const { accessToken, instanceUrl } = await refreshAccessToken(orgId);
    const escaped = escapeSoql(email);

    const [contacts, leads] = await Promise.all([
      soqlQuery(accessToken, instanceUrl, `SELECT Id, Name, Email FROM Contact WHERE Email = '${escaped}'`),
      soqlQuery(accessToken, instanceUrl, `SELECT Id, Name, Email, Status FROM Lead WHERE Email = '${escaped}'`),
    ]);

    const matches: MatchedRecord[] = [];
    for (const c of contacts) {
      matches.push({
        externalObjectType: "Contact",
        externalRecordId: asString(c.Id),
        snapshot: { Name: asString(c.Name), Email: asString(c.Email) },
      });
    }
    for (const l of leads) {
      matches.push({
        externalObjectType: "Lead",
        externalRecordId: asString(l.Id),
        snapshot: { Name: asString(l.Name), Email: asString(l.Email), Status: asString(l.Status) },
      });
    }
    return matches;
  },

  async exportRecords(orgId: string, records: MatchedRecord[]): Promise<ExportResult[]> {
    if (!isSalesforceConfigured()) throw new Error(NOT_CONFIGURED);
    const { accessToken, instanceUrl } = await refreshAccessToken(orgId);

    const results: ExportResult[] = [];
    for (const record of records) {
      try {
        const url = `${instanceUrl}/services/data/${API_VERSION}/sobjects/${encodeURIComponent(record.externalObjectType)}/${encodeURIComponent(record.externalRecordId)}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          results.push({ externalRecordId: record.externalRecordId, ok: false, errorDetail: `HTTP ${res.status}: ${detail.slice(0, 300)}` });
          continue;
        }
        const json = await res.json();
        results.push({ externalRecordId: record.externalRecordId, ok: true, data: JSON.stringify(json, null, 2) });
      } catch (err) {
        results.push({
          externalRecordId: record.externalRecordId,
          ok: false,
          errorDetail: err instanceof Error ? err.message : "Unknown error fetching record.",
        });
      }
    }
    return results;
  },

  async deleteRecords(orgId: string, records: MatchedRecord[]): Promise<DeleteResult[]> {
    if (!isSalesforceConfigured()) throw new Error(NOT_CONFIGURED);
    const { accessToken, instanceUrl } = await refreshAccessToken(orgId);

    const results: DeleteResult[] = [];
    for (const record of records) {
      try {
        const url = `${instanceUrl}/services/data/${API_VERSION}/sobjects/${encodeURIComponent(record.externalObjectType)}/${encodeURIComponent(record.externalRecordId)}`;
        const res = await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
        // Salesforce returns 204 No Content on a successful delete.
        if (!res.ok && res.status !== 204) {
          const detail = await res.text().catch(() => "");
          results.push({ externalRecordId: record.externalRecordId, ok: false, errorDetail: `HTTP ${res.status}: ${detail.slice(0, 300)}` });
          continue;
        }
        results.push({ externalRecordId: record.externalRecordId, ok: true });
      } catch (err) {
        results.push({
          externalRecordId: record.externalRecordId,
          ok: false,
          errorDetail: err instanceof Error ? err.message : "Unknown error deleting record.",
        });
      }
    }
    return results;
  },
};
