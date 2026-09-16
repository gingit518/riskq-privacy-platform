import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "PrivacyQ",
  description:
    "PrivacyQ — regulatory scope, business obligations, DSAR, and cyber controls compliance platform.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
