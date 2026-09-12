export const TRANSFER_MECHANISMS = [
  "sccs",
  "adequacy_decision",
  "bcrs",
  "derogation",
  "none",
] as const;
export type TransferMechanism = (typeof TRANSFER_MECHANISMS)[number];

export const TRANSFER_MECHANISM_LABELS: Record<TransferMechanism, string> = {
  sccs: "Standard Contractual Clauses (SCCs)",
  adequacy_decision: "Adequacy decision",
  bcrs: "Binding Corporate Rules (BCRs)",
  derogation: "Derogation (Art. 49 / one-off)",
  none: "None in place",
};

export const TIA_STATUSES = ["not_started", "in_progress", "complete", "not_required"] as const;
export type TiaStatus = (typeof TIA_STATUSES)[number];

export const TIA_STATUS_LABELS: Record<TiaStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  complete: "Complete",
  not_required: "Not required",
};

export const DPIA_RISK_RATINGS = ["low", "medium", "high"] as const;
export type DpiaRiskRating = (typeof DPIA_RISK_RATINGS)[number];

export const DPIA_RISK_RATING_LABELS: Record<DpiaRiskRating, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const MATURITY_LEVELS = [
  "not_assessed",
  "initial",
  "developing",
  "defined",
  "managed",
  "optimized",
] as const;
export type MaturityLevel = (typeof MATURITY_LEVELS)[number];

export const MATURITY_LEVEL_LABELS: Record<MaturityLevel, string> = {
  not_assessed: "Not assessed",
  initial: "Initial (ad hoc)",
  developing: "Developing",
  defined: "Defined (documented)",
  managed: "Managed (measured)",
  optimized: "Optimized (continuously improved)",
};

// Numeric weight for averaging into a maturity score — not_assessed is
// excluded from averages entirely (see maturity.ts), not treated as 0.
export const MATURITY_LEVEL_SCORE: Record<MaturityLevel, number> = {
  not_assessed: 0,
  initial: 1,
  developing: 2,
  defined: 3,
  managed: 4,
  optimized: 5,
};
