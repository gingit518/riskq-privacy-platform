export type DsarRequestType =
  | "access"
  | "deletion"
  | "correction"
  | "portability"
  | "opt_out";

export const DSAR_REQUEST_TYPES: DsarRequestType[] = [
  "access",
  "deletion",
  "correction",
  "portability",
  "opt_out",
];

export const DSAR_REQUEST_TYPE_LABELS: Record<DsarRequestType, string> = {
  access: "Access",
  deletion: "Deletion",
  correction: "Correction",
  portability: "Portability",
  opt_out: "Opt-out of sale/sharing",
};

export type DsarStatus =
  | "intake"
  | "verifying"
  | "in_progress"
  | "completed"
  | "denied";

export const DSAR_STATUSES: DsarStatus[] = [
  "intake",
  "verifying",
  "in_progress",
  "completed",
  "denied",
];

export const DSAR_STATUS_LABELS: Record<DsarStatus, string> = {
  intake: "Intake",
  verifying: "Verifying identity",
  in_progress: "In progress",
  completed: "Completed",
  denied: "Denied",
};
