# Browser checks (Playwright)

Run against a running API that serves the built apps (`npm run build:web`, then start the API with `WEB_ROOT=apps`) and the demo data (`npm run db:seed`, `npm run db:seed:ops`).

```
node tools/e2e/apps.cjs        # five admin apps: login, bookings, check-in, integrations, reports, mobile layout
node tools/e2e/ops-guest.cjs   # Ops board + guest app end to end (guest uses demo booking HTL-2610-0003 / Rossi)
```

Set `SHOTS=<folder>` for screenshots. Needs `playwright` installed. The scripts leave test bookings and one `E2E PMS` connection behind: delete the connection before running `apps.cjs` again (it hits a unique constraint otherwise). Not yet part of CI.
