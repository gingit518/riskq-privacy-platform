// Compliance Dashboard PDF export (PRD §5.8, Phase 5). Uses pdfkit — pure
// JS, no headless-browser dependency, so it runs fine in a Vercel Node.js
// serverless function (explicit `runtime = "nodejs"` below; pdfkit needs
// Node APIs pdfkit relies on and won't run on the Edge runtime).

import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { orgs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { computeComplianceSummary } from "@/lib/compliance/score";

export const runtime = "nodejs";

function fmt(v: number | null): string {
  return v === null ? "n/a" : `${v}%`;
}

export async function GET() {
  const session = await requireSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const db = getDb();
  const [org] = await db.select().from(orgs).where(eq(orgs.id, session.orgId)).limit(1);
  const summary = await computeComplianceSummary(session.orgId);

  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ margin: 50 });
  doc.on("data", (chunk) => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.fontSize(18).text(`Compliance report — ${org?.name ?? "Organization"}`, { align: "left" });
  doc.fontSize(10).fillColor("#666").text(new Date().toLocaleDateString(), { align: "left" });
  doc.moveDown();
  doc
    .fontSize(9)
    .fillColor("#666")
    .text(
      "Scores are an unweighted blend of obligations-done %, DSAR SLA-met %, and controls-implemented % " +
        "(the last measured only at the broad jurisdiction-group level, not per specific regulation — see " +
        "the in-app dashboard for why). This is a self-reported operational summary, not a certification " +
        "or legal determination of compliance.",
      { align: "left" }
    );
  doc.moveDown();

  if (!summary.hasScopeRun) {
    doc.fontSize(12).fillColor("#000").text("No regulatory scope has been analyzed for this org yet.");
  } else if (summary.perRegulation.length === 0) {
    doc.fontSize(12).fillColor("#000").text("No regulations are currently in scope.");
  } else {
    doc
      .fontSize(14)
      .fillColor("#000")
      .text(`Overall blended score: ${fmt(summary.overallScore)}`);
    doc.moveDown();

    for (const r of summary.perRegulation) {
      doc
        .fontSize(11)
        .fillColor("#000")
        .text(`${r.acronym} — ${r.name} (${r.group})`, { continued: false });
      doc
        .fontSize(9)
        .fillColor("#333")
        .text(
          `  Obligations: ${fmt(r.obligationsPct)}   DSAR SLA met: ${fmt(r.dsarSlaPct)}   Controls (group-level): ${fmt(
            r.controlsPct
          )}   Blended: ${fmt(r.blendedScore)}`
        );
      doc.moveDown(0.5);
    }
  }

  doc.end();
  const buffer = await done;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="compliance-report-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
