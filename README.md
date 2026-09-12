# RiskQ Privacy Compliance Platform — Phase 1 + 2 + 3 + 3.1 + 4 + 5 + 7 scaffold

Multi-tenant SaaS privacy compliance platform. Phase 1 = Regulatory
Management, the module every other module (Business Obligations, DSAR,
Cyber Controls, Assessments, International Transfers, Tracking Technologies)
derives scope from. Phase 2 = Business Obligations + Cyber Controls, wired to
that scope. Phase 3 = Data Subject Access Rights (DSAR), also wired to that
scope. Phase 3.1 = DSAR fulfillment automation — turning the default
fulfillment checklist's line items into tracked/assigned/auditable actions
where that's honestly possible (see "What's built (Phase 3.1)" for what
is and isn't). Phase 4 = Assessments (RoPA, DPIA, readiness/maturity) and
International Transfers (see "What's built (Phase 4)"). Phase 5 = Tracking
Technologies (manual registry) and a Compliance Dashboard with CSV/PDF
export (see "What's built (Phase 5)"). Phase 6 (live tracker scanning/CMP)
is skipped for now, pending Ariel's buy-vs-build call. Phase 7 = the
connector framework, approval-gate UI, and legal-hold/sub-processor pieces
of Assisted DSAR Fulfillment — real Salesforce/M365/Google Drive API calls
are NOT implemented yet, see "What's built (Phase 7)" for exactly what's
real vs. stubbed. See the PRD (`PRD-Privacy-Application.md` in the Privacy
Development project) for the full product spec — this README covers only
what's needed to run and extend this codebase.

## What's built (Phase 1)

- Multi-tenant data model (`orgs`, `users`, `org_profiles`, `regulation_sets`,
  `org_regulation_scope`) — Drizzle ORM / Postgres.
- The regulation scoping engine, ported **verbatim** from
  `gingit518/riskq-regulation-lookup` (the standalone tool at
  `project-mmq67.vercel.app`): 92 regulations (17 US Federal, 27 US State, 48
  International) and the `evalReg()` logic (AND/OR/state+threshold/
  state+revenue+threshold, plus the "watch" near-miss heuristic). See
  `src/lib/regulations/`.
- Minimal email+password auth (signup, login, logout) with a signed httpOnly
  JWT session cookie — see "Auth" below for why this isn't Auth.js/Clerk yet.
- Pages: `/signup`, `/login`, `/profile` (company profile intake — the input
  to scoring), `/scope` (the computed Applicable Regulations list, versioned
  per profile snapshot).

## What's built (Phase 2)

- **Business Obligations** (`org_obligations`, `src/app/obligations/`) — one
  row per obligation per in-scope regulation, synced from the `obls` field
  already present on each ported REGS entry via the versioned
  `regulation_sets` metadata snapshot (not live `data.ts`), so obligation
  text stays tied to what was actually in scope at that point in time. Sync
  is additive-only: re-running it never resets an existing row's status,
  owner, due date, or notes, and a regulation falling out of scope on a later
  re-analysis does not delete its obligation rows (audit trail, per PRD
  §5.2) — the page flags "no longer in current scope" instead.
- **Cyber Controls** (`controls_library` + `org_controls`,
  `src/app/controls/`) — a global, self-seeding control library (same
  self-seed-on-first-use pattern as `regulation_sets`) plus per-org
  implementation status/evidence/last-tested tracking. **Important caveat**:
  the seeded library is NIST CSF 2.0's public Function/Category taxonomy (6
  Functions, 22 Categories) with a `regulationGroupsTag` I added by hand as
  an indicative, non-legally-reviewed guess at relevance — not a verified
  control-to-regulation compliance mapping. See
  `src/lib/controls/types.ts`/`data.ts` for the full caveat. ISO/IEC 27001,
  CIS Controls, and NIST SP 800-53 (all named in PRD §5.4) are **not yet
  seeded** — those either carry licensing/reproduction restrictions (ISO,
  CIS) or need sourcing from an authoritative free text (800-53) rather than
  being authored from memory, which is exactly the unverified-content risk
  this PRD flags for the regulation library itself (§9 item 3).
- Shared nav (`src/components/Nav.tsx`) across Profile/Regulations/
  Obligations/Cyber Controls, plus a working logout link — Phase 1 shipped
  `/api/auth/logout` but nothing in the UI linked to it.
- **Evidence file uploads** (`evidence_files`, `src/lib/evidence.ts`) — added
  after Ariel flagged that a free-text "evidence" note doesn't satisfy
  §5.2/§5.4's actual ask ("evidence attachment"/"evidence upload"). Both
  Obligations and Cyber Controls rows now have a real file picker; uploads go
  to Vercel Blob (per PRD §6) and the row shows a download link, uploaded-by
  date, and size. Append-only — no delete button in the UI, same audit-trail
  philosophy as the rest of this schema. Needs its own setup step, see below.

