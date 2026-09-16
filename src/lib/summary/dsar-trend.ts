// DSAR week-over-week trend for the Management Summary View (PRD §5.11).
// Computed straight from dsar_requests.createdAt/closedAt/slaDueAt — no new
// schema, matching /dsar's own existing breach-rate logic (dsar/page.tsx),
// just windowed into "this week" vs. "the week before" instead of
// all-time. This is the ONLY trend the Management view ships with in V1 —
// the Compliance blended score has no historical tracking at all (see PRD
// §5.11's 2026-09-16 update) and is deliberately NOT trended here.

export interface DsarWindowStats {
  opened: number;
  closed: number;
  breachRate: number | null; // % of requests with an SLA that breached, among those due/closed in this window
}

export interface DsarTrend {
  thisWeek: DsarWindowStats;
  lastWeek: DsarWindowStats;
}

type Row = {
  createdAt: Date | string;
  closedAt: Date | string | null;
  slaDueAt: Date | string | null;
};

function windowStats(rows: Row[], windowStart: Date, windowEnd: Date, now: Date): DsarWindowStats {
  const opened = rows.filter((r) => {
    const created = new Date(r.createdAt);
    return created >= windowStart && created < windowEnd;
  }).length;

  const closed = rows.filter((r) => {
    if (!r.closedAt) return false;
    const closedAt = new Date(r.closedAt);
    return closedAt >= windowStart && closedAt < windowEnd;
  }).length;

  // Breach rate within the window: of requests with an SLA due date that
  // fell in this window, what fraction breached (closed after due, or still
  // open and already past due as of `now`)? Matches /dsar's own
  // isBreached definition, just scoped to one week instead of all-time.
  const withSlaInWindow = rows.filter((r) => {
    if (!r.slaDueAt) return false;
    const due = new Date(r.slaDueAt);
    return due >= windowStart && due < windowEnd;
  });
  const breached = withSlaInWindow.filter((r) => {
    const due = new Date(r.slaDueAt as string);
    const comparedAt = r.closedAt ? new Date(r.closedAt) : now;
    return comparedAt > due;
  });
  const breachRate =
    withSlaInWindow.length > 0 ? Math.round((breached.length / withSlaInWindow.length) * 100) : null;

  return { opened, closed, breachRate };
}

export function computeDsarTrend(rows: Row[]): DsarTrend {
  const now = new Date();
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(now.getDate() - 7);
  const startOfLastWeek = new Date(now);
  startOfLastWeek.setDate(now.getDate() - 14);

  return {
    thisWeek: windowStats(rows, startOfThisWeek, now, now),
    lastWeek: windowStats(rows, startOfLastWeek, startOfThisWeek, now),
  };
}
