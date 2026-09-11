"use client";

// Client component so a submission failure can show an inline message
// rather than Next's generic error page — same lesson as the signup
// error-masking fix in Appendix A, applied up front here instead of found
// live later.

import { useState, type FormEvent } from "react";
import {
  DSAR_REQUEST_TYPES,
  DSAR_REQUEST_TYPE_LABELS,
  type DsarRequestType,
} from "@/lib/dsar/types";
import { submitPublicDsarRequest } from "@/app/intake/[slug]/actions";

const fieldStyle = { display: "block", width: "100%", marginBottom: 12 };

export default function PublicIntakeForm({
  slug,
  orgName,
}: {
  slug: string;
  orgName: string;
}) {
  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [requestType, setRequestType] = useState<DsarRequestType>("access");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.set("requesterName", requesterName);
    formData.set("requesterEmail", requesterEmail);
    formData.set("requestType", requestType);

    const result = await submitPublicDsarRequest(slug, formData);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error || "Something went wrong submitting your request.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <main style={{ maxWidth: 480, margin: "80px auto", fontFamily: "system-ui" }}>
        <h1>Request received</h1>
        <p>
          Thank you — your request has been submitted to {orgName}. You will be
          contacted at the email address you provided.
        </p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: "80px auto", fontFamily: "system-ui" }}>
      <h1>Data subject request — {orgName}</h1>
      <p>
        Use this form to request access to, deletion of, correction of, or a
        copy of the personal data {orgName} holds about you, or to opt out of
        the sale/sharing of your data.
      </p>
      <form onSubmit={onSubmit}>
        <label>
          Your name
          <input
            required
            value={requesterName}
            onChange={(e) => setRequesterName(e.target.value)}
            style={fieldStyle}
          />
        </label>
        <label>
          Your email
          <input
            type="email"
            required
            value={requesterEmail}
            onChange={(e) => setRequesterEmail(e.target.value)}
            style={fieldStyle}
          />
        </label>
        <label>
          Request type
          <select
            value={requestType}
            onChange={(e) => setRequestType(e.target.value as DsarRequestType)}
            style={fieldStyle}
          >
            {DSAR_REQUEST_TYPES.map((t) => (
              <option key={t} value={t}>
                {DSAR_REQUEST_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit request"}
        </button>
      </form>
    </main>
  );
}
