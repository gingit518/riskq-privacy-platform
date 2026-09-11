# RiskQ Privacy Compliance Platform — Phase 1 scaffold

Multi-tenant SaaS privacy compliance platform. Phase 1 = Regulatory
Management only: the module every other module (Business Obligations, DSAR,
Cyber Controls, Assessments, International Transfers, Tracking Technologies)
derives scope from. See the PRD (`PRD-Privacy-Application.md` in the Privacy
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

## What's NOT built yet

Everything downstream of Regulatory Management: Business Obligations, DSAR
tracking, Cyber Controls, Assessments (DPIA/PIA, readiness/maturity, RoPA —
**not** vendor/TPRM, which is explicitly out of scope for this product per
Ariel's instruction), International Transfers, Tracking Technologies/CMP
(scoped in PRD §5.9), and Automated DSAR fulfillment (scoped in PRD §5.10).
Those are later phases per the PRD roadmap.

## Setup required before this deploys

1. **`DATABASE_URL`** — provision a Postgres instance (Vercel Postgres, Neon,
   or Supabase all work with the `postgres.js` driver used here) and set this
   env var. Nothing in this codebase can provision one for you.
2. **`AUTH_SECRET`** — any long random string (`openssl rand -base64 32`).
   Used to sign session JWTs. Rotating it invalidates all sessions.
3. Run migrations: `npm run db:generate` (generates SQL from `schema.ts` into
   `./drizzle`, commit the output) then `npm run db:migrate` (applies it).
4. Seed the regulation content snapshot: `npm run db:seed`. Re-run this any
   time `src/lib/regulations/data.ts` changes — it's idempotent (content-hash
   versioned, see `regulations/metadata.ts`).

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
