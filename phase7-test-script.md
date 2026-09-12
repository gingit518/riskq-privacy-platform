# Phase 7 test script — Assisted DSAR Fulfillment (design pass + mock pipeline)

**Read this first:** no real Salesforce/M365/Google Drive account can be
touched in this phase — everything below is testable only with
`CONNECTOR_MOCK_MODE=true` set in Vercel (and the corresponding migration
applied). If you haven't set that yet, set it, redeploy, then run this
script. Also set `CONNECTOR_ENCRYPTION_KEY` (`openssl rand -base64 32`) —
mock connections still pass through real encryption on the way into the
database.

1. **Nav check.** Log in. Confirm "Connectors" now appears in the nav, and
   "Sub-processors" appears on the `/dsar` page's link row.

2. **Connect mock connectors.** Go to `/connectors`. Confirm all three
   (Salesforce, M365, Google Drive) show "(mock)" in their label and a
   "Connect (mock)" button — and the on-page note about mock mode is
   visible. Click "Connect (mock)" for all three. Confirm each now shows
   "Connected — Mock connection (no real account)" with a "Disconnect"
   button.

3. **Run a fulfillment search.** Open (or create) a DSAR request. Scroll to
   the new "Fulfillment — connected systems" section. Confirm three
   "Search {connector}" buttons appear. Click "Search Salesforce (mock)".
   Confirm a run box appears showing status "awaiting_approval" and two
   fake matches (a Contact and a Lead), each showing the requester's email
   baked into the fake data.

4. **Approve one, reject one.** On the two matches from step 3, click
   "Approve" on one and "Reject" on the other. Confirm the approved one now
   shows "approved — pending" and the rejected one shows "rejected."

5. **Execute.** Click "Execute approved." Confirm the approved match's
   status updates to "approved — succeeded: Exported." (or "Deleted." if
   this request's type is Deletion) and the run's audit trail line appears
   at the bottom of the page.

6. **Deletion request + legal hold — the important one.** Create (or find)
   a Deletion-type DSAR request whose requester email matches an active
   row in `/dsar/legal-holds` (add one first if you don't have one). Run a
   mock search on any connector. Confirm the matches default to "proposed:
   delete." Try to Approve one. **Confirm it is refused** — either an error
   surfaces or the decision stays "pending" — because of the active legal
   hold. This is the one behavior in this phase with real liability
   consequences if it's wrong: it must be impossible to approve a delete
   for a requester under an active hold. Look closely here.

7. **Deletion without a hold.** Repeat step 6 with a Deletion request whose
   email has no active hold. Confirm Approve works normally this time, and
   Execute succeeds.

8. **Disconnect.** Back on `/connectors`, disconnect one of the three.
   Confirm it returns to a "Connect (mock)" state, and that any
   already-completed run/matches for that connector on a DSAR request page
   still display correctly (history isn't erased by disconnecting).

9. **Sub-processors.** Go to `/dsar/sub-processors`. Add one (name, contact
   email, data categories). Confirm it appears in the list, and that the
   sample notice template at the bottom renders with placeholder text.
   Retire it, confirm it dims and shows "(retired)," reactivate it.

10. **Real-provider honesty check.** With `CONNECTOR_MOCK_MODE` unset (or
    `false`), reload `/connectors`. Confirm all three connectors now show
    "Not configured for this deployment yet" (assuming you haven't set any
    real `SALESFORCE_CLIENT_ID`/etc.), and clicking "Connect" leads to a
    plain-text page explaining why, not a broken OAuth redirect or a silent
    failure.

Report back anything that doesn't match — especially step 6, since a wrong
answer there is the actual liability scenario this whole phase's design
exists to prevent, not just a UI bug.