## What's built (Phase 3)

- **DSAR requests** (`dsar_requests`, `dsar_events`, `src/app/dsar/`) — two
  intake paths writing to the same table: an internal authenticated form
  (`/dsar/new`) and a public unauthenticated form at `/intake/<org-slug>`
  (`src/app/intake/[slug]/`, `src/components/PublicIntakeForm.tsx`) for data
  subjects to submit requests directly. `dsar_events` is an append-only audit
  trail — every status change and identity-verification event, timestamped.
- **SLA derivation** (`src/lib/dsar/sla.ts`) — PRD §5.3 says the SLA clock is
  "pulled from Regulatory Management scoping, per-regulation" (citing GDPR 30
  days vs. CCPA 45 days). The ported regulation data has exactly that field
  (`resp`, see `regulations/types.ts`) but it's free text across all 92
  entries — `'30 days'`, `'Reasonable time'`, `'N/A'`, `'20 business days'`,
  etc., not a clean number, and it's one field per regulation, not broken out
  by request type (access vs. deletion vs. correction vs. portability vs.
  opt-out). At request creation, this parses every currently in-scope
  regulation's `resp` field and, **per Ariel's explicit call (2026-09-11),
  picks the SHORTEST parseable response window** as the governing regulation
  and due date; regulations with no parseable day count (breach-notification-
  only regs, or vague text like "Reasonable time") are excluded from the
  calculation rather than producing a false due date. A statute specifying
  business/working days is approximated as calendar days (flagged in the UI,
  not silently treated as exact — this app has no business-day calendar).
  The governing regulation/SLA is snapshotted onto the request at creation
  time, same audit-trail-over-live-recompute philosophy as
  `org_obligations`/`evidence_files`: a later scope re-analysis never
  retroactively moves an already-open request's due date.
- **Configurable checklists** (`dsar_checklist_templates` +
  `dsar_checklist_items`, `/dsar/checklist`) — per Ariel's explicit call
  (2026-09-11), checklists are editable per org from day one, not a fixed
  global list like Cyber Controls' NIST seed. Each (org, request type) gets a
  generic default checklist (`src/lib/dsar/checklist-defaults.ts`) the first
  time it's touched; orgs can add/remove items after that. Each request
  snapshots the template into its own `dsar_checklist_items` rows at creation
  time — editing the template later never changes an already-open request's
  checklist.
- **Response templates** (`src/lib/dsar/templates.ts`,
  `src/components/ResponseTemplates.tsx`) — acknowledgment/completion/denial
  text per request, with copy-to-clipboard. This app has no email-sending
  capability, so these are pasted into the staff member's own email client,
  not sent automatically.
- **Reporting** (`/dsar` dashboard) — volume, average response time (based
  on closed requests), and SLA breach rate, computed live from
  `dsar_requests`/`dsar_events`.
- `src/lib/scope.ts` — the "read the latest scope run + its metadata
  snapshot" helper that Business Obligations already had was extracted out
  of `obligations/actions.ts` into this shared file so DSAR could reuse it
  without a second slightly-diverging copy. `obligations/actions.ts` now
  wraps it (a plain re-export isn't allowed in a `"use server"` file — Next's
  compiler requires every export there to be a locally-defined async
  function).

## What's built (Phase 3.1)

Built 2026-09-12 after Ariel reviewed the default `access` checklist
(`checklist-defaults.ts`) and asked which of its 7 line items could actually
be automated. Honest answer, item by item, drove what got built:

- **Systems Register** (`dsar_systems`, `dsar_system_tasks`, `/dsar/systems`)
  — turns "locate all systems/records containing the requester's data" from
  one vague checklist line into per-system assigned tasks. This does **not**
  search anything — there's no generic way to query an arbitrary customer's
  CRM/database/email tool without a connector to each one specifically. What
  it automates is the fan-out: every active registered system gets its own
  tracked task, snapshotted onto the request at creation time (editing/
  retiring a system later never rewrites an already-open request's task
  list, same audit-trail rule as everything else here).
- **Legal Holds** (`legal_holds`, `/dsar/legal-holds`) — a simple registry,
  checked **live** (not snapshotted) against the requester's email every
  time a request's detail page renders, since a hold can be placed after
  intake but before the response ships. Flags a match with the matter
  description; does not block anything — whether it justifies withholding
  data stays a human legal call.
