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

// Actual evidence FILES (not just a text note) for audit purposes — added
// after Ariel flagged that §5.2/§5.4's "evidence attachment/upload" wasn't
// really satisfied by a free-text notes field. Stored in Vercel Blob (per
// PRD §6's original architecture note); this table is just the metadata +
// pointer. Deliberately append-only / no delete action exposed in the UI —
// same audit-trail philosophy as org_obligations and org_profiles: an
// auditor needs to see everything that was ever uploaded, not just the
// current state. Exactly one of obligationId/controlId/dsarRequestId should
// be set; this isn't a DB-level CHECK constraint (kept simple given the
// current Drizzle Kit version in use), just an application-level rule
// enforced in evidence.ts — flagging so a future direct-DB write doesn't
// violate it silently.
//
// controlId points at controls_library.id, NOT org_controls.id: an
// org_controls row is only created lazily on first status save (see
// updateControlStatus in controls/actions.ts), but you should be able to
// attach evidence to a control before ever touching its status. orgId still
// scopes the row to a tenant.
//
// dsarRequestId (Phase 3.1 fulfillment automation, 2026-09-12) rows use
// PRIVATE Blob storage instead of PUBLIC like the obligation/control case
// above — see the isPrivate column below. DSAR export files are compiled
// data destined to leave the org via the requester's response link, so they
// get the stricter posture; obligation/control evidence never leaves the
// app.
// ---------------------------------------------------------------------------
// Phase 3 (PRD §8) — Data Subject Access Rights / DSAR (§5.3).
//
// SLA derivation lives in src/lib/dsar/sla.ts, not here — governingRegulation
// + slaDays + slaDueAt are computed once at request creation from the org's
// current in-scope regulations (shortest parseable response window wins per
// Ariel's 2026-09-11 call) and then stored as a snapshot, same
// audit-trail-over-live-recompute philosophy as org_obligations/
// evidence_files: a later "Analyze scope" run or REGS content edit must
// never retroactively change a due date on an already-open request.
// ---------------------------------------------------------------------------

export const dsarRequestTypeEnum = pgEnum("dsar_request_type", [
  "access",
  "deletion",
  "correction",
  "portability",
  "opt_out",
]);

export const dsarStatusEnum = pgEnum("dsar_status", [
  "intake",
  "verifying",
  "in_progress",
  "completed",
  "denied",
]);

