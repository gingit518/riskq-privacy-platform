// Response templates (PRD §5.3: "response templates"). Plain text, either
// copy-pasted by staff into their own email client, or sent automatically
// via sendDsarResponse (src/app/dsar/actions.ts) using these same strings —
// see Phase 3.1 (2026-09-12) README section. Editable content, not code —
// could move to a DB table if per-org customization is wanted later, same
// evolution path as the Cyber Controls seed library.
//
// access/portability bodies reference a downloadLink rather than a literal
// "attached" file: DSAR export files are private Vercel blobs with no
// directly-fetchable public URL (see evidence.ts), so the token-gated
// /dsar/download/[token] link IS how the requester gets their data, whether
// the send is automated or a staff member pastes this text by hand.

import type { DsarRequestType } from "./types";

export function acknowledgmentTemplate(params: {
  requesterName: string;
  orgName: string;
  requestTypeLabel: string;
  dueDateText: string;
}): string {
  return `Dear ${params.requesterName},

We have received your ${params.requestTypeLabel.toLowerCase()} request regarding your personal data held by ${params.orgName}. We are verifying your identity and will process your request${
    params.dueDateText ? ` by ${params.dueDateText}` : ""
  }.

If we need any additional information to verify your identity or locate your records, we will contact you at the email address you provided.

Thank you for your patience.

${params.orgName}`;
}

const COMPLETION_BODY: Record<DsarRequestType, (orgName: string, downloadLink?: string) => string> = {
  access: (orgName, downloadLink) =>
    `${
      downloadLink
        ? `You can securely download a copy of the personal data we hold about you at the link below. This link will expire; if it stops working, contact us and we will issue a new one.\n\n${downloadLink}`
        : "Attached is a copy of the personal data we hold about you, as requested."
    } If any portion of your records was withheld or redacted, this is noted along with the reason.\n\n${orgName}`,
  deletion: (orgName) =>
    `We have deleted or anonymized the personal data associated with your request, except where retention is required by law or an active legal obligation, which is noted below.\n\n${orgName}`,
  correction: (orgName) =>
    `We have updated the personal data associated with your request as you specified.\n\n${orgName}`,
  portability: (orgName, downloadLink) =>
    `${
      downloadLink
        ? `You can securely download an export of your personal data, in a structured machine-readable format, at the link below. This link will expire; if it stops working, contact us and we will issue a new one.\n\n${downloadLink}`
        : "Attached is an export of your personal data in a structured, machine-readable format, as requested."
    }\n\n${orgName}`,
  opt_out: (orgName) =>
    `We have honored your request to opt out of the sale/sharing of your personal data and have instructed relevant vendors/partners to do the same.\n\n${orgName}`,
};

export function completionTemplate(params: {
  requesterName: string;
  orgName: string;
  requestType: DsarRequestType;
  downloadLink?: string;
}): string {
  return `Dear ${params.requesterName},

${COMPLETION_BODY[params.requestType](params.orgName, params.downloadLink)}`;
}

export function denialTemplate(params: {
  requesterName: string;
  orgName: string;
  requestTypeLabel: string;
}): string {
  return `Dear ${params.requesterName},

After review, we are unable to fulfill your ${params.requestTypeLabel.toLowerCase()} request. [Insert the specific statutory exemption or reason here before sending.]

If you believe this determination was made in error, you may [insert applicable appeal process, if required by the governing regulation].

${params.orgName}`;
}
