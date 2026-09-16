import { redirect } from "next/navigation";
import { Fragment } from "react";
import { asc, eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { controlsLibrary, orgControls } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import AppShell from "@/components/AppShell";
import Card from "@/components/Card";
import Badge, { type BadgeVariant } from "@/components/Badge";
import Button from "@/components/Button";
import { listEvidenceForControls } from "@/lib/evidence";
import { getMaturityByFunction } from "@/lib/assessments/maturity";
import { MATURITY_LEVELS, MATURITY_LEVEL_LABELS } from "@/lib/assessments/types";
import {
  ensureControlsSeeded,
  updateControlStatus,
  updateControlMaturity,
  uploadControlEvidence,
} from "./actions";

const STATUS_OPTIONS = ["not_implemented", "partial", "implemented"] as const;
const STATUS_LABELS: Record<(typeof STATUS_OPTIONS)[number], string> = {
  not_implemented: "Not implemented",
  partial: "Partial",
  implemented: "Implemented",
};
const STATUS_BADGE: Record<(typeof STATUS_OPTIONS)[number], BadgeVariant> = {
  not_implemented: "neutral",
  partial: "warning",
  implemented: "success",
};

function toDateInputValue(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

/** Cyber Controls (PRD §5.6/§5.7), reskinned in the PrivacyQ "Harbor" UI pass
 * Batch 6 (PRD §5.12). No mockup existed for this page (only Obligations/
 * Dashboard were mocked) — direct application of the existing design tokens,
 * same approach used for the DSAR list page. Deliberately kept the
 * always-open inline forms rather than adopting Obligations' read/edit-
 * toggle pattern: each row here has TWO separate forms (status+evidence,
 * and maturity) plus a file upload, and replicating the toggle interaction
 * across all three would have meaningfully expanded this batch's scope for
 * a page with no mockup calling for it. Data queries/actions unchanged. */
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
  const maturityByFunction = await getMaturityByFunction(session.orgId);
  const evidenceByControl = new Map<string, typeof evidenceRows>();
  for (const e of evidenceRows) {
    if (!e.controlId) continue;
    if (!evidenceByControl.has(e.controlId)) evidenceByControl.set(e.controlId, []);
    evidenceByControl.get(e.controlId)!.push(e);
  }

  return (
    <AppShell>
      <div style={{ padding: "24px 28px", maxWidth: 980 }}>
        <h1 style={{ marginTop: 0 }}>Cyber controls</h1>
        <p style={{ color: "var(--pq-ink-muted)", fontSize: 14 }}>
          Seed library: NIST CSF 2.0 (6 Functions, {total} Categories). <strong>Not yet seeded:</strong>{" "}
          ISO/IEC 27001, CIS Controls, NIST SP 800-53 — see PRD Appendix A on sourcing those. The
          &quot;relevant regulation groups&quot; tag on each control below is an indicative starting
          point I set, not a legally-reviewed compliance mapping — don&apos;t represent it to a
          customer as one without a review pass (PRD §9).
        </p>

        <div
          style={{
            display: "flex",
            gap: 24,
            padding: "12px 18px",
            background: "var(--pq-surface)",
            border: "1px solid var(--pq-line)",
            borderRadius: 10,
            marginBottom: 22,
            fontSize: 13,
            flexWrap: "wrap",
          }}
        >
          <div>
            <strong>{implemented}</strong> implemented
          </div>
          <div>
            <strong>{partial}</strong> partial
          </div>
          <div>
            <strong>{notImplemented}</strong> not implemented
          </div>
          <div style={{ color: "var(--pq-ink-muted)" }}>{total} total</div>
        </div>

        <Card
          title={
            <>
              Governance maturity by NIST Function (see also{" "}
              <a href="/assessments">Assessments dashboard</a>)
            </>
          }
          style={{ marginBottom: 24 }}
        >
          <table style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--pq-ink-muted)" }}>
                <th style={{ fontWeight: 500, padding: "4px 0" }}>Function</th>
                <th style={{ fontWeight: 500, padding: "4px 0" }}>Assessed</th>
                <th style={{ fontWeight: 500, padding: "4px 0" }}>Avg. maturity (0–5)</th>
              </tr>
            </thead>
            <tbody>
              {maturityByFunction.map((m) => (
                <tr key={m.function} style={{ borderTop: "1px solid var(--pq-line)" }}>
                  <td style={{ padding: "6px 0" }}>{m.function}</td>
                  <td style={{ padding: "6px 0" }}>
                    {m.assessedCount}/{m.totalCount}
                  </td>
                  <td style={{ padding: "6px 0" }}>
                    {m.averageScore !== null ? m.averageScore.toFixed(1) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {Array.from(byFunction.entries()).map(([fn, items]) => (
          <Card key={fn} title={fn} style={{ marginBottom: 18, padding: 0, overflow: "hidden" }}>
            {items.map((row) => {
              const lib = row.controls_library;
              const org = row.org_controls;
              const files = evidenceByControl.get(lib.id) ?? [];
              const status = (org?.status ?? "not_implemented") as (typeof STATUS_OPTIONS)[number];
              return (
                <div key={lib.id} style={{ padding: "14px 18px", borderTop: "1px solid var(--pq-line)" }}>
                  <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5 }}>
                        <strong>{lib.code}</strong> — {lib.category}
                      </div>
                      <div style={{ color: "var(--pq-ink-muted)", fontSize: 12, marginTop: 2 }}>
                        {lib.description}
                      </div>
                      <div style={{ color: "var(--pq-ink-muted)", fontSize: 11.5, marginTop: 4 }}>
                        Relevant to: {(lib.regulationGroupsTag as string[]).join(", ")}
                      </div>
                    </div>
                    <Badge variant={STATUS_BADGE[status]}>{STATUS_LABELS[status]}</Badge>
                  </div>

                  <form action={updateControlStatus} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
                    <input type="hidden" name="controlId" value={lib.id} />
                    <select name="status" defaultValue={status}>
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                    <input type="date" name="lastTestedAt" defaultValue={toDateInputValue(org?.lastTestedAt)} />
                    <input
                      name="evidenceNote"
                      defaultValue={org?.evidenceNote ?? ""}
                      placeholder="Evidence / notes"
                      style={{ flex: 1, minWidth: 140 }}
                    />
                    <Button type="submit" variant="primary">
                      Save
                    </Button>
                  </form>

                  <form
                    action={updateControlMaturity}
                    style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, marginBottom: 8 }}
                  >
                    <input type="hidden" name="controlId" value={lib.id} />
                    <span style={{ color: "var(--pq-ink-muted)" }}>Maturity:</span>
                    <select name="maturityLevel" defaultValue={org?.maturityLevel ?? "not_assessed"}>
                      {MATURITY_LEVELS.map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {MATURITY_LEVEL_LABELS[lvl]}
                        </option>
                      ))}
                    </select>
                    <input
                      name="maturityNotes"
                      defaultValue={org?.maturityNotes ?? ""}
                      placeholder="Maturity notes"
                      style={{ flex: 1, minWidth: 120 }}
                    />
                    <Button type="submit" variant="secondary">
                      Save
                    </Button>
                  </form>

                  {files.length > 0 && (
                    <ul style={{ margin: "0 0 6px", paddingLeft: 16, fontSize: 12 }}>
                      {files.map((f) => (
                        <li key={f.id}>
                          <a href={f.blobUrl} target="_blank" rel="noreferrer">
                            {f.fileName}
                          </a>{" "}
                          <span style={{ color: "var(--pq-ink-muted)" }}>
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
                    <Button type="submit" variant="secondary">
                      Attach evidence
                    </Button>
                  </form>
                </div>
              );
            })}
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
