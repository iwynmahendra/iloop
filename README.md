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
6. Serve the admin apps and `/api` from the **same origin** (the included image does this: the API mounts each app at `/hotel/`, `/trips/`, `/transport/`, `/club/`, `/operator/`, `/ops/`, `/guest/` from `apps/<name>/dist`; `WEB_ROOT` changes the folder). One login works in all five because the session cookies are shared on the origin. Set `COOKIE_SECURE=true`, `CORS_ORIGIN` to the public URL, `TRUST_PROXY=1` behind one proxy, and a long random `JWT_ACCESS_SECRET`.

### Supabase setup checklist

- [ ] Project created; direct (5432) and pooled (6543) connection strings saved.
- [ ] `DIRECT_URL=<direct> npx prisma migrate deploy` ran without errors.
- [ ] `prisma/sql/roles.sql` run in the SQL editor with a **new** `app_runtime` password (re-run after every new migration).
- [ ] API uses `DATABASE_URL` = pooled URL as `app_runtime`, with `?pgbouncer=true`. Never the `postgres` role.
- [ ] Supabase's own Data API is closed to these tables. Either turn off the Data API (Project Settings, API), or run this in the SQL editor:

  ```sql
  REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
  REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
  REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
  ```

  The API connects as `app_runtime`, so this does not affect it. Re-run it after new migrations if default privileges were not set.
- [ ] Check it: `curl "https://<ref>.supabase.co/rest/v1/bookings?select=id" -H "apikey: <anon key>"` must return an error or an empty list, never rows.
- [ ] `CORS_ORIGIN` = the public URL, `COOKIE_SECURE=true`, a long random `JWT_ACCESS_SECRET`.
- [ ] Optional demo data: `npm run db:seed` and `npm run db:seed:ops` (use `DIRECT_URL`).
- [ ] Turn on Supabase backups (point-in-time recovery needs a paid plan).

Not yet tested against a real Supabase project: only local Postgres 16 has been used, so run the check above once.

### Demo on Vercel (Hobby) + Supabase

`vercel.json` deploys everything to one Vercel project: the API runs as one serverless function (`api/index.js`), and the seven web apps are static files under `/<app>/` on the same domain (the auth cookies are `SameSite=Strict`, so this matters). Vercel has no background timers, so Supabase `pg_cron` calls `/api/v1/cron/run` once a minute instead. That endpoint runs the hold sweeper, email sender and integration worker once.

1. Supabase: follow the checklist above (migrations, `roles.sql`, Data API closed, seed). Set the database timezone to UTC (the default).
2. Supabase Storage: create a **public** bucket (e.g. `media`). Under Storage, Settings, S3 Connection, create an access key.
3. Vercel: import the repo with no framework preset. `vercel.json` sets the build. Add these env vars (Production):

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | pooled URL as `app_runtime` (`...pooler.supabase.com:6543/postgres?pgbouncer=true`) |
| `DIRECT_URL` | direct URL (only Prisma reads it; the app does not connect with it) |
| `JWT_ACCESS_SECRET`, `CRON_SECRET` | two different random strings, 32+ characters (`openssl rand -base64 48`) |
| `COOKIE_SECURE` | `true` |
| `TRUST_PROXY` | `1` |
| `CORS_ORIGIN`, `APP_URL` | `https://<project>.vercel.app` |
| `STORAGE_DRIVER` | `s3` |
| `S3_ENDPOINT` | `https://<ref>.supabase.co/storage/v1/s3` |
| `S3_REGION` | the project region shown on the S3 Connection page |
| `S3_BUCKET` | `media` |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | the key from step 2 |
| `S3_PUBLIC_URL` | `https://<ref>.supabase.co/storage/v1/object/public/media` |
| `MAX_UPLOAD_MB`, `VITE_MAX_UPLOAD_MB` | `4` (Vercel rejects request bodies over 4.5 MB) |
| `ANTHROPIC_API_KEY` | optional, for the guest assistant |

4. After the first deploy, schedule the jobs in the Supabase SQL editor (Database, Extensions: enable `pg_cron` and `pg_net`):

