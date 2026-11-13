#!/usr/bin/env bash
# Runs on the VPS in /opt/iloop. Usage: IMAGE=ghcr.io/owner/repo:sha ./deploy.sh
# Migrates Supabase first (a failed migration stops here, the old app keeps running), then swaps the app and rolls back if it is not healthy.
set -euo pipefail
cd "$(dirname "$0")"
: "${IMAGE:?}"
prev=$(cat .current 2>/dev/null || true)

docker compose pull app migrate
docker compose run --rm migrate
docker compose up -d --remove-orphans

for _ in $(seq 1 30); do
  [ "$(docker inspect -f '{{.State.Health.Status}}' iloop-app)" = healthy ] && { echo "$IMAGE" > .current; echo "deployed $IMAGE"; exit 0; }
  sleep 4
done

echo "unhealthy after deploy, rolling back to ${prev:-none}" >&2
docker compose logs --tail 80 app >&2 || true
[ -n "$prev" ] && IMAGE="$prev" docker compose up -d app
exit 1
