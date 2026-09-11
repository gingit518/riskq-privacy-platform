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