```sql
select cron.schedule('booking-jobs', '* * * * *', $$
  select net.http_post(
    url := 'https://<project>.vercel.app/api/v1/cron/run',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>'),
    body := '{}'::jsonb
  );
$$);
```

Check it with `select * from cron.job_run_details order by start_time desc limit 5;` and `select * from net._http_response order by created desc limit 5;` (status 200).

Differences from the Docker setup: the jobs run every minute instead of every 10 to 60 seconds; the rate limit counts per function instance; a request may take at most 60 seconds. The Hobby plan is for non-commercial use only. For real use, move to Vercel Pro or run the Docker image.

### Ops board and Guest concierge

- `apps/ops` (staff, `/ops/`) uses the admin shell and the same login. API: `/api/v1/ops/*` (tasks, guest requests with SLA, rooms, room dining, knowledge base, staff, shift notes, overview alerts).
- `apps/guest` (guests, `/guest/`) is a separate mobile app. A guest signs in with booking number + last name; the booking must be CONFIRMED and between the day before check-in and check-out (SQL function `guest_find_stay`). The token (`GUEST_TOKEN_HOURS`, default 12) only works on `/api/v1/guest/*`. Requests and orders need a room number, so check the guest in first.
- Assistant: set `ANTHROPIC_API_KEY` (and optionally `ASSISTANT_MODEL`) to answer in the guest's language from the hotel's knowledge base. Without the key it falls back to keyword search over the same documents. Voice uses the browser's Web Speech API (Chrome, Edge, Safari; not Firefox).
- After pulling this change run `npx prisma migrate deploy`, re-run `prisma/sql/roles.sql`, then `npm run db:seed:ops` for demo staff, rooms, menu and knowledge documents.

## Local development (without Docker)

```bash
npm install                                   # root: installs the api, the shared kit and the five admin apps
cp .env.example .env                          # fill DATABASE_URL, DIRECT_URL, JWT_ACCESS_SECRET
npx prisma generate
npm run db:migrate && psql "$DIRECT_URL" -f prisma/sql/roles.sql    # edit the password first
npm run db:seed
npm run dev:api                               # http://localhost:4000
npm run dev:hotel       # http://localhost:5171  (each app proxies /api to :4000)
npm run dev:trips       # http://localhost:5172
npm run dev:transport   # http://localhost:5173
npm run dev:club        # http://localhost:5174
npm run dev:operator    # http://localhost:5175
npm run dev:ops         # http://localhost:5176  staff Ops board
npm run dev:guest       # http://localhost:5177  guest concierge (needs a checked-in booking)
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
packages/admin-kit/     shared kit: app shell + layout, UI primitives, generated CRUD pages (generated/resources.ts),
                        booking modules (list, detail, dialogs, new-booking shell, reports) and the integrations screens
apps/hotel/             Hotel admin   -> /hotel/      modules: Front desk, Availability, New booking
apps/trips/             Trips admin   -> /trips/      modules: Departures, New booking
apps/transport/         Transport     -> /transport/  modules: Dispatch, New booking
apps/club/              Club admin    -> /club/       modules: Door list, New booking
apps/operator/          Operator      -> /operator/   modules: Overview, Commission, Integration health, Suppliers
apps/ops/               Ops board     -> /ops/        modules: Overview, Tasks, Guest requests, Rooms, Room dining, Knowledge base, Team & handover
apps/guest/             Guest app     -> /guest/      standalone mobile app (no admin shell): sign-in with booking number + last name, services, room dining, assistant with voice
tools/model-gen/        Python generator: one data model -> Prisma schema, migrations, API and web resource metadata
docker/, Dockerfile, docker-compose.yml
```

### Changing the data model

The data model lives in `tools/model-gen/spec.py`. `python3 tools/model-gen/gen.py && python3 tools/model-gen/genapi.py && python3 tools/model-gen/genweb.py` regenerates the Prisma schema, the init/RLS migrations and both resource files (the web one now lands in `packages/admin-kit/src/generated/`). That is meant for a new project. **Once a database exists, never edit released migrations**: write a new migration (`prisma migrate dev --create-only`, then add the SQL) and keep `spec.py` in sync. Do not use `prisma db push`: it would drop the check constraints, the overlap constraint and the RLS policies, which Prisma cannot express.

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
