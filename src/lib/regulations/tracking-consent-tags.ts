// Curated "does this regulation require cookie/tracker consent" tag (PRD
// §5.6, Phase 5, 2026-09-12) — same pattern and same caveat as Cyber
// Controls' `regulationGroupsTag` (src/lib/controls/data.ts): my own
// indicative judgment call, NOT a legally-reviewed determination, kept as a
// small separate lookup rather than hand-editing the ported REGS array in
// regulations/data.ts (that file's own header explicitly warns against
// casual edits). Deliberately keyed by acronym rather than folded into
// `Regulation` so re-porting REGS from the source tool never silently drops
// this tag.
//
// Included: comprehensive general-purpose consumer/data-protection privacy
// laws (the ones that grant an opt-out-of-sale/targeted-advertising right,
// or are otherwise the canonical "cookie law" in their jurisdiction) plus
// COPPA (covers persistent identifiers/tracking of children online).
// Excluded: sectoral/security-only regimes (HIPAA, GLBA, FERPA, PCI-DSS,
// CMMC, FISMA, CIRCIA, NERC CIP, SEC Cyber, FCC, FedRAMP, FTC HBNR, NY DFS
// 500, NY Shield, NIAC, Ohio Safe Harbor, DSL/CSL China, DORA, NIS2, EU
// AI Act variants, EU DSA, ADA Title III, TCPA, BIPA, GIPA, MHMDA, FTC Act,
// DSP Bulk Data Rule) — none of these turn on cookie/tracker consent
// specifically, whatever else they require.
export const TRACKING_CONSENT_ACRONYMS: ReadonlySet<string> = new Set([
  // US Federal
  "COPPA",
  // US State comprehensive consumer privacy acts (all carry an
  // opt-out-of-sale/-sharing/-targeted-advertising right)
  "CCPA",
  "CPRA",
  "CPA",
  "VCPDA",
  "CTDPA",
  "UCPA",
  "ICDPA",
  "MCDPA",
  "OCPA",
  "TDPSA",
  "NJDPA",
  "NHPA",
  "NDPA",
  "MNCDPA",
  "MODPA",
  "TIPA",
  "INCDPA",
  "KCDPA",
  "RIDTPPA",
  "DPDPA", // Delaware Personal Data Privacy Act — not to be confused with "DPDPA (India)" below
  // International — comprehensive privacy/data-protection laws with a
  // consent-based (or opt-out) lawful-basis regime covering tracking
  "GDPR",
  "UK DPA",
  "PIPEDA",
  "Law 25 (Quebec)",
  "PIPA (BC)",
  "PIPA (Alberta)",
  "LGPD",
  "APPI",
  "PIPL",
  "PIPA", // South Korea
  "PDPA", // Singapore
  "Privacy Act (AU)",
  "DPDPA (India)",
  "PDPA (Thailand)",
  "Privacy Act (NZ)",
  "POPIA",
  "PDPA (Malaysia)",
  "nFADP",
]);

export function regulationRequiresTrackingConsent(acronym: string): boolean {
  return TRACKING_CONSENT_ACRONYMS.has(acronym);
}
