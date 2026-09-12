# DSAR Live Test Script (Phase 3 + 3.1)

Run this once the Neon migrations (0003, 0004), `RESEND_API_KEY`, and `APP_BASE_URL` are all in place and the app has been redeployed. Order matters — steps 1–2 must happen before step 4, or the fan-out/flag tests won't have anything to catch.

Use your own email as the test requester's email throughout (`requesterEmail`) — until you set `EMAIL_FROM` to a verified domain, Resend's sandbox only delivers to the email on your own Resend account, so that's the only address that will actually receive anything in step 8.

## 0. Prerequisites check
- [ ] Neon: `dsar_requests`, `dsar_events`, `dsar_checklist_templates`, `dsar_checklist_items` exist (0003)
- [ ] Neon: `dsar_systems`, `dsar_system_tasks`, `legal_holds`, `dsar_download_tokens` exist, and `evidence_files` has `dsar_request_id`/`is_private` columns (0004)
- [ ] Vercel: `RESEND_API_KEY` and `APP_BASE_URL` set, latest deployment redeployed after adding them
- [ ] App loads at your production URL with no 500s

## 1. Systems Register setup
- [ ] Go to `/dsar/systems`
- [ ] Add 2 test systems (e.g. "Test CRM" / your email as owner, "Test Database" / your email as owner)
- [ ] Confirm both appear in the list, active

## 2. Legal Holds setup
- [ ] Go to `/dsar/legal-holds`
- [ ] Add a hold: subject email = your test email, matter = "Test hold — do not act on"
- [ ] Confirm it appears in the list, active

## 3. Internal DSAR intake
- [ ] Go to `/dsar/new`
- [ ] Submit a request: your name, an email that is **NOT** on the legal hold (e.g. `you+test1@yourdomain.com`), type = Access
- [ ] Confirm it redirects to the request detail page with no error
- [ ] Check: governing regulation and due date shown make sense given your org's actual in-scope regulations (compare to what `/scope` shows as in-scope)

## 4. Systems tasks (fan-out)
- [ ] On that request's detail page, confirm both test systems from step 1 appear under "Systems to check," unchecked
- [ ] Check one off — confirm it auto-saves (no page reload needed) and shows a timestamp

## 5. Checklist
- [ ] Confirm the default checklist for "Access" requests is present
- [ ] Check one item off, uncheck it
- [ ] Scroll to "Audit trail" at the bottom — confirm both the check and uncheck appear as separate `checklist_item_toggled` events

## 6. Legal hold flag
- [ ] Go to `/dsar/new` again, submit a **second** request using the exact email you put on the legal hold in step 2
- [ ] On that request's detail page, confirm the yellow "⚠ Active legal hold matches this requester" banner appears with the matter text

## 7. Identity verification
- [ ] On either test request, click "Mark identity verified"
- [ ] Confirm it updates to show verified + timestamp, and the audit trail logs an `identity_verified` event

## 8. Evidence attach + send response
- [ ] On the first test request (not the legal-hold one), under "Compiled export / evidence files," attach any small test file (a PDF or text file)
- [ ] Confirm it appears in the file list with size/timestamp
- [ ] Click "Send response now"
- [ ] Check the inbox for your Resend account's email — confirm you received an email with a download link
- [ ] Open the link (use an incognito window to simulate the requester having no login) — confirm the page lists your test file and downloading it works
- [ ] Back in the app, confirm the audit trail logged a `response_sent` event mentioning the file count and expiry
- [ ] Confirm the request's status did **NOT** auto-change to "completed" (this is intentional — set it manually next)

## 9. Status change
- [ ] Set that request's status to "Completed" via the status dropdown, save
- [ ] Confirm `closedAt` effectively gets set (dashboard should now count it in avg response time) and a `status_change` event is logged

## 10. Public intake
- [ ] Find your org's slug on the `/dsar` dashboard (shown near the top)
- [ ] In an incognito window, go to `/intake/<your-slug>`
- [ ] Submit a request with no login
- [ ] Confirm it appears on `/dsar` with source "Public intake form"

## 11. Dashboard sanity check
- [ ] Go to `/dsar` — confirm total count includes all test requests, avg response time reflects the one you closed in step 9, and SLA breach rate doesn't error

## Cleanup (optional)
- [ ] Retire the 2 test systems (`/dsar/systems` → Retire) so they don't fan out on real future requests
- [ ] Release the test legal hold (`/dsar/legal-holds` → Release)
- [ ] Leave the test DSAR requests in place — they're real audit-trail rows now; deleting isn't exposed in the UI by design (same append-only rule as the rest of the app)

---
Report back anything that errors, looks wrong, or doesn't match — especially step 3's SLA/due-date math and step 8's email/download-link chain, since those are the newest and least-proven parts of the build.
