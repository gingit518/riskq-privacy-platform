// DSAR SLA derivation (PRD §5.3: "SLA clock pulled from Regulatory
// Management scoping, per-regulation").
//
// IMPORTANT SIMPLIFICATION, flagged rather than silently assumed: each
// ported REGS entry carries exactly one `resp` field — a single "consumer
// response timeline" per regulation (see regulations/types.ts) — not a
// breakdown by request type (access vs. deletion vs. correction vs.
// portability vs. opt-out). GDPR's 30 days and CCPA's 45 days (the PRD's own
// example) are both single per-regulation figures, so this SLA logic picks
// the governing regulation the same way regardless of which request type was
// selected. If a future legal-review pass (PRD §9 item 3/7) adds per-right
// timelines, this is the file to revisit.
//
// Per Ariel's explicit call (2026-09-11): when more than one in-scope
// regulation has a parseable numeric response window, the SHORTEST one wins
// and becomes the governing regulation / due date. Regulations with no
// parseable day count (breach-notification-only regs like PCI-DSS, or vague
// text like "Reasonable time") are excluded from the SLA calculation
// entirely — they don't produce a false due date, and don't win by default.

import type { RegulationMetadata } from "@/lib/regulations/types";

export interface ParsedSla {
  days: number;
  /** True if the statute specifies business/working days rather than
   * calendar days — the due date below still adds calendar days as an
   * approximation (no business-day calendar in this app yet); flagged in the
   * UI rather than silently treated as exact. */
  isBusinessDays: boolean;
}

/** Parses the free-text `resp` field into a day count where possible.
 * Returns null for "N/A", "Reasonable time", "Reasonable", "Yes", "Annual
 * report", or anything else that isn't a concrete response window — those
 * are real values in the ported data (see data.ts), not parsing failures. */
export function parseRespDays(resp: string): ParsedSla | null {
  const text = resp.trim().toLowerCase();

  const weeksMatch = text.match(/(\d+)\s*week/);
  if (weeksMatch) {
    return { days: parseInt(weeksMatch[1], 10) * 7, isBusinessDays: false };
  }

  const dayMatch = text.match(/(\d+)\s*(business|working)?\s*day/);
  if (dayMatch) {
    return {
      days: parseInt(dayMatch[1], 10),
      isBusinessDays: Boolean(dayMatch[2]),
    };
  }

  if (text === "immediate") {
    return { days: 0, isBusinessDays: false };
  }

  return null;
}

export interface GoverningRegulation {
  acronym: string;
  name: string;
  respText: string;
  slaDays: number;
  isBusinessDays: boolean;
}

/** Picks the shortest parseable SLA among the org's currently in-scope
 * regulations. Returns null if none of them have a parseable response
 * window — the request is still tracked, just with no enforced due date. */
export function pickGoverningRegulation(
  inScopeRegs: RegulationMetadata[]
): GoverningRegulation | null {
  let best: GoverningRegulation | null = null;

  for (const reg of inScopeRegs) {
    const parsed = parseRespDays(reg.resp);
    if (!parsed) continue;
    if (!best || parsed.days < best.slaDays) {
      best = {
        acronym: reg.acronym,
        name: reg.name,
        respText: reg.resp,
        slaDays: parsed.days,
        isBusinessDays: parsed.isBusinessDays,
      };
    }
  }

  return best;
}

/** Adds `days` calendar days to `from`. Business/working-day statutes are
 * approximated as calendar days too — see the isBusinessDays flag above for
 * why that's surfaced rather than hidden. */
export function computeDueDate(from: Date, days: number): Date {
  const due = new Date(from);
  due.setDate(due.getDate() + days);
  return due;
}