- **DSAR evidence/export attachment** (`evidence_files.dsar_request_id`,
  upload form on `/dsar/[id]`) — reuses the Phase 2 evidence-upload
  plumbing so a compiled export can be attached directly to a request.
  Stored as a **private** Vercel blob (`isPrivate` column), unlike
  Obligations/Controls evidence — this data is meant to leave the org via
  the requester's response, so it gets the stricter posture: there is no
  separately-guessable public URL for it at all, only server-side reads via
  `BLOB_READ_WRITE_TOKEN`.
- **Send response** (`sendDsarResponse` in `dsar/actions.ts`, via Resend) —
  one click emails the completion template to the requester. If file(s) are
  attached, a random, expiring (7-day) download token is generated
  (`dsar_download_tokens`) and its link is baked into the email; the public,
  unauthenticated `/dsar/download/[token]` page (mirrors `/intake/[slug]`'s
  no-`requireSession()` pattern) lists the attached files, each served by
  `/dsar/download/[token]/file/[fileId]`, which re-validates the token on
  every request and streams the private blob server-side — the token is the
  entire access control, not a wrapper around an already-public link.
  Deliberately does **not** auto-transition the request's status to
  "completed" — sending a response and closing the request are related but
  distinct actions (a partial response may still need follow-up), so status
  stays an explicit staff decision.
- **Checklist-toggle audit logging fix** — `toggleChecklistItem` previously
  wrote no `dsar_events` row at all, inconsistent with every other material
  action in this module. Now logs `checklist_item_toggled`.
- **Explicitly deferred, per Ariel's call (2026-09-12):**
  - *Automated identity-proofing* (document/selfie verification via a
    vendor like Persona/Stripe Identity) — the existing manual
    staff-attestation button stays as-is; full proofing is a discrete
    future integration if a customer requires it.
  - *PII-detection pass on uploaded files* — would only ever be a
    highlighting aid for a human reviewer (never an auto-redactor — a false
    negative leaks someone else's PII, a false positive withholds data you
    owed), and isn't worth the added vendor dependency until a customer
    asks.
  - *Statutory exemption review* stays a pure human legal judgment call —
    no attempt to encode "does this regulation have an exemption" logic.

## What's built (Phase 4)

