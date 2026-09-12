import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { legalHolds } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import Nav from "@/components/Nav";
import { addLegalHoldAction, releaseLegalHoldAction } from "./actions";

export default async function LegalHoldsSettingsPage() {
  const session = await requireSession();
  if (!session) redirect("/login");

  const db = getDb();
  const holds = await db
    .select()
    .from(legalHolds)
    .where(eq(legalHolds.orgId, session.orgId))
    .orderBy(desc(legalHolds.createdAt));

  return (
    <>
      <Nav />
      <main style={{ maxWidth: 700, margin: "40px auto", fontFamily: "system-ui", padding: "0 16px" }}>
        <h1>Legal Holds</h1>
        <p style={{ color: "#666", fontSize: 14 }}>
          Names/emails under an active hold or litigation matter. Every DSAR
          request detail page checks the requester&apos;s email against this
          list <strong>live</strong> (not just at intake), since a hold can
          be placed after a request is already open. This is a flag for a
          human reviewer, not a block — whether the hold actually justifies
          withholding data is still a legal judgment call.
        </p>

        <ul style={{ paddingLeft: 0, listStyle: "none", marginBottom: 24 }}>
          {holds.map((h) => (
            <li
              key={h.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 0",
                borderBottom: "1px solid #eee",
                opacity: h.active ? 1 : 0.5,
              }}
            >
              <div>
                <strong>{h.subjectName || h.subjectEmail}</strong>
                {!h.active && <span style={{ fontSize: 12, color: "#666" }}> (released)</span>}
                <div style={{ fontSize: 13, color: "#666" }}>{h.subjectEmail}</div>
                {h.matter && <div style={{ fontSize: 12, color: "#888" }}>{h.matter}</div>}
              </div>
              {h.active && (
                <form action={releaseLegalHoldAction}>
                  <input type="hidden" name="id" value={h.id} />
                  <button type="submit">Release</button>
                </form>
              )}
            </li>
          ))}
          {holds.length === 0 && (
            <li style={{ color: "#666", padding: "8px 0" }}>No legal holds on file.</li>
          )}
        </ul>

        <h2>Add a hold</h2>
        <form action={addLegalHoldAction} style={{ display: "grid", gap: 8, maxWidth: 400 }}>
          <label>
            Subject name
            <input name="subjectName" style={{ display: "block", width: "100%" }} />
          </label>
          <label>
            Subject email
            <input name="subjectEmail" type="email" required style={{ display: "block", width: "100%" }} />
          </label>
          <label>
            Matter
            <input name="matter" style={{ display: "block", width: "100%" }} />
          </label>
          <button type="submit">Add hold</button>
        </form>
      </main>
    </>
  );
}