export const dsarRequests = pgTable("dsar_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  requesterName: text("requester_name").notNull(),
  requesterEmail: text("requester_email").notNull(),
  requestType: dsarRequestTypeEnum("request_type").notNull(),
  status: dsarStatusEnum("status").notNull().default("intake"),
  // Snapshot of the governing regulation at creation time — see comment
  // above. Null slaDays/slaDueAt means no in-scope regulation had a
  // parseable response window (still tracked, no enforced deadline).
  governingRegulationAcronym: text("governing_regulation_acronym"),
  governingRegulationName: text("governing_regulation_name"),
  slaDays: integer("sla_days"),
  slaIsBusinessDays: boolean("sla_is_business_days").notNull().default(false),
  slaDueAt: timestamp("sla_due_at", { withTimezone: true }),
  identityVerified: boolean("identity_verified").notNull().default(false),
  identityVerifiedAt: timestamp("identity_verified_at", { withTimezone: true }),
  identityVerifiedBy: uuid("identity_verified_by").references(() => users.id),
  owner: text("owner").notNull().default(""),
  notes: text("notes").notNull().default(""),
  // "public" (submitted via the unauthenticated /intake/[slug] form) or
  // "internal" (staff manual entry) — both write to this same table.
  source: text("source").notNull().default("internal"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

// Append-only audit trail — every status change and material action on a
// request, timestamped. actorId is null for the initial "created" event on a
// publicly-submitted request (no authenticated user performed it).
export const dsarEvents = pgTable("dsar_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id").notNull().references(() => dsarRequests.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  detail: text("detail").notNull().default(""),
  actorId: uuid("actor_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Per-org, per-request-type checklist definitions — configurable from day
// one (Ariel's explicit call, 2026-09-11), unlike Cyber Controls' fixed
// global NIST seed. Self-seeded with DEFAULT_CHECKLIST_ITEMS the first time
// an org touches a given request type; editable after that via
// dsar/checklist actions. sortOrder is a plain integer, no reordering UI in
// V1 — new items append at the end.
export const dsarChecklistTemplates = pgTable("dsar_checklist_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  requestType: dsarRequestTypeEnum("request_type").notNull(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// A per-request SNAPSHOT of the template at the time the request was
// created — editing the template later must never retroactively change the
// checklist on an already-open request, same audit-trail principle as
// everything else in this schema.
export const dsarChecklistItems = pgTable("dsar_checklist_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id").notNull().references(() => dsarRequests.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  done: boolean("done").notNull().default(false),
  doneAt: timestamp("done_at", { withTimezone: true }),
  doneBy: uuid("done_by").references(() => users.id),
});

export const evidenceFiles = pgTable("evidence_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  obligationId: uuid("obligation_id").references(() => orgObligations.id, { onDelete: "cascade" }),
  controlId: uuid("control_id").references(() => controlsLibrary.id),
  dsarRequestId: uuid("dsar_request_id").references(() => dsarRequests.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  // blobUrl is the Vercel Blob pathname/URL either way. For DSAR rows
  // (isPrivate = true) it is NOT directly fetchable by a browser — reading
  // it requires the server's BLOB_READ_WRITE_TOKEN via @vercel/blob's
  // get(), which is exactly what /dsar/download/[token] does after
  // validating the token. Obligation/control rows keep isPrivate = false
  // (public blob, as before) since that evidence never leaves the app.
  blobUrl: text("blob_url").notNull(),
  isPrivate: boolean("is_private").notNull().default(false),
  contentType: text("content_type").notNull().default("application/octet-stream"),
  sizeBytes: integer("size_bytes").notNull().default(0),
  uploadedBy: uuid("uploaded_by").notNull().references(() => users.id),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Phase 3.1 (2026-09-12) — DSAR fulfillment automation, per Ariel's checklist
// review of the default `access` template (checklist-defaults.ts). Adds the
// pieces that turn "locate systems / review legal holds / send response"
// from bare checkboxes into tracked, assignable, auditable actions. See
// README "Phase 3.1" section for what is and isn't automated and why.
// ---------------------------------------------------------------------------

// Org-maintained registry of systems that may hold personal data, each with
// an owner to notify. Not tenant content synced from anywhere (unlike
// controls_library) — every org's stack is different, so this is manual
// setup, once, per org (see /dsar/systems). `active` lets an org retire a
// system without losing the historical fan-out tasks that already reference
// it (see dsar_system_tasks' snapshot columns below).
export const dsarSystems = pgTable("dsar_systems", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  ownerName: text("owner_name").notNull().default(""),
  ownerEmail: text("owner_email").notNull().default(""),
  dataCategories: text("data_categories").notNull().default(""),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per (request, system-at-time-of-creation) — auto-fanned-out when a
// DSAR request is created (see createDsarRequest / fanOutSystemTasks), one
// per currently-active dsar_systems row. Snapshots systemName/ownerName/
// ownerEmail as plain text rather than joining live to dsar_systems, same
// audit-trail-over-live-recompute rule as everything else in this schema:
// editing or retiring a system later must never rewrite what an
// already-open request's task list says.
export const dsarSystemTasks = pgTable("dsar_system_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id").notNull().references(() => dsarRequests.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  systemName: text("system_name").notNull(),
  ownerName: text("owner_name").notNull().default(""),
  ownerEmail: text("owner_email").notNull().default(""),
  done: boolean("done").notNull().default(false),
  doneAt: timestamp("done_at", { withTimezone: true }),
  doneBy: uuid("done_by").references(() => users.id),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Org-maintained list of names/emails under an active legal hold or
// litigation matter. Checked live (not snapshotted) against a requester's
// email every time a DSAR detail page renders — deliberately NOT
// snapshotted at request creation like governingRegulation/checklist above,
// because a hold can be placed AFTER intake but before the response goes
// out, and a stale snapshot would miss that. Informational flag only; it
// does not block any action — the review is still a human legal judgment
// call (see README Known Gaps).
export const legalHolds = pgTable("legal_holds", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  subjectName: text("subject_name").notNull().default(""),
  subjectEmail: text("subject_email").notNull(),
  matter: text("matter").notNull().default(""),
  active: boolean("active").notNull().default(true),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Short-lived tokens that gate the public /dsar/download/[token] page sent
// to a requester by email. The token+expiry is the actual access control —
// the underlying files are PRIVATE Vercel blobs (see evidence_files.isPrivate
// above), so knowing this token is the only way to read them; there is no
// separately-guessable public blob URL to leak. Not single-use (a requester
// may need to re-open the email and re-download) — expiry alone is the
// control. No delete/rotate UI in V1; an org that needs to revoke early
// would do it by hand in the DB, which is a known gap, not silently ignored.
export const dsarDownloadTokens = pgTable("dsar_download_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id").notNull().references(() => dsarRequests.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tokenIdx: uniqueIndex("dsar_download_tokens_token_idx").on(table.token),
}));
