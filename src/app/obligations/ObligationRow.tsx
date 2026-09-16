"use client";

// Read/edit-toggle row for the Obligations page (PRD §5.12 Batch 3) —
// replaces the old always-open inline form with a compact read view plus an
// Edit button, per the approved "After-Obligations" mockup. Client component
// because the edit/read toggle needs local state; the actual save/upload
// still goes through the same server actions obligations/page.tsx already
// used (passed down as props — Next.js server actions work fine invoked
// from a client component's <form action={...}>).
//
// The edit form closes optimistically on submit (onSubmit sets editing
// false without preventDefault, so the server action still fires) rather
// than waiting for the revalidatePath("/obligations") round-trip — React
// keeps this component's local state across that re-render since it's the
// same instance/key, so without this the row would stay open after Save.
import { useState } from "react";
import Badge, { type BadgeVariant } from "@/components/Badge";
import Button from "@/components/Button";
import Avatar from "@/components/Avatar";

const STATUS_OPTIONS = ["not_started", "in_progress", "done", "not_applicable"] as const;
export type ObligationStatus = (typeof STATUS_OPTIONS)[number];

const STATUS_LABELS: Record<ObligationStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
  not_applicable: "Not applicable",
};

const STATUS_BADGE: Record<ObligationStatus, BadgeVariant> = {
  not_started: "neutral",
  in_progress: "warning",
  done: "success",
  not_applicable: "neutral",
};

export interface EvidenceFile {
  id: string;
  blobUrl: string;
  fileName: string;
  sizeBytes: number;
  uploadedAt: Date | string;
}

export interface ObligationRowData {
  id: string;
  obligationText: string;
  status: ObligationStatus;
  ownerId: string | null;
  dueDate: Date | string | null;
  evidenceNote: string;
}

function toDateInputValue(d: Date | string | null): string {
  if (!d) return "";
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  const date = new Date(d as unknown as string);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

export default function ObligationRow({
  row,
  orgUsers,
  files,
  updateObligation,
  uploadObligationEvidence,
}: {
  row: ObligationRowData;
  orgUsers: { id: string; email: string }[];
  files: EvidenceFile[];
  updateObligation: (formData: FormData) => Promise<void>;
  uploadObligationEvidence: (formData: FormData) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const ownerEmail = orgUsers.find((u) => u.id === row.ownerId)?.email ?? null;

  if (!editing) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "14px 18px",
          borderBottom: "1px solid var(--pq-line)",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13 }}>{row.obligationText}</div>
          {files.length > 0 && (
            <div style={{ fontSize: 11.5, color: "var(--pq-ink-muted)", marginTop: 6 }}>
              {files.length} file{files.length > 1 ? "s" : ""} attached
            </div>
          )}
        </div>
        <Badge variant={STATUS_BADGE[row.status]}>{STATUS_LABELS[row.status]}</Badge>
        <div style={{ display: "flex", alignItems: "center", gap: 6, width: 170, flexShrink: 0 }}>
          <Avatar email={ownerEmail} />
          <span
            style={{
              fontSize: 12,
              color: "var(--pq-ink-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {ownerEmail ?? "Unassigned"}
          </span>
        </div>
        <div style={{ fontSize: 12, color: "var(--pq-ink-muted)", width: 90, flexShrink: 0 }}>
          {fmtDate(row.dueDate)}
        </div>
        <Button variant="secondary" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>
    );
  }

  return (
    <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--pq-line)", background: "var(--pq-paper)" }}>
      <div style={{ fontSize: 13, marginBottom: 10, fontWeight: 600 }}>{row.obligationText}</div>
      <form
        action={updateObligation}
        onSubmit={() => setEditing(false)}
        style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}
      >
        <input type="hidden" name="id" value={row.id} />
        <select name="status" defaultValue={row.status}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select name="ownerId" defaultValue={row.ownerId ?? ""} style={{ width: 160 }}>
          <option value="">Unassigned</option>
          {orgUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.email}
            </option>
          ))}
        </select>
        <input type="date" name="dueDate" defaultValue={toDateInputValue(row.dueDate)} />
        <input
          name="evidenceNote"
          defaultValue={row.evidenceNote}
          placeholder="Evidence / notes"
          style={{ flex: 1, minWidth: 160 }}
        />
        <Button type="submit" variant="primary">
          Save
        </Button>
        <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </form>

      {files.length > 0 && (
        <ul style={{ margin: "0 0 8px", paddingLeft: 16, fontSize: 12 }}>
          {files.map((f) => (
            <li key={f.id}>
              <a href={f.blobUrl} target="_blank" rel="noreferrer">
                {f.fileName}
              </a>{" "}
              <span style={{ color: "var(--pq-ink-muted)" }}>
                — {(f.sizeBytes / 1024).toFixed(0)}KB, uploaded {fmtDate(f.uploadedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <form
        action={uploadObligationEvidence}
        encType="multipart/form-data"
        style={{ display: "flex", gap: 8, alignItems: "center" }}
      >
        <input type="hidden" name="obligationId" value={row.id} />
        <input type="file" name="file" required />
        <Button type="submit" variant="secondary">
          Attach evidence
        </Button>
      </form>
    </div>
  );
}
