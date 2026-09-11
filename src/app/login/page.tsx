"use client";

import { useState, type FormEvent, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const fieldStyle: CSSProperties = { display: "block", width: "100%", marginBottom: 12 };

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Login failed.");
      return;
    }
    router.push("/profile");
    router.refresh();
  }

  return (
    <main style={{ maxWidth: 400, margin: "80px auto", fontFamily: "system-ui" }}>
      <h1>Log in</h1>
      <form onSubmit={onSubmit}>
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
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={fieldStyle}
          />
        </label>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p>
        No account? <Link href="/signup">Sign up</Link>
      </p>
    </main>
  );
}
