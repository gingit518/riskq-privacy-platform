// Shared status pill (PRD §5.12, Batch 2). Replaces ad hoc colored <span>s.
import type { ReactNode } from "react";

export type BadgeVariant = "success" | "warning" | "danger" | "neutral";

const VARIANT_STYLES: Record<BadgeVariant, { bg: string; color: string }> = {
  success: { bg: "var(--pq-success-bg)", color: "var(--pq-success)" },
  warning: { bg: "var(--pq-warning-bg)", color: "var(--pq-warning)" },
  danger: { bg: "var(--pq-danger-bg)", color: "var(--pq-danger)" },
  neutral: { bg: "var(--pq-neutral-bg)", color: "var(--pq-neutral)" },
};

export default function Badge({
  variant = "neutral",
  children,
}: {
  variant?: BadgeVariant;
  children: ReactNode;
}) {
  const s = VARIANT_STYLES[variant];
  return (
    <span
      style={{
        display: "inline-block",
        background: s.bg,
        color: s.color,
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
