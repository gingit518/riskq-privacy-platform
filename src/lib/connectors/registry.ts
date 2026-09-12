// Single lookup point for "which connector implementation backs this
// connector_id right now" — real (stubbed) by default, or all-mock when
// CONNECTOR_MOCK_MODE=true (see mock.ts). Nothing else in the app should
// import salesforce.ts/m365.ts/google-drive.ts/mock.ts directly; go through
// here so the mock-mode switch is the only place that decision is made.

import type { ConnectorId } from "@/lib/connectors/types";
import type { DsarConnector } from "./types";
import { isMockModeEnabled, mockSalesforceConnector, mockM365Connector, mockGoogleDriveConnector } from "./mock";
import { salesforceConnector, isSalesforceConfigured } from "./salesforce";
import { m365Connector, isM365Configured } from "./m365";
import { googleDriveConnector, isGoogleDriveConfigured } from "./google-drive";

export interface ConnectorInfo {
  id: ConnectorId;
  label: string;
  configured: boolean;
  mock: boolean;
}

const CONNECTOR_IDS: ConnectorId[] = ["salesforce", "m365", "google_drive"];

export function getConnector(id: ConnectorId): DsarConnector {
  if (isMockModeEnabled()) {
    if (id === "salesforce") return mockSalesforceConnector;
    if (id === "m365") return mockM365Connector;
    return mockGoogleDriveConnector;
  }
  if (id === "salesforce") return salesforceConnector;
  if (id === "m365") return m365Connector;
  return googleDriveConnector;
}

/** For the /connectors settings page — what's available and whether it's
 * real, mock, or not configured at all yet. */
export function listConnectorInfo(): ConnectorInfo[] {
  const mock = isMockModeEnabled();
  return CONNECTOR_IDS.map((id) => {
    const configured = mock
      ? true
      : id === "salesforce"
        ? isSalesforceConfigured()
        : id === "m365"
          ? isM365Configured()
          : isGoogleDriveConfigured();
    return { id, label: getConnector(id).label, configured, mock };
  });
}
