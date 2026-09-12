export const TRACKING_CATEGORIES = [
  "strictly_necessary",
  "functional",
  "analytics",
  "advertising",
  "social_media",
  "other",
] as const;
export type TrackingCategory = (typeof TRACKING_CATEGORIES)[number];

export const TRACKING_CATEGORY_LABELS: Record<TrackingCategory, string> = {
  strictly_necessary: "Strictly necessary",
  functional: "Functional",
  analytics: "Analytics",
  advertising: "Advertising",
  social_media: "Social media",
  other: "Other",
};

export const TRACKING_PARTIES = ["first_party", "third_party"] as const;
export type TrackingParty = (typeof TRACKING_PARTIES)[number];

export const TRACKING_PARTY_LABELS: Record<TrackingParty, string> = {
  first_party: "First-party",
  third_party: "Third-party",
};
