// Shared DsarStatus -> Badge variant mapping (PRD §5.12 Batch 5). Extracted
// so the DSAR list page and the request detail page can't drift from each
// other on what each status color means.
import type { BadgeVariant } from "@/components/Badge";
import type { DsarStatus } from "./types";

export const DSAR_STATUS_BADGE: Record<DsarStatus, BadgeVariant> = {
  intake: "neutral",
  verifying: "warning",
  in_progress: "warning",
  completed: "success",
  denied: "danger",
};
