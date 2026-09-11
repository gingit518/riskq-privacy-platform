import { redirect } from "next/navigation";
import { Fragment } from "react";
import { asc, eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { controlsLibrary, orgControls } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import Nav from "@/components/Nav";
import { listEvidenceForControls } from "@/lib/evidence";
import { ensureControlsSeeded, updateControlStatus, uploadControlEvidence } from "./actions";

const STATUS_OPTIONS = ["not_implemented", "partial", "implemented"] as const;

function toDateInputValue(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export default async function ControlsPage() {
  const session = await requireSession();
  if (!session) redirect("/login");

  await ensureControlsSeeded();

  const db = getDb();
  const rows = await db
    .select()
    .from(controlsLibrary)
    .leftJoin(
      orgControls,
      and(eq(orgControls.controlId, controlsLibrary.id), eq(orgControls.orgId, session.orgId))
    )
    .orderBy(asc(controlsLibrary.function), asc(controlsLibrary.code));

  const total = rows.length;
  const implemented = rows.filter((r) => r.org_controls?.status === "implemented").length;
  const partial = rows.filter((r) => r.org_controls?.status === "partial").length;
  const notImplemented = total - implemented - partial;

  const byFunction = new Map<string, typeof rows>();
  for (const row of rows) {
    const fn = row.controls_library.function;
    if (!byFunction.has(fn)) byFunction.set(fn, []);
    byFunction.get(fn)!.push(row);
  }

  const evidenceRows = await listEvidenceForControls(
    session.orgId,
    rows.map((r) => r.controls_library.id)
  );
  const evidenceByControl = new Map<string, typeof evidenceRows>();
  for (const e of evidenceRows) {
    if (!e.controlId) continue;
    if (!evidenceByControl.has(e.controlId)) evidenceByControl.set(e.controlId, []);
    evidenceByControl.get(e.controlId)!.push(e);
  }

  return (
    <>
      <Nav />
      <main style={{ maxWidth: 900, margin: "40px auto", fontFamily: "system-ui", padding: "0 16px" }}>
        <h1>Cyber controls</h1>
        <p>
          Seed library: NIST CSF 2.0 (6 Functions, {total} Categories). <strong>Not yet seeded:</strong>{" "}
          ISO/IEC 27001, CIS Controls, NIST SP 800-53 — see PRD Appendix A on sourcing those. The
          &quot;relevant regulation groups&quot; tag on each control below is an indicative starting
          point I set, not a legally-reviewed compliance mapping — don&apos;t represent it to a
          customer as one without a review pass (PRD §9).
        </p>

        <p style={{ padding: 8, background: "#f5f5f5", display: "inline-block" }}>
          <strong>{implemented}</strong> implemented · <strong>{partial}</strong> partial ·{" "}
          <strong>{notImplemented}</strong> not implemented · {total} total
        </p>

        {Array.from(byFunction.entries()).map(([fn, items]) => (
          <section key={fn} style={{ marginBottom: 32 }}>
            <h2>{fn}</h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
                  <th style={{ padding: 4 }}>Category</th>
                  <th style={{ padding: 4 }}>Relevant to</th>
                  <th style={{ padding: 4 }}>Status</th>
                  <th style={{ padding: 4 }}>Last tested</th>
                  <th style={{ padding: 4 }}>Evidence / notes</th>
                  <th style={{ padding: 4 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const lib = row.controls_library;
                  const org = row.org_controls;
                  const files = evidenceByControl.get(lib.id) ?? [];
                  return (
                    <Fragment key={lib.id}>
                    <tr style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: 4, verticalAlign: "top", maxWidth: 280 }}>
                        <strong>{lib.code}</strong> — {lib.category}
                        <div style={{ color: "#666", fontSize: 12 }}>{lib.description}</div>
                      </td>
                      <td style={{ padding: 4, verticalAlign: "top", fontSize: 12, color: "#666" }}>
                        {(lib.regulationGroupsTag as string[]).join(", ")}
                      </td>
                      <td colSpan={3} style={{ padding: 0 }}>
                        <form
                          action={updateControlStatus}
                          style={{ display: "flex", gap: 8, padding: 4 }}
                        >
                          <input type="hidden" name="controlId" value={lib.id} />
                          <select name="status" defaultValue={org?.status ?? "not_implemented"}>
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>
                                {s.replace("_", " ")}
                              </option>
                            ))}
                          </select>
                          <input
                            type="date"
                            name="lastTestedAt"
                            defaultValue={toDateInputValue(org?.lastTestedAt)}
                          />
                          <input
                            name="evidenceNote"
                            defaultValue={org?.evidenceNote ?? ""}
                            placeholder="Evidence / notes"
                            style={{ flex: 1 }}
                          />
                          <button type="submit">Save</button>
                        </form>
                      </td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #eee" }}>
                      <td></td>
                      <td colSpan={4} style={{ padding: "0 4px 8px", fontSize: 12 }}>
                        {files.length > 0 && (
                          <ul style={{ margin: "0 0 4px", paddingLeft: 16 }}>
                            {files.map((f) => (
                              <li key={f.id}>
                                <a href={f.blobUrl} target="_blank" rel="noreferrer">
                                  {f.fileName}
                                </a>{" "}
                                <span style={{ color: "#666" }}>
                                  — {(f.sizeBytes / 1024).toFixed(0)}KB, uploaded{" "}
                                  {new Date(f.uploadedAt as unknown as string).toLocaleDateString()}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <form
                          action={uploadControlEvidence}
                          encType="multipart/form-data"
                          style={{ display: "flex", gap: 8, alignItems: "center" }}
                        >
                          <input type="hidden" name="controlId" value={lib.id} />
                          <input type="file" name="file" required />
                          <button type="submit">Attach evidence</button>
                        </form>
                      </td>
                    </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}
      </main>
    </>
  );
}
