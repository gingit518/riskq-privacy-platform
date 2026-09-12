// Minimal shared nav — added in Phase 2 once there were enough pages
// (profile/scope/obligations/controls) that having none was a real usability
// gap, not just unstyled. Also the first place a logout control exists in
// the UI; the /api/auth/logout route has existed since Phase 1 but nothing
// linked to it.
import Link from "next/link";

const linkStyle = { marginRight: 16 };

export default function Nav() {
  return (
    <nav
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: "12px 16px",
        borderBottom: "1px solid #ddd",
        fontFamily: "system-ui",
        fontSize: 14,
        display: "flex",
        alignItems: "center",
      }}
    >
      <Link href="/profile" style={linkStyle}>
        Profile
      </Link>
      <Link href="/scope" style={linkStyle}>
        Regulations
      </Link>
      <Link href="/obligations" style={linkStyle}>
        Obligations
      </Link>
      <Link href="/controls" style={linkStyle}>
        Cyber Controls
      </Link>
      <Link href="/dsar" style={linkStyle}>
        DSAR
      </Link>
      <Link href="/ropa" style={linkStyle}>
        RoPA
      </Link>
      <Link href="/transfers" style={linkStyle}>
        Transfers
      </Link>
      <Link href="/assessments" style={linkStyle}>
        Assessments
      </Link>
      <Link href="/tracking" style={linkStyle}>
        Tracking Tech
      </Link>
      <Link href="/compliance" style={linkStyle}>
        Compliance
      </Link>
      <form action="/api/auth/logout" method="post" style={{ marginLeft: "auto" }}>
        <button type="submit">Log out</button>
      </form>
    </nav>
  );
}
