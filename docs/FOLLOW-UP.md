# Follow-up list

Written 2026-11-10 after the Ops Board and Guest Concierge build (commit 4e5335b). Items are ordered by how much they block a real launch.

## Must do before real use
1. **Run on a real Supabase project.** Only local Postgres 16 has been used. Follow the README checklist, including the `anon` revoke SQL and the REST check. Confirm the pooled connection (port 6543, `pgbouncer=true`) works with the per-request tenant transaction.
2. **Guest sign-in ambiguity.** Booking numbers are unique per supplier only. If two suppliers hold the same number and a matching name, `guest_find_stay` returns the first row. Make it unambiguous (for example add a hotel code or a per-booking guest PIN) and add a test.
3. **Test the assistant against the live Anthropic API.** Only a mocked call is tested. Check answers in several languages, the 24k context budget, cost and the rate limit.
4. **Real PMS adapters.** OPERA Cloud and VHP are stubs. Needs vendor credentials and sandbox access.
5. **API mailer is log-only.** Booking emails are not sent. Connect SMTP or an email service.
6. **Docker build is unverified**, and `package-lock.json` was generated in a sandbox. Build the image once on a normal machine.

## Tests and quality
7. **Booking tests fail when the dev database is crowded** (3 tests, "Not enough Pool Villa rooms"). Reset the test database, or make the tests create their own inventory.
8. **Browser test `integrations: add mock PMS` fails on a reused database** with a 409 (the mock connection already exists), and the next two checks fail after it. Probably a test-data issue; make the script idempotent and rerun. Not confirmed.
9. **Flaky staff-cancel step** in the older `flow.cjs` script, never resolved.
10. **Move the browser scripts into the repo** (they live in a scratch folder) and run them in CI.
11. **OpenAPI request bodies** for integrations, ops and guest are loose objects. Generate them from the zod schemas.

## Features not ported from the original artifacts
12. Ops: checklists, promotions, feedback ratings, guest-access confirmation, front desk and bookings tabs.
13. Ops and Guest UI is English only; the original Ops artifact also had Bahasa Indonesia.
14. Guest app: no push notifications, so progress updates by polling every 20 seconds.
15. Reports show in the supplier staff menu but the API returns 403 for staff; hide the menu item.

## Docs
16. Re-sync the project docs after each change (`ARCHITECTURE.md`, `claude/BOOKING-ARCHITECTURE.md`, `claude/INTEGRATION.md`).
