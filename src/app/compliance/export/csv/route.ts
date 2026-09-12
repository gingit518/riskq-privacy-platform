// Compliance Dashboard CSV export (PRD §5.8, Phase 5).

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { computeComplianceSummary } from "@/lib/compliance/score";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function fmt(v: number | null): string {
  return v === null ? "n/a" : `${v}%`;
}

export async function GET() {
  const session = await requireSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const summary = await computeComplianceSummary(session.orgId);

  const header = [
    "Regulation",
    "Group",
    "Obligations complete",
    "DSAR SLA met",
    "Controls implemented (group-level)",
    "Blended score",
  ];
  const lines = [header.join(",")];
  for (const r of summary.perRegulation) {
    lines.push(
      [
        csvEscape(`${r.acronym} — ${r.name}`),
        csvEscape(r.group),
        fmt(r.obligationsPct),
        fmt(r.dsarSlaPct),
        fmt(r.controlsPct),
        fmt(r.blendedScore),
      ].join(",")
    );
  }
  lines.push("");
  lines.push(`Overall score,,,,,${fmt(summary.overallScore)}`);

  const csv = lines.join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="compliance-report-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
