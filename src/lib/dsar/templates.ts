// Response templates (PRD §5.3: "response templates"). Plain text with
// {{placeholder}} tokens the detail page fills in — no email-sending
// capability in this app (Phase 1's known-gaps list already flags "no
// password reset flow"; adding transactional email infra is out of scope
// for this pass), so these are copy-to-clipboard text the staff member
// pastes into their own email client. Editable content, not code — could
// move to a DB table if per-org customization is wanted later, same
// evolution path as the Cyber Controls seed library.

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

const COMPLETION_BODY: Record<DsarRequestType, (orgName: string) => string> = {
  access: (orgName) =>
    `Attached is a copy of the personal data we hold about you, as requested. If any portion of your records was withheld or redacted, this is noted in the attachment, along with the reason.\n\n${orgName}`,
  deletion: (orgName) =>
    `We have deleted or anonymized the personal data associated with your request, except where retention is required by law or an active legal obligation, which is noted below.\n\n${orgName}`,
  correction: (orgName) =>
    `We have updated the personal data associated with your request as you specified.\n\n${orgName}`,
  portability: (orgName) =>
    `Attached is an export of your personal data in a structured, machine-readable format, as requested.\n\n${orgName}`,
  opt_out: (orgName) =>
    `We have honored your request to opt out of the sale/sharing of your personal data and have instructed relevant vendors/partners to do the same.\n\n${orgName}`,
};

export function completionTemplate(params: {
  requesterName: string;
  orgName: string;
  requestType: DsarRequestType;
}): string {
  return `Dear ${params.requesterName},

${COMPLETION_BODY[params.requestType](params.orgName)}`;
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
