# Phase 2 Test Script — Business Obligations + Cyber Controls

Already verified once end-to-end (PRD Appendix B), including evidence upload. Re-run to confirm it's still solid, especially since drizzle-orm was bumped afterward.

## 1. Business Obligations
- [ ] Go to `/obligations` (using the test org from the Phase 1 script, after it has an analyzed scope)
- [ ] Confirm obligation rows appear — one per obligation text per in-scope regulation
- [ ] Change one row's status to "In progress," set an owner and a due date, save
- [ ] Reload the page — confirm the change persisted
- [ ] Attach a small test file as evidence on that row — confirm it shows a download link, uploaded-by info, and size
- [ ] Go back to `/scope`, remove a regulation from scope (edit profile, re-analyze) — confirm that regulation's obligation rows are still visible on `/obligations`, flagged as "no longer in current scope" rather than deleted
- [ ] Go back to `/scope`, add a **new** regulation into scope (edit profile again) — confirm `/obligations` picks up its new obligation rows without duplicating or resetting any existing row's status/owner/notes

## 2. Cyber Controls
- [ ] Go to `/controls`
- [ ] Confirm the NIST CSF 2.0 control library is seeded (6 Functions, 22 Categories) — this seeds itself on first visit if it hasn't already
- [ ] Change one control's status to "Partial" or "Implemented," add an evidence note, set a "last tested" date, save
- [ ] Reload — confirm it persisted
- [ ] Attach a test file as evidence on a control — confirm it shows correctly (download link, size, upload date)
- [ ] Spot-check one control's "relevant regulation groups" tag against your own judgment — remember this is flagged in the UI as an indicative, non-legally-reviewed guess, not a verified mapping, so a loose match is expected, not a bug

## 3. Evidence upload edge cases
- [ ] Try uploading a file with no file selected — confirm you get a clear error, not a silent failure or a blank crash (this is a **known gap** — it currently surfaces as Next's generic error page, not an inline message, so seeing that generic page here is expected, not a new bug)
- [ ] Try uploading something over 8MB — same expectation, a clear-but-generic error page

---
Nothing here should surprise you if Phase 2 is still healthy. The one item worth actually watching closely is the Obligations sync behavior in step 1 (add/remove scope) — that's the part with real logic behind it, not just CRUD.
