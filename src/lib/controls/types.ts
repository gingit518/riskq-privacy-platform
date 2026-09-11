// Types for the Cyber Controls seed library (PRD §5.4, Phase 2).
//
// IMPORTANT CAVEAT (see also README and PRD Appendix A): the seeded content
// in ./data.ts is NIST CSF 2.0's public Function/Category taxonomy, which is
// stable and well-documented — but the `regulationGroupsTag` field on each
// entry is my own rough, non-legally-reviewed indication of which broad
// regulation groups commonly care about that category (e.g. "data security
// controls are relevant wherever a breach-notification law applies"). It is
// NOT a verified control-to-regulation compliance mapping. Treat it the same
// way as the regulation library's own pending legal review (PRD §9 item 3):
// usable to prioritize a build, not to make a real compliance claim to a
// customer without a subject-matter/legal review pass first.

export type ControlFunction =
  | "Govern"
  | "Identify"
  | "Protect"
  | "Detect"
  | "Respond"
  | "Recover";

export interface ControlDefinition {
  code: string; // e.g. "PR.DS" — stable NIST CSF 2.0 category code
  framework: "NIST CSF 2.0";
  function: ControlFunction;
  category: string; // e.g. "Data Security"
  description: string;
  regulationGroupsTag: Array<"US Federal" | "US State" | "International">;
}
