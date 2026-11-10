# Follow-up list

Written 2026-11-10 after the Ops Board and Guest Concierge build; updated the same day after the sign-in fix and test reset. Items are ordered by how much they block a real launch.

## Must do before real use
1. **Run on a real Supabase project.** Only local Postgres 16 has been used. Follow the README checklist, including the `anon` revoke SQL and the REST check. Confirm the pooled connection (port 6543, `pgbouncer=true`) works with the per-request tenant transaction.
2. ~~**Guest sign-in ambiguity.**~~ Done 2026-11-10 (migration `20260105000000_guest_find_stay_email`): an ambiguous sign-in is refused and the guest app asks for the booking email; if that still matches two stays, the guest is told to ask the front desk. Still open: a per-booking guest PIN would be stronger than name + email.
3. **Test the assistant against the live Anthropic API.** Only a mocked call is tested. Check answers in several languages, the 24k context budget, cost and the rate limit.
4. **Real PMS adapters.** OPERA Cloud and VHP are stubs. Needs vendor credentials and sandbox access.
5. **API mailer is log-only.** Booking emails are not sent. Connect SMTP or an email service.
6. **Docker build is unverified**, and `package-lock.json` was generated in a sandbox. Build the image once on a normal machine.

## Tests and quality
7. ~~**Booking tests fail when the dev database is crowded.**~~ Ops tests now cancel their stays afterwards, and I cleaned the dev data; the full suite passed twice in a row (105 of 105). `bookings.test.ts` still leaves bookings on future dates, so use a throwaway test database in CI.
8. ~~**Browser test `integrations: add mock PMS` fails on a reused database.**~~ Confirmed a test-data issue (unique connection per supplier). With the old connection removed, all 23 checks pass. Make the script delete it itself.
9. **Flaky staff-cancel step** in the older `flow.cjs` script, never resolved.
10. Browser scripts are now in `tools/e2e/`; still to do: run them in CI.
11. **OpenAPI request bodies** for integrations, ops and guest are loose objects. Generate them from the zod schemas.

## Features not ported from the original artifacts
12. Ops: checklists, promotions, feedback ratings, guest-access confirmation, front desk and bookings tabs.
13. Ops and Guest UI is English only; the original Ops artifact also had Bahasa Indonesia.
14. Guest app: no push notifications, so progress updates by polling every 20 seconds.
15. Reports show in the supplier staff menu but the API returns 403 for staff; hide the menu item.

## Docs
16. Re-sync the project docs after each change (`ARCHITECTURE.md`, `claude/BOOKING-ARCHITECTURE.md`, `claude/INTEGRATION.md`).
