# Deploy: GitHub -> home staging -> Hostinger VPS

`.github/workflows/ci-cd.yml` runs on every push:

1. **staging** (self-hosted runner on the home server): builds the image, pushes it to GHCR tagged with the commit SHA, starts a throwaway stack in k3s (own Postgres, migrations, demo seed), runs the API tests and the Playwright e2e scripts, then deletes the namespace.
2. **production** (main only, only if staging passed): copies `deploy/prod/*` to the VPS and runs `deploy.sh`. It pulls the exact image that passed staging, migrates Supabase, starts the app and rolls back to the previous image if the health check fails.

Staging never touches Supabase. Production uses Supabase for database and storage (`STORAGE_DRIVER=s3`). Vercel is no longer used on this path (`vercel.json` and `api/` stay for the old demo).

## One-time setup

**Home server**
- k3s installed; `kubectl get ns` works for the runner user (copy `/etc/rancher/k3s/k3s.yaml` to `~/.kube/config`).
- Docker, `openssl`, and the libraries Playwright needs (`npx playwright install-deps chromium`, once, as root).
- GitHub self-hosted runner with labels `self-hosted, linux, staging`. Keep the repo private; the workflow triggers on `push` only.
- Repo setting: Actions > Workflow permissions > read and write (so `GITHUB_TOKEN` can push to GHCR).

**Hostinger VPS** (must be a VPS, not shared hosting)
- Docker + Compose plugin. `mkdir -p /opt/iloop`, a deploy user in the `docker` group.
- `docker login ghcr.io` once, with a personal access token that has only `read:packages`.
- `/opt/iloop/.env`: copy `.env.example`, then set at least:
  - `NODE_ENV=production`, `COOKIE_SECURE=true`, `TRUST_PROXY=1`
  - `DOMAIN=app.example.com` (DNS A record pointing at the VPS); `APP_URL` and `CORS_ORIGIN` = `https://app.example.com`
  - `DATABASE_URL` (Supabase transaction pooler, `app_runtime` role) and `DIRECT_URL` (see below)
  - `JWT_ACCESS_SECRET`, `STORAGE_DRIVER=s3` and the `S3_*` values (`CRON_SECRET` is Vercel only)
  - leave `HOLD_SWEEP_SECONDS`, `EMAIL_SEND_SECONDS`, `INTEGRATION_WORKER_SECONDS` on: the jobs run inside the process
- Supabase database set up as in the README (migrations, `prisma/sql/roles.sql`).
- **`DIRECT_URL` for migrations: use the Supabase *session pooler* string (port 5432 on the `pooler.supabase.com` host).** The direct `db.<ref>.supabase.co` host is IPv6-only unless you pay for the IPv4 add-on, and many VPSs are IPv4-only.

**GitHub** (Settings > Secrets and variables > Actions; also create an Environment named `production`, optionally with required reviewers)
- `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` (a key used only for deploys), `VPS_KNOWN_HOSTS` (output of `ssh-keyscan -t ed25519 <host>`, checked against the real fingerprint).

## Run only one app instance
Background jobs run inside the app process. Do not scale `app` above one container on the VPS, or each copy runs the sweeper and mailer.

## Rollback
`/opt/iloop/.current` holds the running image. To go back: `IMAGE=ghcr.io/<owner>/<repo>:<old-sha> ./deploy.sh`. Migrations are not reverted, so write them backward compatible.
