// Shared button (PRD §5.12, Batch 3). First real use: the Obligations
// Edit/Save/Cancel affordance. No "use client" needed here — this component
// has no hooks of its own; onClick only works where it's rendered inside an
// already-client subtree (e.g. ObligationRow).
import type { ButtonHTMLAttributes, CSSProperties } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";

const VARIANT_STYLES: Record<ButtonVariant, CSSProperties> = {
  primary: { background: "var(--pq-primary)", color: "#FFFFFF", border: "1px solid var(--pq-primary)" },
  secondary: { background: "var(--pq-surface)", color: "var(--pq-ink)", border: "1px solid var(--pq-line)" },
  ghost: { background: "transparent", color: "var(--pq-ink-muted)", border: "1px solid transparent" },
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export default function Button({ variant = "secondary", style, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      style={{
        font: "inherit",
        fontSize: 12.5,
        fontWeight: 600,
        borderRadius: 8,
        padding: "6px 14px",
        cursor: "pointer",
        ...VARIANT_STYLES[variant],
        ...style,
      }}
    />
  );
}
