"use client";

import { useState, type FormEvent, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const fieldStyle: CSSProperties = { display: "block", width: "100%", marginBottom: 12 };

export default function SignupPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgName, email, password }),
    });
    setSubmitting(false);
    if (!res.ok) {
      // Surface the real cause instead of a guessed one — see PRD Appendix A
      // "bug found, not yet fixed": this used to fall back to a hardcoded
      // "password needs 8+ characters" message for ANY non-string error body
      // (a Zod validation object, or an opaque 500 with no JSON body at all),
      // which masked an unrelated missing-migration bug during real testing.
      const body = await res.json().catch(() => null);
      let message = `Signup failed (HTTP ${res.status}). Check the server logs for details.`;
      if (body && typeof body.error === "string") {
        message = body.error;
      } else if (body?.error?.fieldErrors) {
        const fieldErrors = body.error.fieldErrors as Record<string, string[]>;
        const firstField = Object.keys(fieldErrors).find((k) => fieldErrors[k]?.length);
        message = firstField
          ? `${firstField}: ${fieldErrors[firstField][0]}`
          : "Signup failed — invalid input.";
      }
      setError(message);
      return;
    }
    router.push("/profile");
    router.refresh();
  }

  return (
    <main style={{ maxWidth: 400, margin: "80px auto", fontFamily: "system-ui" }}>
      <h1>Create your account</h1>
      <form onSubmit={onSubmit}>
        <label>
          Organization name
          <input
            required
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            style={fieldStyle}
          />
        </label>
        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={fieldStyle}
          />
        </label>
        <label>
          Password (min. 8 characters)
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={fieldStyle}
          />
        </label>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create account"}
        </button>
      </form>
      <p>
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </main>
  );
}
