#!/bin/bash
# Runs once, when the database volume is first created. Creates the NON-superuser runtime role (RLS applies to it)
# before the migrations run, so the default privileges in roles.sql cover every table the migrations create.
set -euo pipefail
sed "s/CHANGE_ME/${APP_DB_PASSWORD}/" /roles.sql | psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"
