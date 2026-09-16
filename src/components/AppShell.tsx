// Shared page shell — sidebar Nav + content well. Introduced in the 2026-09-16
// "Harbor" UI redesign (PRD §5.12) alongside the Nav.tsx sidebar rewrite.
// Every authenticated page wraps its content in <AppShell>...</AppShell>
// instead of the old <><Nav />{content}</> fragment.
import type { ReactNode } from "react";
import Nav from "@/components/Nav";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--pq-paper)" }}>
      <Nav />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}
