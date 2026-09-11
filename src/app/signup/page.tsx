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
      const body = await res.json().catch(() => ({}));
      setError(
        typeof body.error === "string"
          ? body.error
          : "Signup failed — check your input (password needs 8+ characters)."
      );
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
