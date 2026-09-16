import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { requireSession } from "@/lib/auth/session";
import AppShell from "@/components/AppShell";
import { saveProfileAndAnalyze } from "./actions";
import {
  INDUSTRY_OPTIONS,
  US_STATE_OPTIONS,
  INTL_OPTIONS,
  VENDOR_COUNTRY_OPTIONS,
  DATA_TYPE_OPTIONS,
  AI_ROLE_OPTIONS,
  MARKETING_CHANNEL_OPTIONS,
} from "@/lib/regulations/options";

const fieldStyle: CSSProperties = { display: "block", width: "100%", marginBottom: 16 };

export default async function ProfilePage() {
  const session = await requireSession();
  if (!session) redirect("/login");

  return (
    <AppShell>
    <main style={{ maxWidth: 720, margin: "40px auto", fontFamily: "system-ui", padding: "0 16px" }}>
      <h1>Company profile</h1>
      <p>
        This drives Regulatory Management scope (PRD §5.1) — Business Obligations, DSAR,
        Cyber Controls, Assessments, International Transfers, and Tracking Technologies
        all read their scope from the result of this analysis. Saving creates a new
        versioned profile snapshot; it never overwrites a prior one.
      </p>
      <form action={saveProfileAndAnalyze}>
        <label>
          Company name
          <input name="name" required style={fieldStyle} />
        </label>
        <label>
          Annual revenue (USD millions)
          <input name="revenue" type="number" step="0.01" min="0" defaultValue={0} required style={fieldStyle} />
        </label>
        <label>
          Employees
          <input name="employees" type="number" min="0" defaultValue={0} required style={fieldStyle} />
        </label>
        <label>
          Consumers / records handled
          <input name="consumers" type="number" min="0" defaultValue={0} required style={fieldStyle} />
        </label>
        <label>
          % of revenue from selling/sharing personal data
          <input name="dataSale" type="number" step="0.01" min="0" max="100" defaultValue={0} required style={fieldStyle} />
        </label>
        <label>
          Industry
          <select name="industry" style={fieldStyle}>
            {INDUSTRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          US states with operations or customers (ctrl/cmd-click for multiple)
          <select name="states" multiple size={8} style={fieldStyle}>
            {US_STATE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          International jurisdictions
          <select name="intl" multiple size={8} style={fieldStyle}>
            {INTL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Vendor / investor / employment ties to countries of concern
          <select name="vendorCountries" multiple size={4} style={fieldStyle}>
            {VENDOR_COUNTRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Data types processed
          <select name="dataTypes" multiple size={6} style={fieldStyle}>
            {DATA_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          AI roles
          <select name="aiRoles" multiple size={4} style={fieldStyle}>
            {AI_ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Marketing channels
          <select name="marketingChannels" multiple size={2} style={fieldStyle}>
            {MARKETING_CHANNEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Save &amp; analyze scope</button>
      </form>
    </main>
    </AppShell>
  );
}
