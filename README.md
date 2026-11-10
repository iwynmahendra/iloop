# Booking Admin Back Panel

Admin panel for the master data of a multi-supplier booking platform (hotels, trips, transport, clubs, shared data), with login and strict per-supplier data isolation.

| Layer | Tech |
|---|---|
| Web | React 18, Vite, TypeScript, Tailwind, shadcn/ui-style components, TanStack Query |
| API | Node 22, Express 5, TypeScript, zod, OpenAPI at `/api/docs` |
| Database | PostgreSQL (Supabase in production) with Prisma, plus SQL migrations for row level security |
| Auth | JWT access token (15 min, in memory) + rotating refresh token (7 days, httpOnly cookie), bcrypt, lockout after 5 failures |
| Files | local disk or S3-compatible storage |

Architecture, ERDs and design decisions: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Default credentials (demo seed only)

Password for all demo users: **`ChangeMe!2026`** (each user must change it at first sign-in). Change or remove them before any real deployment.

| Role | Email | Sees |
|---|---|---|
| SUPER_ADMIN | `superadmin@example.com` | all suppliers |
| SUPPLIER_ADMIN | `admin@ubud.example` | SUP-0001 Ubud Heritage Co. |
| SUPPLIER_STAFF | `staff@ubud.example` | SUP-0001 (create/edit only, no delete) |
| SUPPLIER_ADMIN | `admin@semi.example` | SUP-0002 Seminyak Coast Group |
| SUPPLIER_STAFF | `staff@semi.example` | SUP-0002 |

`SUP-0000` is the hidden "platform" supplier that owns shared reference data (cities, amenities, categories). Override the seed with `SEED_PASSWORD` and `SEED_SUPER_ADMIN_EMAIL`.

## Quick start with Docker (local database)

```bash
cp .env.docker.example .env      # then edit the three secrets
docker compose up --build
# open http://localhost:4000  (API docs: http://localhost:4000/api/docs)
```

This starts PostgreSQL, applies the migrations, loads the demo seed (`RUN_SEED=false` to skip) and starts one container that serves both the API and the web app. The database has two roles: `postgres` (owner, migrations only) and `app_runtime` (used by the API; not a superuser, so row level security applies).

> The Docker files were written and syntax-checked but could not be built in the environment they were created in (no Docker daemon). If the first build fails, please tell me the error.

## Production with Supabase

1. Create a Supabase project. Note the **direct** connection string (port 5432) and the **pooled** one (port 6543).
2. Apply the migrations as the owner: `DIRECT_URL=<direct url> npx prisma migrate deploy` (or `npm run db:migrate` with `DIRECT_URL` and `DATABASE_URL` set).
3. In the SQL editor, run `prisma/sql/roles.sql` after changing the password. This creates `app_runtime`.
4. Run the API with `DATABASE_URL` = the **pooled** URL for `app_runtime` (`...:6543/postgres?pgbouncer=true`). Never use the `postgres` role at runtime: it can bypass row level security.
5. Seed once if you want demo data: `DIRECT_URL=<direct url> npm run db:seed`. For a real launch, create only the super admin instead (edit `prisma/seed.ts` or insert the user yourself).
6. Serve the web app and `/api` from the **same origin** (the included image does this, or use a reverse proxy). Set `COOKIE_SECURE=true`, `CORS_ORIGIN` to the public URL, `TRUST_PROXY=1` behind one proxy, and a long random `JWT_ACCESS_SECRET`.

## Local development (without Docker)

```bash
npm install                                   # root: installs api + web workspaces
cp .env.example .env                          # fill DATABASE_URL, DIRECT_URL, JWT_ACCESS_SECRET
npx prisma generate
npm run db:migrate && psql "$DIRECT_URL" -f prisma/sql/roles.sql    # edit the password first
npm run db:seed
npm run dev:api                               # http://localhost:4000
npm run dev -w apps/web                       # http://localhost:5173 (proxies /api to :4000)
```

Password-reset emails are only written to the API log in development (`src/mail.ts` is a placeholder: plug in SMTP/SES/Resend).

Booking emails (guest and supplier) are queued in `email_outbox` on every booking and sent by a background sender. Settings: `MAIL_FROM`, `NOTIFY_GUEST_EMAIL`, `NOTIFY_SUPPLIER_EMAIL`, `EMAIL_SEND_SECONDS`. Until a provider is plugged into `src/mail.ts` they are only logged. After pulling new migrations, re-run `prisma/sql/roles.sql` so `app_runtime` gets grants on new tables.

## Environment variables (API)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | runtime connection as `app_runtime` (pooled URL on Supabase) |
| `DIRECT_URL` | owner connection for migrations and seed |
| `JWT_ACCESS_SECRET` | signing key, at least 32 characters |
| `ACCESS_TOKEN_TTL_SECONDS` / `REFRESH_TOKEN_TTL_DAYS` | default 900 / 7 |
| `MAX_FAILED_LOGINS` / `LOCK_MINUTES` | default 5 / 15 |
| `CORS_ORIGIN` | comma-separated exact origins users open (also used for the CSRF origin check) |
| `COOKIE_SECURE`, `COOKIE_DOMAIN`, `TRUST_PROXY` | cookie and proxy settings |
| `STORAGE_DRIVER` | `local` (`UPLOAD_DIR`) or `s3` (`S3_*`, untested) |
| `MAX_UPLOAD_MB` | image size limit, default 5 |

