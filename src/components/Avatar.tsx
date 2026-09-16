// Tiny initials avatar (PRD §5.12, Batch 3) — owner display on Obligations
// (and anywhere else an assigned user's email needs a compact label). Users
// have no `name` column (email/password auth only — see lib/org/users.ts),
// so initials come from the email's first two characters.
export default function Avatar({ email, size = 20 }: { email: string | null; size?: number }) {
  const initials = email ? email.slice(0, 2).toUpperCase() : "?";
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: email ? "var(--pq-accent)" : "var(--pq-line)",
        color: email ? "#14201F" : "var(--pq-ink-muted)",
        fontSize: size * 0.45,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}