Built 2026-09-12 (PRD §5.5/§5.7/§8). Three build-unblocking calls Ariel made
that day, each flagged in code comments where it matters: DPIA content is a
generic GDPR Art. 35-style question template, not legally reviewed (same
caveat as Cyber Controls' NIST tagging); maturity scoring reuses the
existing NIST CSF categories (`controls_library`) rather than a new
framework; a processing activity's "systems involved" reuses the DSAR
Systems Register (`dsar_systems`) rather than a second systems list.

- **RoPA — Records of Processing Activities** (`processing_activities`,
  `/ropa`, `/ropa/[id]`) — one row per distinct processing purpose: name,
  purpose, data categories/subjects, lawful basis, retention period, and
  three risk flags (special-category data, large-scale processing,
  automated decision-making). "Systems involved" is a many-to-many join
  (`processing_activity_systems`) to `dsar_systems`, resolved **live** on
  the detail page (not snapshotted) — RoPA is meant to reflect current
  state, unlike a DSAR request's point-in-time task list. This is new
  shared infrastructure for DPIA/Transfers, not a retrofit onto Business
  Obligations (Phase 2 shipped without it — that gap isn't silently closed).
- **DPIA/PIA** (`dpia_assessments`, `/ropa/[id]/dpia`) — one DPIA per
  activity, started idempotently from the activity page, editable in place
  until marked "completed" (**not** append-only/versioned like the rest of
  this schema — deliberate, since a DPIA is a living draft, not a
  point-in-time audit event; flagged in the schema comment). 15 questions
  across 5 sections (`dpia-questions.ts`) drive an "DPIA recommended"
  banner whenever any risk flag is set (`needsDpiaReview()`) — this never
  forces a DPIA, only surfaces the recommendation; a human still decides.
  Completing one records a risk rating (low/medium/high) and a mitigations
  summary; reopening clears completion and returns it to draft.
- **Readiness/maturity scoring** (`org_controls.maturityLevel` +
  `maturityNotes`, extended into `/controls`, aggregated in
  `getMaturityByFunction()`) — a second, independent axis from Cyber
  Controls' existing implementation `status`: a control can be
  "implemented" but ad hoc (low maturity), or "partial" but well-governed
  where it exists (higher maturity than status alone implies). Six levels
  (not assessed → initial → developing → defined → managed → optimized),
  scored 0–5 and averaged per NIST Function, excluding not-assessed rows
  from the average rather than treating them as zero.
- **International Transfers** (`international_transfers`, `/transfers`) —
  a cross-border transfer registry: from/to jurisdiction, an optional link
  to a processing activity, transfer mechanism (SCCs / adequacy decision /
  BCRs / derogation / none), and transfer-impact-assessment status.
  `mechanism = 'none'` is highlighted as the explicit gap state the PRD
  asks to alert on, not an omitted field — there is **no** automated
  jurisdiction-conflict detection; this is a manual register.
- **Assessments dashboard** (`/assessments`) — the cross-module summary
  none of the four individual pages shows alone: RoPA count, DPIAs
  recommended-but-not-started vs. in-progress vs. completed, transfers with
  no mechanism, and controls-maturity-assessed, each linking to the page
  that can act on it.

## What's built (Phase 5)

Built 2026-09-12 (PRD §5.6/§5.8/§8), after three build-unblocking calls from
Ariel: the Tracking Technologies "tied to consent-requirement flags"
language is satisfied by a curated regulation tag (not a live scan); the
Compliance Dashboard's score is a simple unweighted % blend; exportable
reports ship as both CSV and PDF now, not CSV-only.

- **Tracking Technologies registry** (`tracking_technologies`, `/tracking`)
  — manual/import list (name, purpose, category, first/third-party,
  retention), same active/retire pattern as the DSAR Systems Register and
  Legal Holds. "Tied to consent-requirement flags from Regulatory
  Management" (§5.6) is implemented as a curated tag on which of the 92
  ported regulations require cookie/tracker consent
  (`regulations/tracking-consent-tags.ts`) — my own indicative judgment
  call, same not-legally-reviewed caveat as Cyber Controls' regulation
  tags — surfaced as an informational banner ("N regulations in your scope
  require consent: ...") rather than an automatic per-entry decision.
  Nothing here scans a site; that's the deferred Phase 6 CMP build (§5.9).
- **Compliance Dashboard** (`/compliance`, computed live — no new
  persisted score table) — a blended score per in-scope regulation
  (unweighted average of obligations-done %, DSAR SLA-met %, and
  controls-implemented %), plus an overall org score, rendered as a
  red/amber/green heatmap. **A real granularity gap, flagged rather than
  smoothed over:** obligations and DSAR are tagged to a specific
  regulation acronym, but Cyber Controls content is only tagged to a
  broad jurisdiction group (US Federal/US State/International) — so the
  controls figure in a regulation's blended score is really "controls
  implemented for that whole jurisdiction group," not that specific
  regulation. A missing signal (no obligations tracked for a regulation,
  no closed DSAR requests) is excluded from the average, never counted as
  zero.
- **CSV and PDF export** (`/compliance/export/csv`, `/compliance/export/pdf`)
  — both built now per Ariel's call. PDF uses `pdfkit` (pure JS, no
  headless-browser dependency, so it runs in a normal Vercel serverless
  function) — added as a new dependency, exact-pinned like everything
  else in this project; `iconv-lite` added alongside it to close a
  build-warning-only gap in `pdfkit`'s font-encoding dependency chain
  (verified: only affects custom non-UTF8 font embedding, which this
  report never does).
- **"Recent activity" on the dashboard is DSAR's own event log, not a true
  cross-module audit trail.** §5.8 asks for "a cross-module audit trail" —
  Obligations and Cyber Controls don't emit any events today (just an
  `updatedAt` timestamp on each row), so a genuine cross-module log needs
  a new generic event table those modules write to. Not built in this
  pass — the dashboard shows `dsar_events` under an explicit "(DSAR only)"
  label rather than silently presenting a partial feed as the full thing.

## What's built (Phase 7)

Built 2026-09-12 (PRD §5.10/§7), after Ariel said "move to Phase 7" (Phase 6
skipped for now). This is the first phase that writes to systems outside
this app's own database, so it's scoped more cautiously than anything
before it — a design pass (schema, interface, approval gate, legal-hold
interaction) plus a fully clickable pipeline running against **fake data
only**. **No real Salesforce/M365/Google Drive account can be searched,
exported from, or deleted from yet** — that's the single most important
thing to understand about this phase before touching it.

- **Connector interface** (`src/lib/connectors/types.ts`) — `search` /
  `exportRecords` / `deleteRecords` only. **"correct" is deliberately not a
  connector action** — it needs a per-org field-mapping config (which
  Salesforce field is "mailing address," etc.) that's separate scope;
  correction stays a manual process, same as with no connectors at all.
- **Three connector files, all stubs**: `salesforce.ts`, `m365.ts`,
  `google-drive.ts`. Each documents, in its own header comment, exactly
  what real OAuth app registration and API wiring it needs — including two
  real architectural decisions surfaced during this design pass, not
  glossed over: M365 needs either admin-consented application permissions
  or the Microsoft Purview eDiscovery API to search more than one person's
  own mailbox (a per-user OAuth consent, the simple pattern, isn't enough);
  Google Drive needs Workspace domain-wide delegation to search more than
  files the connecting user personally owns. Neither decision has been
  made yet. `isXConfigured()` in each file checks for the relevant env
  vars and is the only thing that works today — `search`/`exportRecords`/
  `deleteRecords` all throw "not implemented" unconditionally.
- **A mock connector** (`connectors/mock.ts`, `connectors/registry.ts`),
  gated behind `CONNECTOR_MOCK_MODE=true`, standing in for all three real
  ones with deterministic fake matches — this is what makes the rest of
  this phase reviewable end to end (`phase7-test-script.md`) without
  needing a single real OAuth credential.
- **New encryption-at-rest infrastructure** (`connectors/crypto.ts`) —
  AES-256-GCM via Node's built-in `crypto`, no new dependency. Every other
  secret in this app is either RiskQ's own env var (never in Postgres) or a
  customer's bcrypt-hashed password (never decrypted). A connector's OAuth
  refresh token is the first per-customer secret this app has to store and
  read back in plaintext, so it gets real symmetric encryption, keyed by
  a new `CONNECTOR_ENCRYPTION_KEY` env var — see `.env.example`.
- **`/connectors` settings page** — connect/disconnect per org
  (mock-mode "Connect" writes a fake connection; real-provider "Connect"
  currently 501s with a plain-text explanation, from the stub
  `/api/connectors/[connectorId]/authorize` route, rather than pretending
  to start an OAuth flow that doesn't exist).
- **Fulfillment section on the DSAR detail page** (`/dsar/[id]`) — the
  approval-gate UI itself: "Search {connector}" → matched records list
  (object type + a small display snapshot, never the full external
  record) → per-record Approve/Reject → "Execute approved." A deletion
  request defaults every match's proposed action to delete; every other
  request type defaults to export.
- **Hard legal-hold block on delete, no override** (Ariel's explicit
  call, 2026-09-12) — checked LIVE at both approval time and execution
  time (not snapshotted), reusing the same `findActiveLegalHold` lookup
  Phase 3.1 already uses elsewhere on this page. Export is never blocked
  by a hold.
- **Narrow V1 search scope** (Ariel's explicit call): Salesforce
  Contacts/Leads only, M365 Outlook mail only, Google Drive file metadata
  only — not Cases/Opportunities, not SharePoint/Teams, not Drive file
  contents. Documented as a real coverage gap, not silently assumed
  complete.
- **Exact-email-match identity resolution only** — no fuzzy/name/customer-
  ID matching. The PRD itself flags false positives (wrong-record action)
  as the higher-liability failure mode versus false negatives (a human
  catches a miss on review) — so V1 deliberately narrows rather than
  broadens matching.
- **`dsar_connector_events`** — an append-only log independent of the
  general `dsar_events` audit trail, satisfying §5.10's "immutable
  execution log" requirement specifically. Logs summaries (record counts,
  outcome), never the record payloads themselves.
- **Sub-processor register** (`sub_processors`, `/dsar/sub-processors`) —
  the §5.10 Art. 17(2)-style notification list. Manual, copy-ready notice
  template only, same reasoning as every other "template, not automated
  send" piece in this app (nothing here tracks what a specific processor
  actually received for a given requester).
- **No background job queue** — search/execute run synchronously inside
  one request, capped at `MAX_RECORDS_PER_RUN` (25, `connectors/config.ts`)
  per connector per run. A search returning more than that is truncated
  and flagged in the run's log entry, not silently processed in full.

## What's NOT built yet

**Every real connector API call.** Nothing in this phase can search,
export from, or delete from an actual Salesforce org, M365 tenant, or
Google Drive account — see "What's built (Phase 7)" above for exactly
what's stubbed and why (OAuth app registration status was still being
checked by Ariel as of this build). Also not built: the "correct" DSAR
action (deferred, needs per-org field mapping — see above), automated
sub-processor notification (manual template only), and the M365/Google
Drive admin-consent-vs-simpler-flow decisions each connector's stub
flags. Live tracker scanning + consent management (CMP, PRD §5.9) remains
untouched, skipped in favor of Phase 7 per Ariel's 2026-09-12 call —
still blocked on the buy-vs-build decision. **Not** vendor/TPRM, which
stays explicitly out of scope for this product per Ariel's instruction.

## Setup required before this deploys

1. **`DATABASE_URL`** — provision a Postgres instance (Vercel Postgres, Neon,
   or Supabase all work with the `postgres.js` driver used here) and set this
   env var. Nothing in this codebase can provision one for you.
2. **`AUTH_SECRET`** — any long random string (`openssl rand -base64 32`).
   Used to sign session JWTs. Rotating it invalidates all sessions.
3. Run migrations: `npm run db:generate` (generates SQL from `schema.ts` into
   `./drizzle`, commit the output) then `npm run db:migrate` (applies it) —
   or, if you don't have `DATABASE_URL` reachable from wherever you're
   running commands (e.g. a Neon DB only reachable from Vercel's network),
   paste the SQL file(s) under `./drizzle/*.sql` directly into your Postgres
   provider's SQL console, in filename order (`0000_...` then `0001_...`,
   etc.). **This step does not run automatically when you provision a new
   database** — see the Phase 1 build-log incident in the PRD Appendix A for
   what happens if you skip it (every write 500s with `relation "x" does not
   exist`).
4. Seed the regulation content snapshot: `npm run db:seed`. Re-run this any
   time `src/lib/regulations/data.ts` changes — it's idempotent (content-hash
   versioned, see `regulations/metadata.ts`). Not strictly required — the
   `/profile` scoring flow and the `/controls` page both self-seed their
   respective content on first use — but running it explicitly after a
   content change is still good practice.
