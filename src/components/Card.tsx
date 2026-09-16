// Shared bordered surface (PRD §5.12, Batch 2). Replaces raw <table>/<div>
// sections hand-styled per page.
import type { CSSProperties, ReactNode } from "react";

export default function Card({
  title,
  children,
  style,
}: {
  title?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background: "var(--pq-surface)",
        border: "1px solid var(--pq-line)",
        borderRadius: 12,
        padding: "18px 20px",
        boxSizing: "border-box",
        ...style,
      }}
    >
      {title && <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>{title}</div>}
      {children}
    </div>
  );
}
