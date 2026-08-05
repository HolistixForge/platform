#!/bin/bash
# =============================================================================
# ganymede-apple.sh — Ganymede and its database, on Apple `container`
# =============================================================================
# The platform's Linux provisioning is Ansible and systemd. A Mac host has
# neither, and Docker is not the answer here either: Apple `container` is the
# macOS engine, so the services a developer needs in front of them run in it.
#
#   ./ganymede-apple.sh up       Postgres + schema + Ganymede, from nothing
#   ./ganymede-apple.sh seed     a project, its GitHub org link, two images
#   ./ganymede-apple.sh status   where everything is listening
#   ./ganymede-apple.sh logs     Ganymede's output
#   ./ganymede-apple.sh down     remove both containers, keep the network
#
# `up` is destructive: the schema starts with `DROP SCHEMA public CASCADE`, so
# every run empties the database. Re-run `seed` after it.
#
# What this is for: until now nothing in this repository had ever run against a
# real Ganymede — the container broker's catalogue lookup, the runner's
# enrolment and the image resolution path were all exercised against stubs. One
# command that stands the real thing up is what turns "unit-tested" into
# "answered a request".
#
# Two containers on one network, because a database is not a thing to bind on
# the host: Postgres never leaves `holistix_dev`.

set -uo pipefail

NET=holistix_dev
PG=hx-postgres
GANY=hx-ganymede
DB=ganymede_apple
DB_USER=ganymede_app_apple
DB_PASSWORD="${GANYMEDE_APPLE_DB_PASSWORD:-applepass123}"
PORT=6870
STATE="${HOME}/.holistix-apple"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
BUNDLE_DIR="${REPO_ROOT}/dist/packages/app-ganymede"

GREEN='\033[0;32m'; RED='\033[0;31m'; GRAY='\033[0;90m'; NC='\033[0m'
ok()   { printf "  ${GREEN}✓${NC} %s\n" "$1"; }
ko()   { printf "  ${RED}✗${NC} %s\n" "$1"; }
note() { printf "  ${GRAY}%s${NC}\n" "$1"; }

command -v container >/dev/null || {
  echo "Apple 'container' is not installed — https://github.com/apple/container"
  exit 1
}
container system status >/dev/null 2>&1 || {
  echo "The container service is not running. Start it with:"
  echo "  container system start"
  echo
  echo "Note that the first start is interactive: it offers to install the"
  echo "guest kernel and waits, writing nothing. Run it in a terminal once."
  exit 1
}

ip_of() {
  container inspect "$1" 2>/dev/null | python3 -c '
import json, sys
try: doc = json.load(sys.stdin)[0]
except Exception: sys.exit(0)
nets = doc.get("status", {}).get("networks") or []
print(nets[0]["ipv4Address"].split("/")[0] if nets else "")
'
}

wait_for() {
  local what="$1" tries="${2:-30}"
  for _ in $(seq 1 "$tries"); do
    eval "$what" >/dev/null 2>&1 && return 0
    sleep 2
  done
  return 1
}

up_postgres() {
  container network create "$NET" >/dev/null 2>&1
  if [ -n "$(ip_of "$PG")" ]; then
    ok "Postgres already up at $(ip_of "$PG")"
    return 0
  fi
  container delete --force "$PG" >/dev/null 2>&1
  container run --detach --name "$PG" --network "$NET" \
    --cpus 2 --memory 1024m \
    -e POSTGRES_PASSWORD=devpassword -e POSTGRES_USER=postgres \
    -e POSTGRES_DB=postgres \
    -- docker.io/library/postgres:16-alpine >/dev/null 2>&1

  wait_for "container exec $PG pg_isready -U postgres" 30 \
    && ok "Postgres up at $(ip_of "$PG")" \
    || { ko "Postgres did not come up"; return 1; }
}

apply_schema() {
  # Same order as create-env.sh, and for the same reason: the schema files were
  # never brought back up to date as migrations landed, so a database built
  # from schema/ alone has no project_networks table and none of the GitHub App
  # columns. Migrations before procedures, because a procedure written against
  # a column added by a migration cannot be created until the column is.
  container exec "$PG" psql -U postgres -c "CREATE DATABASE ${DB};" >/dev/null 2>&1
  container exec "$PG" psql -U postgres -d "$DB" -c "
    DO \$\$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${DB_USER}') THEN
        CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';
      ELSE
        ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';
      END IF;
    END \$\$;
    GRANT CONNECT ON DATABASE ${DB} TO ${DB_USER};" >/dev/null 2>&1

  container cp "${REPO_ROOT}/packages/app-ganymede/database" "${PG}:/tmp/db" >/dev/null 2>&1
  for dir in schema migrations procedures; do
    container exec "$PG" sh -c \
      "for f in \$(ls /tmp/db/${dir}/*.sql 2>/dev/null | sort); do psql -U postgres -d ${DB} -q -f \$f >/dev/null 2>&1 || echo FAILED \$f; done" \
      2>/dev/null | grep FAILED && ko "some ${dir} scripts failed"
  done

  container exec "$PG" psql -U postgres -d "$DB" -c "
    GRANT USAGE, CREATE ON SCHEMA public TO ${DB_USER};
    GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO ${DB_USER};
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO ${DB_USER};
    GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${DB_USER};
    GRANT EXECUTE ON ALL PROCEDURES IN SCHEMA public TO ${DB_USER};
    ALTER USER ${DB_USER} SET search_path TO public;" >/dev/null 2>&1

  local tables
  tables=$(container exec "$PG" psql -U postgres -d "$DB" -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null | tr -d ' \r')
  [ "${tables:-0}" -ge 20 ] \
    && ok "schema applied — ${tables} tables" \
    || { ko "schema looks incomplete (${tables:-0} tables)"; return 1; }
}

