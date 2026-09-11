// Types for the Regulatory Management scoping engine.
//
// This mirrors the company-profile shape used by the original single-page tool
// (gingit518/riskq-regulation-lookup) so the ported REGS/evalReg logic below
// needs no adaptation beyond typing. See PRD §5.1 in the Privacy Development
// project for the source app this was ported from.

export type Industry =
  | "healthcare"
  | "financial"
  | "insurance"
  | "education"
  | "defense"
  | "retail"
  | "tech"
  | "telecom"
  | "media"
  | "energy"
  | "water"
  | "transportation"
  | "chemical"
  | "manufacturing"
  | "foodag"
  | "commercial"
  | "emergency"
  | "dams"
  | "nuclear"
  | "government"
  | "other"
  | "";

export interface CompanyProfile {
  name: string;
  revenue: number; // USD millions
  employees: number;
  consumers: number;
  dataSale: number; // percent, 0-100
  industry: Industry;
  states: string[]; // 2-letter codes, or "ALL"
  intl: string[]; // international jurisdiction codes
  vendorCountries: string[]; // "countries of concern" ties (vendor/investor/employment)
  dataTypes: string[];
  aiRoles: string[];
  marketingChannels: string[];
}

export type TestLogic =
  | "always"
  | "AND"
  | "OR"
  | "state_AND_threshold"
  | "state_AND_revenue_AND_threshold";

export type TestType =
  | "revenue"
  | "employees"
  | "consumers"
  | "consumers_ds"
  | "datasale"
  | "industry"
  | "state"
  | "country"
  | "vendor_country"
  | "ai_role"
  | "marketing_channel"
  | "datatype"
  | "always";

export interface RegTest {
  type: TestType;
  label: string;
  req?: string;
  reqNum?: number;
  pass: (co: CompanyProfile) => boolean;
}

export interface Regulation {
  group: "US Federal" | "US State" | "International";
  acronym: string;
  name: string;
  jur: string;
  penalties: string;
  notif: string; // breach notification timeline
  resp: string; // consumer response timeline
  cure: string; // cure period
  obls: string[]; // key obligations
  logic: TestLogic;
  tests: RegTest[];
}

export interface EvaluatedTest extends RegTest {
  passed: boolean;
  compVal: string;
}

export interface RegulationResult {
  reg: Regulation;
  inScope: boolean;
  watch: boolean;
  tests: EvaluatedTest[];
}

// Metadata-only snapshot of a Regulation — everything except the executable
// `pass` predicates, which cannot be persisted as data (see engine.ts and
// README "Why the regulation set isn't fully data-driven").
export type RegulationMetadata = Omit<Regulation, "tests"> & {
  tests: Array<Omit<RegTest, "pass">>;
};
