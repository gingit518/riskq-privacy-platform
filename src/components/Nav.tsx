// Sidebar navigation — replaced the flat 12-link top bar in the 2026-09-16
// UI redesign (PRD §5.12, "Harbor" direction: teal + clay, Source Serif 4 +
// Public Sans). Grouped into the same sections Ariel approved in the design
// canvas (https://claude.ai/artifact/WHPMsCrPJHKeH2HJznhdzs): Overview, Data
// Rights, Data Inventory, Risk & Controls, Compliance, Admin.
//
// Client component (not the server component it used to be) because active-
// route highlighting needs usePathname(). No session data is threaded in
// here yet — the sidebar doesn't show the signed-in user's name/initials the
// way the mockup did; that needs session passed down from every page that
// renders <AppShell>, which is a bigger change than this pass (deliberately
// scoped out, flagged in the PRD, not silently dropped).
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function GridIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 12h5l2 3h4l2-3h5" />
      <path d="M5 12 3 6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1l-2 6" />
      <path d="M3 12v6a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
    </svg>
  );
}

function CheckShieldIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </svg>
  );
}

const GROUPS: NavGroup[] = [
  { label: "Overview", items: [{ href: "/summary", label: "Dashboard", icon: <GridIcon /> }] },
  { label: "Data Rights", items: [{ href: "/dsar", label: "DSAR Requests", icon: <InboxIcon /> }] },
  {
    label: "Data Inventory",
    items: [
      { href: "/ropa", label: "RoPA", icon: <FolderIcon /> },
      { href: "/transfers", label: "Transfers", icon: <FolderIcon /> },
      { href: "/tracking", label: "Tracking Tech", icon: <FolderIcon /> },
    ],
  },
  {
    label: "Risk & Controls",
    items: [
      { href: "/obligations", label: "Obligations", icon: <ShieldIcon /> },
      { href: "/controls", label: "Cyber Controls", icon: <ShieldIcon /> },
      { href: "/assessments", label: "Assessments", icon: <ShieldIcon /> },
    ],
  },
  { label: "Compliance", items: [{ href: "/compliance", label: "Compliance", icon: <CheckShieldIcon /> }] },
  {
    label: "Admin",
    items: [
      { href: "/connectors", label: "Connectors", icon: <GearIcon /> },
      { href: "/scope", label: "Regulations", icon: <GearIcon /> },
      { href: "/profile", label: "Profile", icon: <GearIcon /> },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        width: 240,
        flexShrink: 0,
        background: "var(--pq-primary)",
        color: "#EAF2F1",
        display: "flex",
        flexDirection: "column",
        padding: "24px 14px",
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          padding: "0 10px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.14)",
          marginBottom: 18,
        }}
      >
        <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 22, color: "#FFFFFF" }}>
          Privacy<span style={{ color: "var(--pq-accent)" }}>Q</span>
        </div>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "rgba(234,242,241,0.55)",
            marginTop: 4,
          }}
        >
          Compliance Platform
        </div>
      </div>

      {GROUPS.map((group) => (
        <div key={group.label} style={{ marginBottom: 4 }}>
          <div
            style={{
              fontSize: 10.5,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "rgba(234,242,241,0.45)",
              padding: "0 10px",
              margin: "14px 0 6px",
            }}
          >
            {group.label}
          </div>
          {group.items.map((item) => {
            const active = isActive(pathname ?? "", item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 8,
                  marginTop: 2,
                  fontSize: 13.5,
                  fontWeight: active ? 600 : 400,
                  color: active ? "#FFFFFF" : "rgba(234,242,241,0.85)",
                  background: active ? "rgba(255,255,255,0.12)" : "transparent",
                  borderLeft: active ? "3px solid var(--pq-accent)" : "3px solid transparent",
                  marginLeft: -3,
                  textDecoration: "none",
                }}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}

      <form
        action="/api/auth/logout"
        method="post"
        style={{
          marginTop: "auto",
          paddingTop: 14,
          borderTop: "1px solid rgba(255,255,255,0.14)",
        }}
      >
        <button
          type="submit"
          style={{
            background: "transparent",
            border: "none",
            color: "rgba(234,242,241,0.75)",
            font: "inherit",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            padding: "6px 10px",
          }}
        >
          Log out
        </button>
      </form>
    </nav>
  );
}
