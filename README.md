# RiskQ Privacy Compliance Platform — Phase 1 + 2 + 3 scaffold

Multi-tenant SaaS privacy compliance platform. Phase 1 = Regulatory
Management, the module every other module (Business Obligations, DSAR,
Cyber Controls, Assessments, International Transfers, Tracking Technologies)
derives scope from. Phase 2 = Business Obligations + Cyber Controls, wired to
that scope. Phase 3 = Data Subject Access Rights (DSAR), also wired to that
scope. See the PRD (`PRD-Privacy-Application.md` in the Privacy Development
project) for the full product spec — this README covers only what's needed
to run and extend this codebase.

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

## What's NOT built yet

Assessments (DPIA/PIA, readiness/maturity, RoPA — **not** vendor/TPRM, which
is explicitly out of scope for this product per Ariel's instruction),
International Transfers, Tracking Technologies/CMP (scoped in PRD §5.9), and
Automated DSAR fulfillment (scoped in PRD §5.10). Those are later phases per
the PRD roadmap (§8).

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
   `/obligations` and `/controls` (nothing else uses it). Vercel → Storage →
   Create Database → Blob → connect it to this project, same flow as the
   Neon Postgres setup above; the token auto-injects once connected. Without
   it, evidence upload throws a clear error naming this step — it doesn't
   fail silently, and nothing else in the app depends on it.

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