See `.env.example` for the full list.

## Roles

| | SUPER_ADMIN | SUPPLIER_ADMIN | SUPPLIER_STAFF |
|---|---|---|---|
| Scope | all suppliers (optional switcher) | own supplier | own supplier |
| Suppliers, create supplier admins | yes | no | no |
| Users of the supplier | yes | yes | no |
| Create / edit master data | yes | yes | yes |
| Delete / restore | yes | yes | **no** |
| Audit log | yes | own supplier | no |
| Global reference data (countries, currencies) | write | read | read |

Isolation works in two independent layers: the API takes the supplier from the signed JWT only (never from the request body, query or headers), and PostgreSQL row level security enforces the same rule even if application code forgot a filter.

## Tests

The API tests run against a migrated and seeded **test database**, connecting as the non-superuser `app_runtime` role:

```bash
export DATABASE_URL=postgresql://app_runtime:...@localhost:5432/booking_test
npm run test:api
```

40 tests cover: login, lockout, token tampering, CSRF, refresh rotation and theft detection, password reset/change; a supplier never reading or changing another supplier's data through any endpoint (and the same at the database level with raw SQL); staff restrictions; validation, unique codes, soft delete/restore, audit rows, rate-plan overlap, image upload checks and all-or-nothing import. Tests create their own suppliers each run, so use a throwaway database.

There are no automated frontend tests. The UI was checked by hand and with a scripted browser run.

## Project layout

```
prisma/                 schema, migrations (init, RLS, system reads), seed, sql/roles.sql
apps/api/src/           config, db (tenant transaction helper), middleware, modules (auth, suppliers, users, audit, dashboard, media), crud (generic engine), openapi
apps/api/tests/         vitest + supertest
apps/web/src/           pages, components, generated/resources.ts
tools/model-gen/        Python generator: one data model -> Prisma schema, migrations, API and web resource metadata
docker/, Dockerfile, docker-compose.yml
```

### Changing the data model

The data model lives in `tools/model-gen/spec.py`. `python3 tools/model-gen/gen.py && python3 tools/model-gen/genapi.py && python3 tools/model-gen/genweb.py` regenerates the Prisma schema, the init/RLS migrations and both resource files. That is meant for a new project. **Once a database exists, never edit released migrations**: write a new migration (`prisma migrate dev --create-only`, then add the SQL) and keep `spec.py` in sync. Do not use `prisma db push`: it would drop the check constraints, the overlap constraint and the RLS policies, which Prisma cannot express.

## Known limitations

- Soft-deleting a parent (a hotel) does not soft-delete its children.
- Reset emails are not sent (log only) until you add a mail provider.
- S3 storage is untested; images are stored as uploaded (no resizing).
- An access token stays valid up to 15 minutes after a user or supplier is disabled; refresh is blocked immediately.
- Exported CSV/Excel cells that start with `=`, `+`, `-` or `@` get a leading `'` to stop formula injection.
- Rate plans, inventory and schedules are tables, with no calendar view yet.

## Booking module (steps 1 to 3 done: schema and API)

Five booking back-offices (Hotel, Trips, Transport, Club, Operator) are being added on top of this platform. See `docs/BOOKING-ARCHITECTURE.md`.
Done so far: the database (migrations `20260102000000_bookings` and `20260102000001_bookings_rls`), demo bookings, and the booking API (see the **Bookings** section at `/api/docs`). The five web apps come next.

```bash
npm run db:migrate            # applies the booking migrations too
npm run db:seed               # master data and demo users (first time only)
npm run db:seed:bookings      # 8 customers and 23 bookings per demo supplier
npm run gen:bookings          # regenerate the booking migrations and Prisma models from tools/model-gen/bookings.py
```

Booking settings (all optional): `BOOKING_HOLD_MINUTES=60` (how long a pending booking holds stock), `HOLD_SWEEP_SECONDS=60` (0 turns the expiry sweeper off), `BOOKING_TZ_OFFSET_MINUTES=480` (Bali), `TRANSPORT_CLASH_MINUTES=180` (driver and vehicle clash window), `CONCIERGE_HOLD_MINUTES=480` (how long a guest concierge request waits for staff).

## Integrations (PMS, channels, webhooks, API keys)

Design and rules: `docs/INTEGRATION.md`. New migration `20260103000000_integrations`; run `prisma/sql/roles.sql` again after applying it.
Environment: `WEBHOOK_MASTER_KEY` (32+ characters; webhook and inbound secrets are derived from it, falls back to `JWT_ACCESS_SECRET`) and `INTEGRATION_WORKER_SECONDS` (default 15, 0 = off).
Provider secrets (for example `OPERA_CLIENT_SECRET`) are environment variables on the server. A connection stores only the variable name.
The `mock` PMS works with no credentials. `opera-cloud` and `vhp` are stubs until the hotel's credentials and the vendor's API access exist.
