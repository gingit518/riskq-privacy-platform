// Status-bucket mapping for the Management Summary View (PRD §5.11, added
// 2026-09-16). Every module with a real status field maps onto one of three
// buckets so they can be compared side by side. Ariel's explicit call
// (2026-09-16): RoPA processing activities and Tracking Technology entries
// have no status field at all today, so they're deliberately NOT bucketed
// here — the summary page shows them as plain inventory counts instead of
// inventing a completeness definition that doesn't exist in the schema.

export type StatusBucket = "complete" | "in_flight" | "not_started";

export interface BucketCounts {
  complete: number;
  inFlight: number;
  notStarted: number;
  /** Counted separately, never folded into the three buckets above — an
   * excluded row (e.g. "not applicable") isn't pending work and isn't done
   * work either; showing it as either would misstate the program's status. */
  excluded: number;
}

function emptyCounts(): BucketCounts {
  return { complete: 0, inFlight: 0, notStarted: 0, excluded: 0 };
}

function tally(counts: BucketCounts, bucket: StatusBucket | "excluded"): void {
  if (bucket === "complete") counts.complete++;
  else if (bucket === "in_flight") counts.inFlight++;
  else if (bucket === "not_started") counts.notStarted++;
  else counts.excluded++;
}

export function obligationBucket(
  status: "not_started" | "in_progress" | "done" | "not_applicable"
): StatusBucket | "excluded" {
  if (status === "done") return "complete";
  if (status === "in_progress") return "in_flight";
  if (status === "not_applicable") return "excluded";
  return "not_started";
}

export function controlBucket(
  status: "not_implemented" | "partial" | "implemented"
): StatusBucket {
  if (status === "implemented") return "complete";
  if (status === "partial") return "in_flight";
  return "not_started";
}

// DSAR has five statuses, not three — "denied" is a terminal/closed outcome
// like "completed", just not a successful one. Both count as "complete"
// here (the request is resolved, nothing is pending on it), matching how
// /dsar's own closedAt logic already treats them (see dsar/actions.ts
// isClosing). This is a judgment call, flagged rather than silently
// asserted: if Ariel wants "denied" broken out as its own bucket later,
// that's a small change here, not a redesign.
export function dsarBucket(
  status: "intake" | "verifying" | "in_progress" | "completed" | "denied"
): StatusBucket {
  if (status === "completed" || status === "denied") return "complete";
  if (status === "intake") return "not_started";
  return "in_flight";
}

export function dpiaBucket(status: "draft" | "completed" | null): StatusBucket {
  if (status === "completed") return "complete";
  if (status === "draft") return "in_flight";
  return "not_started"; // no DPIA row at all yet
}

export function tiaBucket(
  status: "not_started" | "in_progress" | "complete" | "not_required"
): StatusBucket | "excluded" {
  if (status === "complete") return "complete";
  if (status === "in_progress") return "in_flight";
  if (status === "not_required") return "excluded";
  return "not_started";
}

export function countObligationBuckets(
  rows: Array<{ status: "not_started" | "in_progress" | "done" | "not_applicable" }>
): BucketCounts {
  const counts = emptyCounts();
  for (const r of rows) tally(counts, obligationBucket(r.status));
  return counts;
}

export function countControlBuckets(
  rows: Array<{ status: "not_implemented" | "partial" | "implemented" }>
): BucketCounts {
  const counts = emptyCounts();
  for (const r of rows) tally(counts, controlBucket(r.status));
  return counts;
}

export function countDsarBuckets(
  rows: Array<{ status: "intake" | "verifying" | "in_progress" | "completed" | "denied" }>
): BucketCounts {
  const counts = emptyCounts();
  for (const r of rows) tally(counts, dsarBucket(r.status));
  return counts;
}

export function countDpiaBuckets(
  activityCount: number,
  dpiaStatuses: Array<"draft" | "completed">
): BucketCounts {
  // One row per processing activity: activities with no DPIA row are
  // "not_started", not just absent from the count.
  const counts = emptyCounts();
  for (const s of dpiaStatuses) tally(counts, dpiaBucket(s));
  counts.notStarted += activityCount - dpiaStatuses.length;
  return counts;
}

export function countTiaBuckets(
  rows: Array<{ tiaStatus: "not_started" | "in_progress" | "complete" | "not_required" }>
): BucketCounts {
  const counts = emptyCounts();
  for (const r of rows) tally(counts, tiaBucket(r.tiaStatus));
  return counts;
}
