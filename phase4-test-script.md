# Phase 4 test script — Assessments (RoPA, DPIA, maturity) + International Transfers

Prereqs: Phase 4 migration (`0005_gifted_hitman.sql`) applied in Neon. At
least one active system in the Systems Register (`/dsar/systems`) makes
step 2 more meaningful but isn't required.

1. **Nav check.** Log in. Confirm "RoPA", "Transfers", and "Assessments"
   links now appear in the nav alongside the existing ones.

2. **Create a processing activity without risk flags.** Go to `/ropa` →
   fill in name/purpose/lawful basis, leave all three risk-flag checkboxes
   unchecked, optionally check a system → Add activity. Confirm: redirected
   to the activity's detail page; DPIA section says "no risk flags set... a
   DPIA is optional" (not "recommended"); back on `/ropa`, this row shows
   "Not flagged" in the DPIA column.

3. **Create a second activity WITH a risk flag.** Check "Involves
   special-category data" (or either of the other two) this time. Confirm
   on its detail page: DPIA section is on an orange background and says
   "Recommended based on the risk flags above." Confirm on `/ropa`'s list,
   this row shows "Recommended — not started" in amber.

4. **Start and fill out the DPIA.** From the flagged activity's detail
   page, click "Start DPIA" → lands on `/ropa/[id]/dpia`. Confirm all 15
   questions across 5 sections render. Type answers into 2-3 fields → Save
   answers → reload the page → confirm those answers persisted (this is
   the idempotent-start + save round-trip).

5. **Complete the DPIA.** Pick a risk rating, write a mitigations summary,
   click "Mark completed." Confirm: page now shows the completed banner
   with the risk rating, the question fields are disabled/read-only, and
   back on `/ropa`, this activity's DPIA column shows "Completed (X risk)."

6. **Reopen it.** Click "Reopen for editing" → confirm status flips back
   to draft, fields are editable again, and the `/ropa` list row goes back
   to "Draft in progress."

7. **Edit systems on an existing activity.** On either activity's detail
   page, check/uncheck a system in "Systems involved" → Save systems →
   reload → confirm the checked state persisted. If you have the
   `dsar_systems` register open in another tab, retire a system there and
   confirm the RoPA detail page picks up the "(retired)" label live
   (without needing to re-add the link) — this is the "not snapshotted"
   behavior called out in the README.

8. **Log an international transfer.** Go to `/transfers` → fill in a
   from/to jurisdiction pair, optionally link it to one of your activities,
   leave mechanism as "None in place" → Log transfer. Confirm: the new row
   appears with a red/pink background (the gap-state highlight), and the
   "transfers with no mechanism" count banner at the top increments.

9. **Fix the gap.** On that same row, change the mechanism dropdown to
   e.g. "Standard Contractual Clauses (SCCs)," set a TIA status, add a
   note → Save. Confirm the row's background goes back to normal and the
   gap counter decrements.

10. **Set a control's maturity level.** Go to `/controls` → pick any
    control row → in its new "Maturity:" sub-row, change the level (e.g.
    to "Developing"), add a maturity note → Save. Confirm it persists on
    reload. Confirm the "Governance maturity by NIST Function" table at
    the top of `/controls` now shows that control's Function with
    assessedCount incremented and a non-null average score.

11. **Assessments dashboard sanity check.** Go to `/assessments`. Confirm
    the numbers match what you did above: activity count, DPIA
    recommended-not-started count, DPIA in-progress/completed counts,
    transfer-gap count, and the maturity-by-function table (should match
    `/controls`'s copy of the same table). Click each card and confirm it
    links to the right page.

12. **Tenant isolation spot-check (optional but recommended given no RLS
    yet).** If you have a second org/account, confirm its `/ropa`,
    `/transfers`, and `/assessments` pages show zero/empty state, not the
    first org's data.

Report back anything that doesn't match — especially step 7's live-vs-
snapshot behavior and step 5/6's completed/reopen state, since those are
the two most novel state-machine behaviors from this phase.