5. **`BLOB_READ_WRITE_TOKEN`** — required for evidence uploads on
   `/obligations`, `/controls`, and `/dsar`. Vercel → Storage →
   Create Database → Blob → connect it to this project, same flow as the
   Neon Postgres setup above; the token auto-injects once connected. Without
   it, evidence upload throws a clear error naming this step — it doesn't
   fail silently, and nothing else in the app depends on it.
6. **`RESEND_API_KEY`** — required for the "Send response now" button on a
   DSAR request (Phase 3.1). Create a free account at resend.com, generate
   an API key, add it to Vercel's Environment Variables. Without it,
   sending throws a clear error naming this step.
7. **`EMAIL_FROM`** — the sending address for DSAR response emails. Must be
   on a domain verified in Resend for real deliverability; unset falls back
   to Resend's sandbox `onboarding@resend.dev`, which only delivers to the
   Resend account owner's own inbox — fine for testing, not for real
   requesters.
8. **`APP_BASE_URL`** — your production URL, used to build the absolute
   download link emailed to requesters. Falls back to Vercel's
   auto-injected `VERCEL_URL` if unset; set it explicitly to be sure.
9. **`CONNECTOR_ENCRYPTION_KEY`** (Phase 7) — required before connecting
   any real connector (not needed for `CONNECTOR_MOCK_MODE`).
   `openssl rand -base64 32`, same as `AUTH_SECRET`.
