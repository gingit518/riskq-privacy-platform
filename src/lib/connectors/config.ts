// Phase 7 shared constants. Kept in one place so the "no job queue" scale
// constraint (README) has exactly one number to change, not one buried in
// each connector.

// Hard cap on matches accepted per connector per run. A search that would
// return more than this is truncated and flagged (see fulfillment.ts) rather
// than silently processed in full — this app has no background job queue,
// so a run has to complete inside one synchronous Vercel function
// invocation.
export const MAX_RECORDS_PER_RUN = 25;
