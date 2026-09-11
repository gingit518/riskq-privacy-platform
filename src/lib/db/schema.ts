// Multi-tenant schema — Phase 1 (Regulatory Management only; see PRD §8).
//
// Design notes:
// - Every tenant-owned table carries org_id and every query in this app must
//   filter by it — see src/lib/auth/session.ts for how org_id gets into
//   request context. There is no row-level-security policy yet; that's a
//   Phase 1 hardening item, not done here (see README "Known gaps").
// - org_profiles is append-only (one row per save, never updated in place) so
//   "Applicable Regulations" stays effective-dated per PRD §5.1: a scope
//   snapshot always points at the exact profile version that produced it.
// - regulation_sets snapshots REGS *metadata* (not the test predicates —
//   those are code, see regulations/metadata.ts) so a content edit is
//   traceable even though logic changes still require a deploy.

import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  jsonb,
  timestamp,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "contributor", "viewer"]);

export const orgs = pgTable("orgs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  slugIdx: uniqueIndex("orgs_slug_idx").on(table.slug),
}));

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("admin"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  emailIdx: uniqueIndex("users_email_idx").on(table.email),
}));

// Append-only: a new row per save, never mutated. See design note above.
export const orgProfiles = pgTable("org_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  revenue: numeric("revenue", { precision: 14, scale: 2 }).notNull().default("0"),
  employees: integer("employees").notNull().default(0),
  consumers: integer("consumers").notNull().default(0),
  dataSale: numeric("data_sale", { precision: 5, scale: 2 }).notNull().default("0"),
  industry: text("industry").notNull().default(""),
  states: jsonb("states").$type<string[]>().notNull().default([]),
  intl: jsonb("intl").$type<string[]>().notNull().default([]),
  vendorCountries: jsonb("vendor_countries").$type<string[]>().notNull().default([]),
  dataTypes: jsonb("data_types").$type<string[]>().notNull().default([]),
  aiRoles: jsonb("ai_roles").$type<string[]>().notNull().default([]),
  marketingChannels: jsonb("marketing_channels").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// A versioned snapshot of the regulation library's *metadata* (not logic).
// See regulations/metadata.ts for what "metadata" excludes and why.
export const regulationSets = pgTable("regulation_sets", {
  id: uuid("id").primaryKey().defaultRandom(),
  versionLabel: text("version_label").notNull(),
  metadata: jsonb("metadata").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  versionIdx: uniqueIndex("regulation_sets_version_idx").on(table.versionLabel),
}));

// One row per "Analyze Scope" run — the versioned, effective-dated
// "Applicable Regulations" list per tenant that PRD §5.1 calls the single
// input every other module (Business Obligations, DSAR, Cyber Controls,
// Assessments, International Transfers, Tracking Technologies) reads from.
export const orgRegulationScope = pgTable("org_regulation_scope", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  orgProfileId: uuid("org_profile_id").notNull().references(() => orgProfiles.id),
  regulationSetId: uuid("regulation_set_id").notNull().references(() => regulationSets.id),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  // Array of { acronym, group, inScope, watch, tests: [{label, req, compVal, passed}] }
  // — a serializable projection of AnalysisSummary.results, not the live
  // Regulation objects (which carry non-serializable `pass` functions).
  results: jsonb("results").notNull(),
});

// ---------------------------------------------------------------------------
// Phase 2 (PRD §8) — Business Obligations (§5.2) and Cyber Controls (§5.4).
// Both read their applicability from org_regulation_scope (the single input
// every module derives from, per §5.1) but never delete rows when a
// regulation drops out of scope on a later "Analyze" run — obligations and
// control-implementation history are audit trail (§5.2/§5.4), not a live
// cache. The UI is responsible for flagging "no longer in scope" rather than
// the schema silently losing the row.
// ---------------------------------------------------------------------------

export const obligationStatusEnum = pgEnum("obligation_status", [
  "not_started",
  "in_progress",
  "done",
  "not_applicable",
]);

// One row per (org, regulation acronym, obligation text) triple, synced from
// the `obls` string array already present on each REGS entry (see
// regulations/types.ts Regulation.obls) — no separate obligation content
// needed since the ported regulation data already carries it. Synced, never
// regenerated: re-running sync only inserts obligations for newly-in-scope
// regulations and never touches an existing row's status/owner/notes.
export const orgObligations = pgTable("org_obligations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  regulationAcronym: text("regulation_acronym").notNull(),
  regulationName: text("regulation_name").notNull(),
  obligationText: text("obligation_text").notNull(),
  status: obligationStatusEnum("status").notNull().default("not_started"),
  owner: text("owner").notNull().default(""),
  dueDate: timestamp("due_date", { withTimezone: true }),
  evidenceNote: text("evidence_note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  dedupeIdx: uniqueIndex("org_obligations_dedupe_idx").on(
    table.orgId,
    table.regulationAcronym,
    table.obligationText
  ),
}));

export const controlStatusEnum = pgEnum("control_status", [
  "not_implemented",
  "partial",
  "implemented",
]);

// Global reference library (not tenant-scoped) — analogous to regulation_sets:
// a versioned content snapshot, seeded on first use rather than requiring a
// separate seed step (see controls/actions.ts). See README / PRD Appendix A
// for the explicit caveat that the seeded content (NIST CSF 2.0 taxonomy plus
// an indicative regulation-group tag) is a starting scaffold, NOT a
// legally-reviewed control-to-regulation mapping — same category of gap as
// the regulation library's own pending legal review (PRD §9 item 3).
export const controlsLibrary = pgTable("controls_library", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull(), // e.g. "CSF.PR.DS" — stable across reseeds
  framework: text("framework").notNull(), // e.g. "NIST CSF 2.0"
  function: text("function").notNull(), // e.g. "Protect"
  category: text("category").notNull(), // e.g. "Data Security"
  description: text("description").notNull(),
  regulationGroupsTag: jsonb("regulation_groups_tag").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  codeIdx: uniqueIndex("controls_library_code_idx").on(table.code),
}));

// Per-org implementation status against the global library — this is the
// tenant-scoped half of Cyber Controls (§5.4: "Status tracking, evidence
// upload, testing cadence").
export const orgControls = pgTable("org_controls", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  controlId: uuid("control_id").notNull().references(() => controlsLibrary.id),
  status: controlStatusEnum("status").notNull().default("not_implemented"),
  evidenceNote: text("evidence_note").notNull().default(""),
  lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  dedupeIdx: uniqueIndex("org_controls_dedupe_idx").on(table.orgId, table.controlId),
}));