stage_bundle() {
  [ -f "${BUNDLE_DIR}/main.js" ] || {
    ko "Ganymede is not built. Run:"
    note "NX_DAEMON=false npx nx build @holistix-forge/app-ganymede"
    return 1
  }
  mkdir -p "$STATE"
  cp -R "${BUNDLE_DIR}/"* "$STATE/"

  [ -f "${STATE}/jwt.key" ] || {
    openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 \
      -out "${STATE}/jwt.key" 2>/dev/null
    openssl rsa -pubout -in "${STATE}/jwt.key" -out "${STATE}/jwt.pub" 2>/dev/null
  }
  chmod 600 "${STATE}/jwt.key"

  local pgip
  pgip=$(ip_of "$PG")

  # A GitHub App configured by hand survives a redeploy. Rewriting the env file
  # from the template is what `up` does, and silently dropping these turned the
  # image route back into a 503 that read like a regression in whatever had
  # just been rebuilt.
  local keep=""
  if [ -f "${STATE}/ganymede.env" ]; then
    keep=$(grep -E '^GITHUB_APP_(ID|SLUG|PRIVATE_KEY_B64)=' "${STATE}/ganymede.env" 2>/dev/null)
  fi

  # Two of these are JSON and not strings, which is not obvious from their
  # names and costs a confusing 500 on the first request rather than a refusal
  # at startup: GANYMEDE_SERVER_BIND and ALLOWED_ORIGINS are both JSON.parse'd.
  python3 - "$pgip" "$STATE" "$DB" "$DB_USER" "$DB_PASSWORD" "$PORT" <<'PY'
import base64, pathlib, sys
pgip, state, db, user, password, port = sys.argv[1:7]
d = pathlib.Path(state)
env = {
  'FRONTEND_FQDN': 'apple.local',
  'GANYMEDE_FQDN': 'ganymede.apple.local',
  'GANYMEDE_SERVER_BIND': '[{"host":"0.0.0.0","port":%s}]' % port,
  'ALLOWED_ORIGINS': '["https://apple.local"]',
  'PG_HOST': pgip, 'PG_PORT': '5432',
  'PG_DATABASE': db, 'PG_USER': user, 'PG_PASSWORD': password,
  'GITHUB_CLIENT_ID': 'unset', 'GITHUB_CLIENT_SECRET': 'unset',
  'GITLAB_CLIENT_ID': 'unset', 'GITLAB_CLIENT_SECRET': 'unset',
  'LINKEDIN_CLIENT_ID': 'unset', 'LINKEDIN_CLIENT_SECRET': 'unset',
  'DISCORD_CLIENT_ID': 'unset', 'DISCORD_CLIENT_SECRET': 'unset',
  'MAILING_HOST': 'localhost', 'MAILING_PORT': '1025',
  'MAILING_USER': 'unset', 'MAILING_PASSWORD': 'unset',
  'SESSION_COOKIE_KEY': 'apple-session-key-not-for-production',
}
# An env file is KEY=VALUE per line, so a PEM cannot travel in one. They go
# base64'd and start.sh decodes them inside the guest.
lines = ['%s=%s' % kv for kv in env.items()]
for name in ('PRIVATE', 'PUBLIC'):
    pem = (d / ('jwt.key' if name == 'PRIVATE' else 'jwt.pub')).read_text()
    lines.append('JWT_%s_KEY_B64=%s' % (name, base64.b64encode(pem.encode()).decode()))
(d / 'ganymede.env').write_text('\n'.join(lines) + '\n')
PY

  if [ -n "$keep" ]; then
    printf '%s\n' "$keep" >> "${STATE}/ganymede.env"
    note "kept the GitHub App settings already staged here"
  fi

  cat > "${STATE}/start.sh" <<'EOS'
#!/bin/sh
export JWT_PRIVATE_KEY=$(echo "$JWT_PRIVATE_KEY_B64" | base64 -d)
export JWT_PUBLIC_KEY=$(echo "$JWT_PUBLIC_KEY_B64" | base64 -d)
if [ -n "${GITHUB_APP_PRIVATE_KEY_B64:-}" ]; then
  export GITHUB_APP_PRIVATE_KEY=$(echo "$GITHUB_APP_PRIVATE_KEY_B64" | base64 -d)
fi
exec node /app/main.js
EOS
  chmod +x "${STATE}/start.sh"
  ok "bundle and configuration staged in ${STATE}"
}

