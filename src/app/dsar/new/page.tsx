import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import Nav from "@/components/Nav";
import { DSAR_REQUEST_TYPES, DSAR_REQUEST_TYPE_LABELS } from "@/lib/dsar/types";
import { createInternalDsarRequest } from "../actions";

export default async function NewDsarRequestPage() {
  const session = await requireSession();
  if (!session) redirect("/login");

  return (
    <>
      <Nav />
      <main style={{ maxWidth: 480, margin: "40px auto", fontFamily: "system-ui", padding: "0 16px" }}>
        <h1>Log a DSAR request</h1>
        <p style={{ color: "#666", fontSize: 14 }}>
          For requests that come in by phone, mail, or another channel besides
          the public intake form. The SLA due date is computed automatically
          from your organization&apos;s current in-scope regulations (shortest
          applicable statutory response window).
        </p>
        <form action={createInternalDsarRequest}>
          <label style={{ display: "block", marginBottom: 12 }}>
            Requester name
            <input required name="requesterName" style={{ display: "block", width: "100%" }} />
          </label>
          <label style={{ display: "block", marginBottom: 12 }}>
            Requester email
            <input
              required
              type="email"
              name="requesterEmail"
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <label style={{ display: "block", marginBottom: 12 }}>
            Request type
            <select name="requestType" style={{ display: "block", width: "100%" }}>
              {DSAR_REQUEST_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DSAR_REQUEST_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Log request</button>
        </form>
      </main>
    </>
  );
}
