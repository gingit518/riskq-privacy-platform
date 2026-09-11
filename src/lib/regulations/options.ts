// Form option lists — ported verbatim from the <select> elements in
// gingit518/riskq-regulation-lookup, public/index.html. Values must match
// exactly what data.ts's `pass` predicates check for (e.g. c.industry ===
// 'healthcare', c.intl.includes('EU')) — do not rename or reorder casually.

export const INDUSTRY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Select industry…" },
  { value: "healthcare", label: "Healthcare / Health Insurance" },
  { value: "financial", label: "Financial Services / Banking" },
  { value: "insurance", label: "Insurance" },
  { value: "education", label: "Education" },
  { value: "defense", label: "Defense / Government Contractor" },
  { value: "retail", label: "Retail / E-commerce" },
  { value: "tech", label: "Technology / SaaS" },
  { value: "telecom", label: "Telecommunications" },
  { value: "media", label: "Media / Advertising" },
  { value: "energy", label: "Energy / Utilities" },
  { value: "water", label: "Water / Wastewater" },
  { value: "transportation", label: "Transportation" },
  { value: "chemical", label: "Chemical" },
  { value: "manufacturing", label: "Critical Manufacturing" },
  { value: "foodag", label: "Food & Agriculture" },
  { value: "commercial", label: "Commercial Facilities" },
  { value: "emergency", label: "Emergency Services" },
  { value: "dams", label: "Dams" },
  { value: "nuclear", label: "Nuclear" },
  { value: "government", label: "Government Facilities" },
  { value: "other", label: "Other" },
];

export const US_STATE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "ALL", label: "All States / National" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "VA", label: "Virginia" },
  { value: "NY", label: "New York" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "MA", label: "Massachusetts" },
  { value: "OH", label: "Ohio" },
  { value: "IN", label: "Indiana" },
  { value: "AL", label: "Alabama" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MI", label: "Michigan" },
  { value: "MS", label: "Mississippi" },
  { value: "ND", label: "North Dakota" },
  { value: "NH", label: "New Hampshire" },
  { value: "SC", label: "South Carolina" },
  { value: "TX", label: "Texas" },
  { value: "FL", label: "Florida" },
  { value: "MT", label: "Montana" },
  { value: "OR", label: "Oregon" },
  { value: "TN", label: "Tennessee" },
  { value: "UT", label: "Utah" },
  { value: "IA", label: "Iowa" },
  { value: "NJ", label: "New Jersey" },
  { value: "NE", label: "Nebraska" },
  { value: "MN", label: "Minnesota" },
  { value: "MD", label: "Maryland" },
  { value: "KY", label: "Kentucky" },
  { value: "RI", label: "Rhode Island" },
  { value: "IL", label: "Illinois" },
  { value: "WA", label: "Washington" },
];

export const INTL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "EU", label: "EU / EEA" },
  { value: "UK", label: "United Kingdom" },
  { value: "Canada", label: "Canada (federal / other provinces)" },
  { value: "CanadaQuebec", label: "Canada — Quebec" },
  { value: "CanadaBC", label: "Canada — British Columbia" },
  { value: "CanadaAlberta", label: "Canada — Alberta" },
  { value: "Germany", label: "Germany" },
  { value: "Australia", label: "Australia" },
  { value: "Brazil", label: "Brazil" },
  { value: "India", label: "India" },
  { value: "Japan", label: "Japan" },
  { value: "China", label: "China" },
  { value: "SouthKorea", label: "South Korea" },
  { value: "Thailand", label: "Thailand" },
  { value: "NewZealand", label: "New Zealand" },
  { value: "Israel", label: "Israel" },
  { value: "Singapore", label: "Singapore" },
  { value: "Bahrain", label: "Bahrain" },
  { value: "Egypt", label: "Egypt" },
  { value: "Lebanon", label: "Lebanon" },
  { value: "Qatar", label: "Qatar" },
  { value: "QatarQFC", label: "Qatar (QFC)" },
  { value: "Turkey", label: "Turkey" },
  { value: "UAE", label: "United Arab Emirates" },
  { value: "DIFC", label: "UAE (DIFC)" },
  { value: "Ukraine", label: "Ukraine" },
  { value: "Argentina", label: "Argentina" },
  { value: "Chile", label: "Chile" },
  { value: "Colombia", label: "Colombia" },
  { value: "Mexico", label: "Mexico" },
  { value: "Uruguay", label: "Uruguay" },
  { value: "Malaysia", label: "Malaysia" },
  { value: "Nepal", label: "Nepal" },
  { value: "Vietnam", label: "Vietnam" },
  { value: "SouthAfrica", label: "South Africa" },
  { value: "Nigeria", label: "Nigeria" },
  { value: "Kenya", label: "Kenya" },
  { value: "Switzerland", label: "Switzerland" },
  { value: "SaudiArabia", label: "Saudi Arabia" },
];

export const VENDOR_COUNTRY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "China", label: "China (incl. Hong Kong, Macau)" },
  { value: "Russia", label: "Russia" },
  { value: "Iran", label: "Iran" },
  { value: "NorthKorea", label: "North Korea" },
  { value: "Cuba", label: "Cuba" },
  { value: "Venezuela", label: "Venezuela" },
];

export const DATA_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "PII", label: "PII (Personal Identifiable Info)" },
  { value: "PHI", label: "PHI (Health Information)" },
  { value: "Financial", label: "Financial / Account Data" },
  { value: "Student", label: "Student Records" },
  { value: "CardData", label: "Payment Card Data" },
  { value: "Employee", label: "Employee Data" },
  { value: "Sensitive", label: "Sensitive Personal Data" },
  { value: "Biometric", label: "Biometric Identifiers" },
  { value: "ChildrenU13", label: "Children's Data (under 13)" },
  { value: "Genetic", label: "Genetic Information" },
  { value: "CUI", label: "Controlled Unclassified Info" },
];

export const AI_ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  {
    value: "AIProhibited",
    label:
      "Prohibited practice (social scoring, manipulative/subliminal techniques, real-time public biometric ID for law enforcement, emotion inference in workplace/education)",
  },
  {
    value: "AIHighRisk",
    label:
      "Provider/deployer of a high-risk AI system (Annex III: HR/recruitment, credit scoring, biometric categorization, critical infrastructure, law enforcement, migration, education)",
  },
  {
    value: "AIGPAI",
    label: "Provider of a general-purpose AI model (foundation model) placed on the EU market",
  },
  {
    value: "AILimited",
    label:
      "Provider of a limited-risk AI system (chatbots, deepfakes, emotion recognition outside prohibited contexts) — transparency obligations only",
  },
];

export const MARKETING_CHANNEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "OutboundCalls", label: "Autodialed / prerecorded / live outbound calls" },
  { value: "SMS", label: "SMS / text message marketing" },
];