up_ganymede() {
  container delete --force "$GANY" >/dev/null 2>&1
  container run --detach --name "$GANY" --network "$NET" \
    --cpus 2 --memory 1024m \
    --env-file "${STATE}/ganymede.env" \
    -v "${STATE}:/app" -w /app \
    -- docker.io/library/node:22-alpine sh /app/start.sh >/dev/null 2>&1

  local ip
  wait_for "container logs $GANY 2>&1 | grep -q 'server listening'" 20 || {
    ko "Ganymede did not start — container logs $GANY"
    return 1
  }
  ip=$(ip_of "$GANY")
  ok "Ganymede up at http://${ip}:${PORT}"
}


# A catalog with something in it, and something that should be refused.
#
# The point is the second image. `resolveForBroker` checks that an entry lives
# under the GitHub organization its project is bound to, *before* any call to
# GitHub — so a project cannot have the platform fetch another organization's
# private image on its behalf. That check had been in the design since stage 2
# and had never once executed; this is what runs it.
#
#   acme:etl       ghcr.io/acme/etl        legal, project is bound to `acme`
#   other:private  ghcr.io/otherorg/…      registered by the same project, and
#                                          refused: 403, before any network call
seed_catalogue() {
  local sql="/tmp/holistix-seed-$$.sql"
  cat > "$sql" <<'SQL'
INSERT INTO users (user_id, type, username, email)
VALUES ('11111111-1111-1111-1111-111111111111','local','apple-test','apple@test.local')
ON CONFLICT DO NOTHING;
INSERT INTO organizations (organization_id, owner_user_id, name)
VALUES ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','apple-org')
ON CONFLICT DO NOTHING;
INSERT INTO projects (project_id, organization_id, name, github_organization)
VALUES ('33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222','apple-project','acme')
ON CONFLICT (project_id) DO UPDATE SET github_organization = EXCLUDED.github_organization;
INSERT INTO github_app_installations (installation_id, account_login)
VALUES (987654,'acme') ON CONFLICT (installation_id) DO NOTHING;
INSERT INTO project_container_images (project_id, image_id, image_name, image_uri, image_tag, image_sha256)
VALUES ('33333333-3333-3333-3333-333333333333','acme:etl','Acme ETL','ghcr.io/acme/etl','1.4.0',repeat('a',64))
ON CONFLICT (project_id, image_id) DO UPDATE SET image_uri = EXCLUDED.image_uri;
INSERT INTO project_container_images (project_id, image_id, image_name, image_uri, image_tag, image_sha256)
VALUES ('33333333-3333-3333-3333-333333333333','other:private','Someone elses','ghcr.io/otherorg/private','1.0.0',repeat('b',64))
ON CONFLICT (project_id, image_id) DO UPDATE SET image_uri = EXCLUDED.image_uri;
SQL
  # Through a file, not a heredoc: `container exec` does not forward stdin, so
  # a piped script is silently discarded and every statement quietly missing.
  container cp "$sql" "${PG}:/tmp/seed.sql" >/dev/null 2>&1
  container exec "$PG" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -f /tmp/seed.sql >/dev/null 2>&1 \
    && ok "catalog seeded — project 33333333-…, images acme:etl and other:private" \
    || ko "seeding failed"
  rm -f "$sql"
  note "PROJECT=33333333-3333-3333-3333-333333333333"
}

case "${1:-up}" in
  up)
    echo "Postgres"
    up_postgres || exit 1
    apply_schema || exit 1
    echo
    echo "Ganymede"
    stage_bundle || exit 1
    up_ganymede || exit 1
    echo
    "$0" status
    ;;
  status)
    echo "============================================="
    printf "Postgres   %s\n" "$(ip_of "$PG"):5432 ${DB}"
    printf "Ganymede   http://%s:%s\n" "$(ip_of "$GANY")" "$PORT"
    printf "State      %s\n" "$STATE"
    echo "============================================="
    note "The internal routes the broker needs are gateway-token protected;"
    note "mint one with the RS256 key in ${STATE}/jwt.key."
    ;;
  seed)   seed_catalogue ;;
  logs)   container logs "$GANY" ;;
  down)
    container delete --force "$GANY" "$PG" >/dev/null 2>&1
    ok "removed"
    ;;
  *) echo "usage: $0 [up|seed|status|logs|down]"; exit 1 ;;
esac
