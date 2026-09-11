// Scoping engine — ported verbatim (logic unchanged) from `evalReg()` in
// gingit518/riskq-regulation-lookup, public/index.html, reviewed 2026-09-10.
//
// This is the "mapping engine" the PRD calls out as needing to be deterministic
// and auditable rather than an LLM guess (§5.1). It is a pure function: same
// profile + same REGS in → same result out, and every pass/fail is explainable
// via the returned `tests` array. Do not introduce any AI call into this file.

import { REGS } from "./data";
import type {
  CompanyProfile,
  EvaluatedTest,
  Regulation,
  RegulationResult,
} from "./types";

function formatCompVal(t: { type: string }, co: CompanyProfile): string {
  switch (t.type) {
    case "revenue":
      return "$" + co.revenue + "M";
    case "employees":
      return fmtN(co.employees) + " employees";
    case "consumers":
    case "consumers_ds":
      return fmtN(co.consumers);
    case "datasale":
      return co.dataSale + "%";
    case "industry":
      return co.industry || "(not set)";
    case "state":
      return co.states.join(", ") || "(none)";
    case "country":
      return co.intl.join(", ") || "(none)";
    case "vendor_country":
      return (co.vendorCountries || []).join(", ") || "(none)";
    case "ai_role":
      return (co.aiRoles || []).join(", ") || "(none)";
    case "marketing_channel":
      return (co.marketingChannels || []).join(", ") || "(none)";
    case "datatype":
      return co.dataTypes.join(", ") || "(none)";
    default:
      return "Yes";
  }
}

export function fmtN(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return String(n);
}

export function evalReg(reg: Regulation, co: CompanyProfile): RegulationResult {
  const logic = reg.logic;
  const tested: EvaluatedTest[] = reg.tests.map((t) => {
    const passed = t.pass(co);
    const compVal = formatCompVal(t, co);
    return { ...t, passed, compVal };
  });

  let inScope = false;
  if (logic === "always") inScope = true;
  else if (logic === "OR") inScope = tested.some((t) => t.passed);
  else if (logic === "AND") inScope = tested.every((t) => t.passed);
  else if (logic === "state_AND_threshold") {
    const stPass = tested.find((t) => t.type === "state")?.passed ?? false;
    const thPass = tested.filter((t) => t.type !== "state").some((t) => t.passed);
    inScope = stPass && thPass;
  } else if (logic === "state_AND_revenue_AND_threshold") {
    const stPass = tested.find((t) => t.type === "state")?.passed ?? false;
    const revPass = tested.find((t) => t.type === "revenue")?.passed ?? false;
    const thPass = tested
      .filter((t) => t.type !== "state" && t.type !== "revenue")
      .some((t) => t.passed);
    inScope = stPass && revPass && thPass;
  }

  let watch = false;
  if (!inScope) {
    if (logic === "state_AND_threshold") {
      watch = tested.find((t) => t.type === "state")?.passed ?? false;
    }
    if (logic === "state_AND_revenue_AND_threshold") {
      watch =
        (tested.find((t) => t.type === "state")?.passed ?? false) &&
        (tested.find((t) => t.type === "revenue")?.passed ?? false);
    }
    if (!watch) {
      tested.forEach((t) => {
        if (t.reqNum && !t.passed) {
          if (t.type === "revenue" && co.revenue >= t.reqNum * 0.5) watch = true;
          if (t.type === "employees" && co.employees >= t.reqNum * 0.5) watch = true;
          if (
            (t.type === "consumers" || t.type === "consumers_ds") &&
            co.consumers >= t.reqNum * 0.5
          )
            watch = true;
        }
      });
    }
  }

  return { reg, inScope, watch: !inScope && watch, tests: tested };
}

export interface AnalysisSummary {
  results: RegulationResult[];
  inScope: RegulationResult[];
  watch: RegulationResult[];
  outOfScope: RegulationResult[];
  totalChecked: number;
}

/** Run every regulation in the library against one company profile. */
export function analyzeCompany(co: CompanyProfile): AnalysisSummary {
  const results = REGS.map((reg) => evalReg(reg, co));
  return {
    results,
    inScope: results.filter((r) => r.inScope),
    watch: results.filter((r) => r.watch),
    outOfScope: results.filter((r) => !r.inScope && !r.watch),
    totalChecked: results.length,
  };
}
