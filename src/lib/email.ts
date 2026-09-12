// Transactional email — Phase 3.1 (2026-09-12), added solely for DSAR
// response sending (src/app/dsar/actions.ts sendDsarResponse). Nothing else
// in the app sends email yet.
//
// Requires RESEND_API_KEY (create at resend.com, same "throw a clear error,
// not a silent no-op" philosophy as BLOB_READ_WRITE_TOKEN/DATABASE_URL
// elsewhere in this codebase — see .env.example). EMAIL_FROM must be an
// address on a domain verified in Resend, or Resend's sandbox
// `onboarding@resend.dev` for testing before a domain is verified.

import { Resend } from "resend";

export interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not set — create a Resend account (resend.com), generate an API key, " +
        "and add it to Vercel's Environment Variables, same pattern as BLOB_READ_WRITE_TOKEN."
    );
  }
  const from = process.env.EMAIL_FROM || "onboarding@resend.dev";

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: params.to,
    subject: params.subject,
    text: params.text,
  });
  if (error) {
    throw new Error(`Resend failed to send: ${error.message}`);
  }
}

/** Builds an absolute URL for a link that has to work outside the app (an
 * emailed link). APP_BASE_URL is the explicit override; falls back to
 * Vercel's auto-injected VERCEL_URL in deployed environments. Throws rather
 * than silently emailing a broken localhost link. */
export function getAppBaseUrl(): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  throw new Error(
    "Neither APP_BASE_URL nor VERCEL_URL is set — cannot build an absolute link for the emailed " +
      "DSAR response. Set APP_BASE_URL in Vercel's Environment Variables to your production URL."
  );
}
