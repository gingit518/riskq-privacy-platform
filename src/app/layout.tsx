import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "RiskQ Privacy Compliance Platform",
  description:
    "Regulatory scope, business obligations, DSAR, and cyber controls — Phase 1 scaffold.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
