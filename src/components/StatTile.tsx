// Shared status stat-tile (PRD §5.12, Batch 2) — replaces the flat
// Area/Complete/In flight/Not started table rows on the Management Summary
// View. Bar segment colors are the semantic status tokens (success/warning/
// neutral), not the brand accent — status meaning, not brand emphasis.
import Link from "next/link";
import type { CSSProperties } from "react";

export interface StatTileProps {
  label: string;
  complete: number;
  inFlight: number;
  notStarted: number;
  /** Rows that are neither pending nor done (e.g. "not applicable") — shown
   * as a footnote, never folded into the bar or the headline total. */
  excluded?: number;
  href?: string;
}

function Bar({ complete, inFlight, notStarted }: { complete: number; inFlight: number; notStarted: number }) {
  const total = complete + inFlight + notStarted;
  if (total === 0) {
    return <div style={{ height: 6, borderRadius: 3, background: "var(--pq-neutral-bg)", marginBottom: 6 }} />;
  }
  return (
    <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
      <div style={{ flex: complete, background: "var(--pq-success)" }} />
      <div style={{ flex: inFlight, background: "var(--pq-warning)" }} />
      <div style={{ flex: notStarted, background: "var(--pq-neutral)" }} />
    </div>
  );
}

export default function StatTile({ label, complete, inFlight, notStarted, excluded, href }: StatTileProps) {
  const total = complete + inFlight + notStarted;
  const boxStyle: CSSProperties = {
    flex: "1 1 180px",
    minWidth: 180,
    background: "var(--pq-surface)",
    border: "1px solid var(--pq-line)",
    borderRadius: 12,
    padding: "14px 16px",
    boxShadow: "0 1px 2px rgba(20,20,20,0.04)",
    textDecoration: "none",
    color: "inherit",
    display: "block",
    boxSizing: "border-box",
  };
  const inner = (
    <>
      <div style={{ fontSize: 12, color: "var(--pq-ink-muted)", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{total}</div>
      <Bar complete={complete} inFlight={inFlight} notStarted={notStarted} />
      <div style={{ fontSize: 11, color: "var(--pq-ink-muted)" }}>
        {complete} complete &middot; {inFlight} in flight &middot; {notStarted} not started
        {excluded ? ` · ${excluded} excluded` : ""}
      </div>
    </>
  );
  if (href) {
    return (
      <Link href={href} style={boxStyle}>
        {inner}
      </Link>
    );
  }
  return <div style={boxStyle}>{inner}</div>;
}
