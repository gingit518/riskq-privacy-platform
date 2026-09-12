# Phase 5 test script — Tracking Technologies + Compliance Dashboard

Prereqs: Phase 5 migration (`0006_bitter_sentinel.sql`) applied in Neon. At
least one "Analyze scope" run on `/profile` (any org profile that puts
GDPR and/or CCPA/CPRA in scope makes the consent-tag banner and dashboard
scores more visible) and some Phase 2/3 data (a few obligations marked
done, a few DSAR requests closed) makes the dashboard numbers meaningful —
it'll still load fine with none of that, just showing "n/a" everywhere.

1. **Nav check.** Log in. Confirm "Tracking Tech" and "Compliance" links
   now appear in the nav.

2. **Tracking Technologies consent banner.** Go to `/tracking`. If your
   current scope includes GDPR, CCPA, CPRA, or another regulation on the
   curated list (see `regulations/tracking-consent-tags.ts`), confirm you
   see an amber banner listing which ones. If your scope has none of
   those, or you haven't run "Analyze scope" yet, confirm you see the
   gray "none tagged / haven't analyzed yet" message instead.

3. **Add and retire an entry.** Fill in the "Add a tracking technology"
   form (e.g. name "Google Analytics", category "Analytics", party
   "Third-party") → Add. Confirm it appears in the table. Click "Retire"
   → confirm it shows "(retired)" and dims, but stays in the list (not
   deleted). Click "Reactivate" → confirm it returns to normal.

4. **Compliance Dashboard with no scope run.** If you have a second/fresh
   org with no profile saved yet, visit `/compliance` there and confirm
   it shows "No regulatory scope analyzed yet" rather than erroring.

5. **Compliance Dashboard scoring.** On your main org, go to `/compliance`.
   Confirm: an overall blended score renders at the top with a
   color-coded background (green ≥80%, amber 50–79%, red <50%, gray if
   there's nothing to score yet), and a table below breaks it down per
   in-scope regulation with four columns (obligations/DSAR SLA/controls/
   blended). Spot-check one regulation's numbers against what you already
   know: e.g. if you've marked half of GDPR's obligations "done" on
   `/obligations`, GDPR's obligations column here should read ~50%.

6. **Confirm the "n/a" behavior, not false zeros.** Pick a regulation with
   no obligations tracked yet (or no closed DSAR requests governed by it).
   Confirm its corresponding column reads "n/a", not "0%" — a missing
   signal should never look like a failing one.

7. **CSV export.** Click "Export CSV" → confirm a file downloads (browser
   dependent) named `compliance-report-<date>.csv`, and that opening it
   shows the same rows/numbers as the on-screen table, plus an "Overall
   score" row at the bottom.

8. **PDF export.** Click "Export PDF" → confirm a file downloads named
   `compliance-report-<date>.pdf` and opens cleanly (this is the one item
   in this phase I couldn't verify against a live database myself, since
   this sandbox has no DB connection — the PDF generation itself was
   tested standalone and the report layout was written but never rendered
   against real data, so look closely here for anything that looks off:
   truncated text, misaligned numbers, missing regulations).

9. **"Recent activity" label.** Scroll to the bottom of `/compliance` and
   confirm the "Recent activity (DSAR only)" section shows your latest
   DSAR events (or "No DSAR activity yet" if none) — and that it's
   clearly labeled DSAR-only, not implied to cover Obligations/Controls
   too.

10. **Tenant isolation spot-check (optional, same caveat as every prior
    phase given no RLS yet).** If you have a second org, confirm its
    `/tracking` and `/compliance` show only its own data.

Report back anything that doesn't match — especially step 8 (PDF), since
it's the one piece of this phase that was never actually run against real
data before shipping to you.
