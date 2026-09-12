# Phase 1 Test Script — Regulatory Management

Already verified once end-to-end (PRD Appendix A), but re-run this any time you want to confirm it's still solid — especially after any dependency bump (like the drizzle-orm/drizzle-kit update) or before showing the app to anyone else.

## 1. Signup / login
- [ ] Go to `/signup`, create a fresh test org (don't reuse an existing one — you want a clean profile/scope run)
- [ ] Confirm it redirects you in, logged in, no error
- [ ] Log out (top-right in Nav), log back in at `/login` with the same credentials
- [ ] Confirm login works and lands you back in the app

## 2. Profile intake
- [ ] Go to `/profile`
- [ ] Fill in a profile you know the expected outcome for — e.g.: revenue high enough to trip CCPA/CPRA thresholds, California selected as a US state, at least one EU country selected, industry = general commerce, data types = PII + one sensitive category (health or biometric)
- [ ] Save & analyze

## 3. Scope output sanity check
- [ ] Go to `/scope`
- [ ] Confirm GDPR shows in-scope (from the EU jurisdiction pick)
- [ ] Confirm CCPA/CPRA shows in-scope (from CA + revenue/consumer thresholds)
- [ ] Confirm always-applicable US federal regs (FTC Act, ADA Title III) show in-scope regardless of profile specifics
- [ ] Confirm the "watch" bucket is populated with near-miss state laws (e.g. states you didn't select but that have comprehensive privacy laws)
- [ ] Change one profile field (e.g. remove California) and re-analyze — confirm the scope list actually changes and a **new** scope run is recorded (not overwritten — check this doesn't silently replace history if you have any Obligations/DSAR data tied to the old run)

## 4. Re-verify after this session's changes
- [ ] Since Phase 1 was last verified, `drizzle-orm`/`drizzle-kit` were upgraded (CVE fix) — confirm this flow still works with no regression (steps 1–3 above cover this)

---
Nothing here should surprise you if Phase 1 is still healthy — this is a regression check, not new territory. Flag anything that doesn't match what you'd expect from your own profile input.
