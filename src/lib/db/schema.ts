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

// Readiness/maturity scoring (PRD §5.5, added Phase 4, 2026-09-12) — a
// deliberately separate dimension from `status` above: a control can be
// "implemented" but ad hoc/inconsistent (low maturity) or "partial" but
// well-governed where it does exist (higher maturity than status alone
// implies). Per Ariel's explicit call, this reuses the existing NIST CSF
// categories (controls_library) as the framework rather than authoring a
// second, unvetted maturity rubric — no new content to source or caveat.
export const maturityLevelEnum = pgEnum("maturity_level", [
  "not_assessed",
  "initial",
  "developing",
  "defined",
  "managed",
  "optimized",
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
  maturityLevel: maturityLevelEnum("maturity_level").notNull().default("not_assessed"),
  maturityNotes: text("maturity_notes").notNull().default(""),
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
  transferId: uuid("transfer_id").references(() => internationalTransfers.id, { onDelete: "cascade" }),
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

// ---------------------------------------------------------------------------
// Phase 4 (PRD §5.5/§5.7/§8) — Assessments (RoPA, DPIA, readiness/maturity)
// and International Transfers, built 2026-09-12. Per Ariel's explicit calls
// that day: DPIA content is a generic GDPR Art. 35-style template (flagged
// as a starting point, not legally reviewed — same caveat pattern as Cyber
// Controls' NIST tagging); maturity scoring reuses the existing NIST CSF
// categories (controls_library) rather than a new framework; and a
// processing activity's "systems involved" field reuses the DSAR Systems
// Register (dsar_systems) rather than a second, separately-maintained
// systems list. That reuse means dsar_systems is no longer DSAR-only
// despite its name — flagged in README rather than silently renaming a
// table that already has live data from the Phase 3.1 rollout.
// ---------------------------------------------------------------------------

// Records of Processing Activities (RoPA) — the PRD's own recommendation
// (§5.5) was to build this FIRST, before DPIA/Obligations/Transfers, as the
// shared object those modules reference. Business Obligations (Phase 2)
// already shipped without it, so this is new shared infrastructure for
// DPIA and International Transfers only, not a retrofit onto Obligations —
// flagged so that gap isn't assumed silently closed.
export const processingActivities = pgTable("processing_activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  purpose: text("purpose").notNull().default(""),
  dataCategories: jsonb("data_categories").$type<string[]>().notNull().default([]),
  dataSubjects: text("data_subjects").notNull().default(""),
  lawfulBasis: text("lawful_basis").notNull().default(""),
  retentionPeriod: text("retention_period").notNull().default(""),
  // Risk flags — PRD §5.5's explicit DPIA trigger criteria. Booleans, not a
  // computed score: whether these add up to "do a DPIA" is left to the
  // human reviewing the recommendation banner (see dpia.ts), not decided
  // silently by this schema.
  specialCategoryData: boolean("special_category_data").notNull().default(false),
  largeScaleProcessing: boolean("large_scale_processing").notNull().default(false),
  automatedDecisionMaking: boolean("automated_decision_making").notNull().default(false),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Many-to-many: which registered systems (dsar_systems — see header comment
// above on the reuse decision) hold data for this processing activity. A
// join table rather than a jsonb array of ids, consistent with how this
// schema always uses a real FK table for actual relationships (jsonb here
// is reserved for genuinely unstructured lists like org_profiles.states).
export const processingActivitySystems = pgTable("processing_activity_systems", {
  id: uuid("id").primaryKey().defaultRandom(),
  activityId: uuid("activity_id").notNull().references(() => processingActivities.id, { onDelete: "cascade" }),
  systemId: uuid("system_id").notNull().references(() => dsarSystems.id, { onDelete: "cascade" }),
}, (table) => ({
  dedupeIdx: uniqueIndex("processing_activity_systems_dedupe_idx").on(table.activityId, table.systemId),
}));

export const dpiaStatusEnum = pgEnum("dpia_status", ["draft", "completed"]);
export const dpiaRiskRatingEnum = pgEnum("dpia_risk_rating", ["low", "medium", "high"]);

// One DPIA per processing activity (V1 — not versioned/append-only like the
// rest of this schema; a DPIA is treated as a living document until marked
// "completed", not a point-in-time audit record). Question set is a static
// generic GDPR Art. 35-style template (src/lib/assessments/dpia-questions.ts),
// explicitly NOT legally reviewed — same unverified-content caveat as
// regulation_sets/controls_library elsewhere in this app (PRD §9 item 3).
export const dpiaAssessments = pgTable("dpia_assessments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  activityId: uuid("activity_id").notNull().references(() => processingActivities.id, { onDelete: "cascade" }),
  status: dpiaStatusEnum("status").notNull().default("draft"),
  // { [questionId]: answerText }, not a rigid column-per-question — the
  // question set (dpia-questions.ts) is expected to evolve and this avoids
  // a migration every time it does. Same modeling choice as
  // org_regulation_scope.results.
  answers: jsonb("answers").$type<Record<string, string>>().notNull().default({}),
  riskRating: dpiaRiskRatingEnum("risk_rating"),
  mitigations: text("mitigations").notNull().default(""),
  completedBy: uuid("completed_by").references(() => users.id),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  // One DPIA per activity in V1 — re-opening an existing one edits it in
  // place rather than creating a second row.
  activityIdx: uniqueIndex("dpia_assessments_activity_idx").on(table.activityId),
}));

export const transferMechanismEnum = pgEnum("transfer_mechanism", [
  "sccs",
  "adequacy_decision",
  "bcrs",
  "derogation",
  "none",
]);
export const tiaStatusEnum = pgEnum("tia_status", ["not_started", "in_progress", "complete", "not_required"]);

// International Transfers registry (PRD §5.7). Optionally linked to a
// processing activity (RoPA) per the PRD's design, but not required — an
// org may log a transfer before it's finished mapping every processing
// activity, and forcing the link would block that. mechanism = 'none' is
// the explicit "gap" state the PRD asks to alert on (see /transfers page),
// not an omitted field.
export const internationalTransfers = pgTable("international_transfers", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  activityId: uuid("activity_id").references(() => processingActivities.id, { onDelete: "set null" }),
  fromJurisdiction: text("from_jurisdiction").notNull(),
  toJurisdiction: text("to_jurisdiction").notNull(),
  mechanism: transferMechanismEnum("mechanism").notNull().default("none"),
  tiaStatus: tiaStatusEnum("tia_status").notNull().default("not_started"),
  notes: text("notes").notNull().default(""),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Phase 5 (PRD §5.6/§5.8/§8) — Tracking Technologies (manual registry) and
// Compliance Dashboard/Reporting, built 2026-09-12. Per Ariel's explicit
// calls that day: the registry's "tied to consent-requirement flags from
// Regulatory Management" language (§5.6) is satisfied by a curated,
// separately-maintained tag on which ported regulations require
// cookie/tracker consent (src/lib/regulations/tracking-consent-tags.ts) —
// same indicative-not-legally-reviewed caveat as Cyber Controls' regulation
// tags — surfaced as an informational banner on the registry page, not a
// per-entry auto-decision. The dashboard's "compliance score" is a simple
// unweighted % blend (obligations-done % + DSAR SLA-met % per regulation;
// controls-implemented % only at the jurisdiction-group level, since
// controls_library isn't tagged to specific regulation acronyms — see
// compliance/score.ts for why that's a real granularity gap, not an
// oversight). It is computed live on every page load, not persisted — no
// new "compliance_scores" table, consistent with how /assessments already
// aggregates other modules' tables live rather than caching a score.
// ---------------------------------------------------------------------------

export const trackingCategoryEnum = pgEnum("tracking_category", [
  "strictly_necessary",
  "functional",
  "analytics",
  "advertising",
  "social_media",
  "other",
]);
export const trackingPartyEnum = pgEnum("tracking_party", ["first_party", "third_party"]);

// Manual/import registry (§5.6) — nothing here scans a customer's site;
// staff enters what they know is running. Same active/retire pattern (not
// hard-deleted) as dsar_systems/legal_holds, so retiring an entry doesn't
// erase the record of it having existed.
export const trackingTechnologies = pgTable("tracking_technologies", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  purpose: text("purpose").notNull().default(""),
  category: trackingCategoryEnum("category").notNull().default("other"),
  party: trackingPartyEnum("party").notNull().default("third_party"),
  retention: text("retention").notNull().default(""),
  active: boolean("active").notNull().default(true),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Phase 7 (PRD §5.10/§7) — Assisted DSAR Fulfillment, design pass built
// 2026-09-12 per Ariel's "move to Phase 7" call (skipping Phase 6 for now).
// This is the first phase in the project that writes to systems outside our
// own database, so it gets a materially more cautious design than anything
// before it:
//
// - V1 connectors are Salesforce, M365, and Google Drive (Ariel's explicit
//   priority call, 2026-09-12), each implementing the same narrow interface
//   (search/export/delete — NOT correct; see connectors/types.ts for why
//   "correct" is deferred).
// - V1 identity resolution is exact-match on requester email only, case
//   insensitive — no fuzzy/name/customer-ID matching. The PRD itself flags
//   false positives here as a data-loss risk; a missed record (false
//   negative) is a compliance gap a human can catch on review, a wrongly
//   deleted record is not reversible.
// - V1 search scope is narrow per connector, Ariel's explicit call: SF
//   Contacts/Leads only (not Cases/Opportunities), M365 Outlook mail only
//   (not SharePoint/Teams), Google Drive file METADATA only (not file
//   content search). See README for what this misses.
// - A permanent human-approval gate sits between "search found this" and
//   "action executed" — every matched record is reviewed and individually
//   approved/rejected before export or delete runs on it. This is a design
//   constraint per PRD §7, not a V1 training-wheel to remove later.
// - A delete is hard-blocked (no override) if the requester's email matches
//   an active legalHolds row — reuses the existing Phase 3.1 lookup
//   (findActiveLegalHold), same case-insensitive exact-email match. Export
//   is NOT blocked by a hold (access/portability can proceed; deletion is
//   the irreversible one). Ariel's explicit call: hard block, no override.
// - Every connector API call is logged append-only to dsar_connector_events,
//   independent of and in addition to the general dsar_events audit trail,
//   satisfying §5.10's "immutable execution log" requirement specifically.
// - No credentials for any real provider exist yet — OAuth app registration
//   (Salesforce Connected App, Azure/Entra app, Google Cloud OAuth client)
//   for THIS product has not been confirmed done as of this build (Ariel
//   was checking as of 2026-09-12). connectors/mock.ts stands in for all
//   three so the full schema/approval-gate/execution-log flow is buildable
//   and reviewable now; connectors/salesforce.ts, m365.ts, google-drive.ts
//   are stubs that throw "not configured" until real OAuth credentials are
//   wired in (see README "Phase 7 — what's real vs. stubbed").
// - No background job queue exists in this project — execution is
//   synchronous inside one request/action call, capped at
//   MAX_RECORDS_PER_RUN (see connectors/config.ts) per connector per run.
//   Fine for a design partner's DSAR volume; a real scale constraint if a
//   customer's Salesforce search returns thousands of matches — flagged in
//   README, not silently handled.
// ---------------------------------------------------------------------------

export const connectorIdEnum = pgEnum("connector_id", ["salesforce", "m365", "google_drive"]);
export const connectorRunStatusEnum = pgEnum("connector_run_status", [
  "searching",
  "awaiting_approval",
  "executing",
  "completed",
  "failed",
]);
export const connectorMatchActionEnum = pgEnum("connector_match_action", ["export", "delete"]);
export const connectorMatchDecisionEnum = pgEnum("connector_match_decision", [
  "pending",
  "approved",
  "rejected",
]);
export const connectorMatchResultEnum = pgEnum("connector_match_result", [
  "pending",
  "succeeded",
  "failed",
  "blocked_legal_hold",
]);

// One row per org per provider — the OAuth connection itself. refreshToken
// is encrypted at rest (see connectors/crypto.ts, new infra — nothing else
// in this app stores a third-party secret; Resend/Blob tokens are RiskQ's
// own env vars, not per-customer). Never logged, never returned to the
// client — server-side reads only, immediately before a token refresh call.
export const connectorConnections = pgTable("connector_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  connectorId: connectorIdEnum("connector_id").notNull(),
  // Provider-side account/org label (e.g. Salesforce org name, M365 tenant
  // domain) — display only, so staff can confirm which real account is
  // connected without decrypting anything.
  accountLabel: text("account_label").notNull().default(""),
  encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
  connectedBy: uuid("connected_by").notNull().references(() => users.id),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  // Disconnected, not deleted — same active/retire convention as
  // dsar_systems/legal_holds/tracking_technologies. A disconnected
  // connection can't be used for a new run but its past runs/matches/events
  // stay intact for audit purposes.
  active: boolean("active").notNull().default(true),
}, (table) => ({
  orgConnectorIdx: uniqueIndex("connector_connections_org_connector_idx").on(
    table.orgId,
    table.connectorId
  ),
}));

// One row per (DSAR request, connector) search attempt. A request can have
// multiple runs over time (e.g. re-run after connecting a new system) —
// never overwritten, each run is its own record.
export const dsarConnectorRuns = pgTable("dsar_connector_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id").notNull().references(() => dsarRequests.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  connectorId: connectorIdEnum("connector_id").notNull(),
  status: connectorRunStatusEnum("status").notNull().default("searching"),
  errorDetail: text("error_detail").notNull().default(""),
  startedBy: uuid("started_by").notNull().references(() => users.id),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

// One row per matched external record — the approval-gate object itself.
// snapshot is a small jsonb display payload (object type, a name/email/
// subject line, provider record id) — enough for a human to recognize the
// record, deliberately NOT the full external record (no reason to pull and
// store a customer's entire Salesforce Contact into our own database just
// to render a review list).
export const dsarConnectorMatches = pgTable("dsar_connector_matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull().references(() => dsarConnectorRuns.id, { onDelete: "cascade" }),
  requestId: uuid("request_id").notNull().references(() => dsarRequests.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  connectorId: connectorIdEnum("connector_id").notNull(),
  externalObjectType: text("external_object_type").notNull(),
  externalRecordId: text("external_record_id").notNull(),
  snapshot: jsonb("snapshot").notNull(),
  requestedAction: connectorMatchActionEnum("requested_action").notNull().default("export"),
  decision: connectorMatchDecisionEnum("decision").notNull().default("pending"),
  decidedBy: uuid("decided_by").references(() => users.id),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  result: connectorMatchResultEnum("result").notNull().default("pending"),
  resultDetail: text("result_detail").notNull().default(""),
  executedAt: timestamp("executed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Append-only, independent of dsar_events — every real or attempted call to
// a connected external system, satisfying §5.10's "immutable execution log"
// requirement specifically (not just the general DSAR audit trail, which
// this ALSO still writes to via the usual logEvent() calls). detail is a
// summary (action, record count, outcome) — never the record payload
// itself, same minimization stance as dsarConnectorMatches.snapshot.
export const dsarConnectorEvents = pgTable("dsar_connector_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id").notNull().references(() => dsarRequests.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  connectorId: connectorIdEnum("connector_id").notNull(),
  eventType: text("event_type").notNull(),
  detail: text("detail").notNull().default(""),
  actorId: uuid("actor_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Lightweight sub-processor list per org (§5.10's GDPR Art. 17(2)-style
// notification requirement) — explicitly NOT a vendor/TPRM assessment
// (those stay excluded per PRD §4/§10). Just enough to know who to notify
// when a deletion executes: name, contact, and what categories of data they
// receive. Notification itself is a manual action in V1 (a copy-ready
// template, same posture as DSAR response templates pre-Phase-3.1) — no
// automated send, since that would need a verified fact about what this
// specific processor actually received, which nothing here tracks.
export const subProcessors = pgTable("sub_processors", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  contactEmail: text("contact_email").notNull().default(""),
  dataCategories: text("data_categories").notNull().default(""),
  active: boolean("active").notNull().default(true),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