10. **`SALESFORCE_CLIENT_ID`/`_SECRET`, `AZURE_CLIENT_ID`/`_SECRET`,
    `GOOGLE_CLIENT_ID`/`_SECRET`** (Phase 7) — not usable yet regardless of
    whether these are set; see "What's built (Phase 7)." Set
    `CONNECTOR_MOCK_MODE=true` instead to review the fulfillment pipeline
    against fake data.

Copy `.env.example` to `.env.local` for local dev.

## Known gaps / deliberate deferrals

- **No row-level security.** Every tenant table has `org_id`, and every query
  in this scaffold filters by the session's `org_id` in application code —
  but there's no Postgres RLS policy enforcing it as a backstop. Add one
  before this holds real customer data from more than one tenant.
- **Auth is intentionally minimal**, not Auth.js/Clerk. The PRD leaves the
  auth provider decision open (§6); rather than guess, this implements just
  enough (bcrypt + JWT cookie) to unblock building tenant-scoped routes. See
  the comment in `src/lib/auth/session.ts`. Swapping providers later touches
  that one file, not the schema or pages.
- **The "Lookup Secret Key" LLM-assisted auto-fill** from the original
  standalone tool (auto-guessing a company's profile fields) was **dropped**
  for this V1 — the profile page is manual entry only. This was my default
  assumption executing "let's start the build," not something you explicitly
  signed off — flag if you want it back; it'd be a discrete follow-on
  feature (LLM/search call from a server action into the same
  `saveProfileAndAnalyze` flow).
- **Regulation content is snapshotted as data, logic is not.**
  `regulation_sets.metadata` stores jurisdiction/penalties/timelines/
  obligations/test labels as JSON for versioning and audit — but the actual
  `pass()` scoping predicates in `data.ts` are still code. A content edit
  (e.g. a penalty amount changes) doesn't require a deploy once there's an
  admin UI for it (not built yet); a logic edit (a new threshold, a new test)
  always will. Don't oversell this as "fully data-driven" to anyone — it
  isn't, by design (predicates are executable logic, not safely
  data-encodable without building a rule DSL, which is out of scope here).
- **Org slug collisions** in signup are handled with a retry loop, not a DB
  constraint + transaction — fine at low signup volume, not race-safe under
  concurrent identical org names.
- **No password reset flow.** Out of scope for this scaffold.
- The standalone tool at `project-mmq67.vercel.app` (repo
  `gingit518/riskq-regulation-lookup`) still runs independently. Porting its
  logic here doesn't retire it — that's a separate decision for you.
