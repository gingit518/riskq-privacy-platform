// Strips the executable `pass` predicates from REGS so the remaining content
// (jurisdiction, penalties, timelines, obligations, test labels) can be stored
// as plain JSON in the `regulation_sets` table for versioning/audit — see
// PRD-Privacy-Application.md §6 ("a maintained dataset... not hardcoded logic
// scattered through the app"). The predicates themselves are not data and
// can't be snapshotted this way; changing scoping *logic* still requires a
// code change and redeploy. Changing scoping *content* (penalty text, a
// timeline, an obligation label) is what this snapshot is for.

import { REGS } from "./data";
import type { RegulationMetadata } from "./types";

export function regsToMetadata(): RegulationMetadata[] {
  return REGS.map((reg) => ({
    ...reg,
    tests: reg.tests.map(({ pass, ...rest }) => rest),
  }));
}

/** A simple content hash so we can tell if REGS changed since the last seed,
 * without pulling in a hashing library — good enough for a version label,
 * not a security control. */
export function regsVersionLabel(): string {
  const json = JSON.stringify(regsToMetadata());
  let hash = 0;
  for (let i = 0; i < json.length; i++) {
    hash = (hash * 31 + json.charCodeAt(i)) | 0;
  }
  return `v${REGS.length}-${(hash >>> 0).toString(16)}`;
}