- **Cyber Controls content is a starting scaffold, not verified compliance
  content.** See "What's built (Phase 2)" above — the NIST CSF 2.0 taxonomy
  itself is solid public reference material, but the per-category
  "relevant regulation groups" tag is my own rough guess, and ISO 27001/CIS/
  800-53 aren't seeded at all yet. Don't present the Cyber Controls gap
  summary to a customer as a legally-reviewed mapping.
- **Business Obligations has no per-obligation source citation** — the
  obligation text comes verbatim from each regulation's `obls` array (same
  provenance/review status as the regulation library itself, PRD §9 item 3),
  but there's no link back to the actual statute section it derives from.
  Worth adding once the legal review pass happens.
- **Fixed: `drizzle-orm` bumped 0.33.0 → 0.45.2** (`drizzle-kit` 0.24.2 →
  0.31.10 alongside it), closing a high-severity SQL injection advisory
  (GHSA-gpj5-g38j-94v9 / CVE-2026-39356). Checked the actual advisory before
  deciding: it only affects `sql.identifier()`, `.as()` aliases, or dynamic
  sorting/CTE names built from untrusted input — this codebase uses none of
  those (verified by grep), so exploitability here was already effectively
  zero. Fixed anyway once RiskQ's pen-test/SOC 2 plan came up: automated SCA
  scanning (what both a pen test and a SOC 2 vulnerability-management review
  actually run) flags by version number, not by reachability analysis, and
  RiskQ's own buyers (CISOs, privacy officers) are exactly the audience
  likely to run a dependency scan on a compliance product before buying it.
  `npm run typecheck`, `drizzle-kit generate` (confirmed zero schema drift),
  and `npm run build` all verified clean post-upgrade — there is still no
  automated test suite, so a full manual click-through after this deploys is
  the real verification, same as every other change in this project.
- **No error-message UI for evidence upload failures.** `uploadEvidence()` in
  `src/lib/evidence.ts` throws a clear message on a missing Blob token, an
  empty file, or an oversized file (>8MB) — but the two upload forms
  (`uploadObligationEvidence`, `uploadControlEvidence`) don't catch it, so a
  failure currently surfaces as Next's generic error page rather than an
  inline message next to the file picker. Low-effort follow-on, same shape
  as the earlier signup error-masking fix.
- **Public DSAR intake link uses the org's slug, not a secret token** — see
  "What's built (Phase 3)". `/intake/<slug>` is the same slug used at signup,
  which is guessable/enumerable, not a per-org secret. Fine for V1 since
  submitting a request isn't itself sensitive (no data is disclosed by
  submitting), but worth a random per-org token before treating this as a
  hardened public surface.
- **No rate limiting on the public intake form** — nothing stops repeated or
  automated submissions. Low risk today (there's no email-sending or
  auto-fulfillment triggered by a submission), but worth adding before real
  traffic.
- **DSAR SLA is one field per regulation, not per request type.** See
  `src/lib/dsar/sla.ts` — the ported regulation data's `resp` field doesn't
  distinguish access vs. deletion vs. correction vs. portability vs. opt-out
  response windows, so the SLA calculation treats all five the same way per
  regulation. Revisit if a future legal-review pass (PRD §9 item 3/7) adds
  per-right timelines.
- **Business/working-day statutes are approximated as calendar days** — no
  business-day calendar in this app yet (see `sla.ts`); the UI flags this on
  affected requests rather than presenting the due date as exact.
- **Checklist template items can't be reordered** — new items append at the
  end (`/dsar/checklist`); removing and re-adding is the only way to
  resequence for now.
- **No rate limiting on the public intake form** note above is now slightly
  incomplete: a submission still triggers no email itself, but a *staff
  member's* subsequent "Send response now" click does send real email via
  Resend — cost/abuse exposure is on the staff action, not the public form,
  but worth keeping in mind together.
- **Download tokens can't be revoked or rotated from the UI.** They expire
  after 7 days on their own (`dsar_download_tokens.expiresAt`), but if one
  needs to be killed early (sent to the wrong address, compromised inbox),
  that's a manual DB delete today, not an app feature.
- **Systems Register is manual setup, not auto-discovered.** An org has to
  know and list its own systems; nothing inspects their infrastructure.
  Fan-out tasks are only as complete as that list.
- **Legal hold matching is exact-email only** (case-insensitive) — no
  fuzzy/name matching, so a hold entered under a different email address
  than the one a requester submits with won't flag.
- **DPIA question set is a generic, unreviewed template** (`dpia-questions.ts`)
  — a standard GDPR Art. 35-style methodology, not sourced from any specific
  customer's legal counsel or a licensed framework. Same unverified-content
  caveat as `regulation_sets`/`controls_library` elsewhere in this app (PRD
  §9 item 3); the UI says so on the DPIA page itself.
- **Maturity scoring reuses NIST CSF categories rather than a dedicated
  maturity framework** (e.g. no CMMI/C2M2-style rubric per category) — a
  deliberate reuse decision, not an oversight; revisit if a customer needs a
  named maturity model for an audit.
- **RoPA's "systems involved" reuses the DSAR Systems Register**
  (`dsar_systems`) via a new join table rather than a second, independently
  maintained systems list — this leaves `dsar_systems` with a now-inaccurate
  DSAR-specific table name despite serving two modules. Not silently
  renamed, since it may already hold live production data from the Phase
  3.1 rollout.
- **DPIA is one row per activity, not versioned.** Unlike almost every other
  table in this schema (append-only, audit-trail style), `dpia_assessments`
  is edited in place until "completed," then edited again if reopened —
  there is no history of prior draft states. Acceptable for V1 since a DPIA
  is treated as a living document, but worth revisiting if a customer needs
  to show a regulator what changed between drafts.
- **International Transfers has no automated jurisdiction-conflict
  detection.** The registry records what mechanism an org says it has in
  place; nothing here checks whether that mechanism is actually valid or
  sufficient for the jurisdiction pair logged.
- **No error-message UI for the Phase 4 forms** — same known gap as evidence
  upload elsewhere in this app: a validation failure in the RoPA/DPIA/
  Transfers server actions surfaces as Next's generic error page, not an
  inline message.
- **Tracking Technologies consent tag is a curated list, not a legal
  determination.** `regulations/tracking-consent-tags.ts` is my own
  indicative judgment about which of the 92 ported regulations require
  cookie/tracker consent — same caveat category as the regulation library
  itself and Cyber Controls' regulation-group tags. Don't present it to a
  customer as a compliance mapping without review.
- **Tracking Technologies registry has no scanning, blocking, or
  per-visitor consent logging.** It's a manual list a staffer fills in —
  the real enforcement mechanism (Phase 6 CMP, PRD §5.9) is a separate,
  larger, not-yet-started build.
- **Compliance Dashboard's "controls implemented %" is jurisdiction-group
  level, not regulation-specific** (above) — a real precision gap in the
  blended score, not a rounding artifact.
- **Compliance Dashboard's "cross-module audit trail" is DSAR-only**
  (above) — Obligations and Cyber Controls don't emit events yet.
- **No error-message UI for the Tracking Technologies or export forms** —
  same known-gap pattern as every other upload/action form in this app.
- **PDF/CSV exports have no access control beyond the existing session
  check** — any authenticated user in an org can export that org's full
  compliance report; there's no separate "can export reports" permission
  distinct from general app access.
- **No real connector API calls exist (Phase 7)** — search/export/delete
  all throw "not implemented" for Salesforce/M365/Google Drive regardless
  of env var configuration; only `CONNECTOR_MOCK_MODE` produces a working
  end-to-end pipeline, against fake data. Don't connect a real provider
  and expect anything to happen.
- **M365 and Google Drive connectors need an architectural decision, not
  just OAuth plumbing, before real search can start** — see "What's built
  (Phase 7)" above (admin-consented app permissions/Purview for M365;
  domain-wide delegation vs. single-user scope for Drive).
- **"Correct" is not a Phase 7 connector action** — no per-org field-
  mapping config exists to know which external field to overwrite; a
  correction request still surfaces search matches for a human to act on
  manually, same as any other request type.
- **Sub-processor notification is a manual copy-ready template, not an
  automated send** — nothing tracks what a specific processor actually
  received for a given requester, so an automated send would be a guess
  dressed up as a confirmation.
- **No background job queue** — a connector search/execute run is capped
  at 25 records (`connectors/config.ts`) and must complete inside one
  synchronous Vercel function call. Fine for a design partner's DSAR
  volume; a real scale ceiling for a large customer's Salesforce org.
- **`connector_connections.accountLabel` has no real content yet** — once
  a real OAuth callback exists, it should be populated with something a
  staffer can use to confirm which real account is connected (e.g.
  Salesforce's `instance_url`, an M365 tenant domain); not wired up since
  no real callback exists yet either.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL, AUTH_SECRET
npm run db:generate && npm run db:migrate && npm run db:seed
npm run dev
```

## Scripts

- `npm run dev` / `build` / `start` — standard Next.js.
- `npm run typecheck` — `tsc --noEmit`.
- `npm run db:generate` — Drizzle Kit: diff `schema.ts` against the last
  migration and write new SQL to `./drizzle`.
- `npm run db:migrate` — apply pending SQL migrations.
- `npm run db:seed` — seed/update the regulation content snapshot.
