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
#   ./ganymede-apple.sh restart  re-stage the bundle and re-run, schema untouched
#   ./ganymede-apple.sh down     remove both containers, keep the network
#
# `up` is destructive: the schema starts with `DROP SCHEMA public CASCADE`, so
# every run empties this environment's database — `ganymede_<env>`, and only
# that one, even though one Postgres container holds them all. Re-run `seed`
# after it.
#
# What this is for: until now nothing in this repository had ever run against a
# real Ganymede — the container broker's catalogue lookup, the runner's
# enrolment and the image resolution path were all exercised against stubs. One
# command that stands the real thing up is what turns "unit-tested" into
# "answered a request".
#
# Two containers on Apple's default network. The database is not a thing to
# bind on the host and it does not: only Ganymede publishes a port, and only on
# the loopback. Why the default network rather than one of ours is at NET.

set -uo pipefail

# Same knobs as the other macOS scripts, and the same defaults — setup-nginx.sh
# writes a `proxy_pass` to GANYMEDE_PORT on the loopback, so this is the other
# end of that.
ENV_NAME="${ENV_NAME:-apollo}"
DOMAIN="${DOMAIN:-apollo.test}"
HTTPS_PORT="${HTTPS_PORT:-8443}"
GANYMEDE_PORT="${GANYMEDE_PORT:-6100}"

# Apple's own network, and not one of ours, for two reasons that both came out
# of trying the other way:
#
#   `--publish` is silently ignored on a named network. Measured: the same
#   image published on `default` answers 200, and on a named network the port
#   binds on the host and times out. nginx reaches Ganymede over that port, so
#   Ganymede has to be here.
#
#   A named network stopped carrying traffic mid-session — no route on the
#   host, no reachability between two containers that both held an address on
#   it. Nothing in this harness is worth debugging vmnet for.
#
# The isolation that matters is not weakened: a *user* container still gets a
# private network of its own from the broker. These are platform services, and
# neither binds anywhere but the loopback.
NET=default
PG=hx-postgres
DNS=hx-coredns
# Built from scripts/local-dev/macos/coredns — the official coredns image is
# FROM scratch, so it has no directory for a Corefile to be mounted onto and
# Apple `container` refuses to start it at all.
DNS_IMAGE=hx-coredns:latest
GANY="hx-ganymede-${ENV_NAME}"
# Hyphens out. A container name takes them, an unquoted SQL identifier does not
# — `CREATE DATABASE ganymede_dev-001` is a syntax error — and `dev-001` is the
# name the rest of the repository uses in its examples. create-env.sh:79 does
# the same substitution for the same reason, so the two paths also agree on the
# database name for a given environment.
DB="ganymede_${ENV_NAME//-/_}"
DB_USER="ganymede_app_${ENV_NAME//-/_}"
# The old name is still honoured. It was GANYMEDE_APPLE_DB_PASSWORD before this
# script served an environment rather than a single throwaway, and dropping it
# would silently change the password for anyone who had set it — which shows up
# as an authentication failure with no obvious cause.
DB_PASSWORD="${GANYMEDE_DB_PASSWORD:-${GANYMEDE_APPLE_DB_PASSWORD:-applepass123}}"
# Inside the container. The host sees GANYMEDE_PORT, published on loopback.
PORT=6870
CONF_DIR="${HOME}/.holistix-macos"
STATE="${CONF_DIR}/${ENV_NAME}"
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

net_of() {
  container inspect "$1" 2>/dev/null | python3 -c '
import json, sys
try: doc = json.load(sys.stdin)[0]
except Exception: sys.exit(0)
nets = doc.get("status", {}).get("networks") or []
print(nets[0].get("network", "") if nets else "")
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
  # Reused when it is already up *and on the right network*. An earlier version
  # of this script put it on a named network; the address staged into
  # PG_HOST would then be one Ganymede cannot route to from the default
  # network, and every symptom appears at the first query rather than here.
  # apply_schema would still pass — it goes through `container exec`, not the
  # network — so nothing before the first request would notice.
  local existing_net
  existing_net=$(net_of "$PG")
  if [ -n "$(ip_of "$PG")" ]; then
    if [ "$existing_net" = "$NET" ]; then
      ok "Postgres already up at $(ip_of "$PG")"
      return 0
    fi
    ko "Postgres is on network '${existing_net}', this environment needs '${NET}'"
    note "It holds every environment's database, so removing it is not"
    note "something this script does on its own. When nothing else"
    note "needs it:  container delete --force ${PG}  &&  $0 up"
    return 1
  fi
  container delete --force "$PG" >/dev/null 2>&1
  # A host directory, so the container is not the only copy.
  #
  # One container holds every environment's database. Without a volume, any
  # `container delete --force hx-postgres` — including the one this script
  # suggests a few lines up when the network does not match — destroyed all of
  # them irrecoverably. It costs one line, and it makes the whole class of
  # accident survivable.
  mkdir -p "${CONF_DIR}/postgres"
  container run --detach --name "$PG" --network "$NET" \
    --cpus 2 --memory 1024m \
    -v "${CONF_DIR}/postgres:/var/lib/postgresql/data" \
    -e POSTGRES_PASSWORD=devpassword -e POSTGRES_USER=postgres \
    -e POSTGRES_DB=postgres \
    -e PGDATA=/var/lib/postgresql/data/pgdata \
    -- docker.io/library/postgres:16-alpine >/dev/null 2>&1

  wait_for "container exec $PG pg_isready -U postgres" 30 \
    && ok "Postgres up at $(ip_of "$PG")" \
    || { ko "Postgres did not come up"; return 1; }
}

# A resolver for containers, which is not the same thing as a resolver for this
# Mac.
#
# The host's CoreDNS answers 127.0.0.1 for every platform name, which is where
# nginx is listening — correct on the host, and inside a microVM that address
# is the microVM. Ganymede needs `org-<uuid>.<domain>` to resolve, and cannot
# use /etc/hosts for it because the name is minted per organization at runtime.
#
# So: the same template, answering the container network's gateway instead, in
# a container of its own where port 53 is free and needs no root. One per
# machine — the zone is a wildcard over the whole TLD, so every environment
# gets the same answer from it.
up_dns() {
  local host
  host="$(container inspect "$PG" 2>/dev/null | python3 -c '
import json, sys
try: doc = json.load(sys.stdin)[0]
except Exception: sys.exit(0)
nets = doc.get("status", {}).get("networks") or []
print(nets[0].get("ipv4Gateway", "") if nets else "")
')"
  [ -n "$host" ] || { ko "could not read the network gateway from ${PG}"; return 1; }

  mkdir -p "${CONF_DIR}/coredns-container"
  cat > "${CONF_DIR}/coredns-container/Corefile" <<EOF
${DOMAIN##*.}:53 {
    template IN A {
        answer "{{ .Name }} 60 IN A ${host}"
    }
    template IN AAAA {
        rcode NOERROR
    }
}

.:53 {
    forward . 1.1.1.1 8.8.8.8
    cache 30
}
EOF
  container image ls 2>/dev/null | grep -q '^hx-coredns ' || {
    note "building ${DNS_IMAGE} (alpine plus the coredns binary)"
    ( cd "${REPO_ROOT}/scripts/local-dev/macos/coredns" \
        && container build -t "$DNS_IMAGE" . ) >/dev/null 2>&1 \
      || { ko "could not build ${DNS_IMAGE}"; return 1; }
  }

  # Reused when it is already up. `--dns` is baked into a container when it is
  # created, and this resolver is one per machine while environments are not —
  # so deleting and recreating it on every `up` gives it a new address from
  # Apple's pool and leaves every environment started earlier pointing at one
  # that no longer answers. That looks like the platform being down, in an
  # environment nobody touched.
  #
  # The zone is a wildcard over the whole TLD answering the network gateway, so
  # a running resolver is already correct for any environment; there is nothing
  # per-environment in it to rewrite.
  if [ -n "$(ip_of "$DNS")" ]; then
    ok "CoreDNS for containers already up at $(ip_of "$DNS")"
    return 0
  fi
  container delete --force "$DNS" >/dev/null 2>&1
  container run --detach --name "$DNS" --network "$NET" \
    --cpus 1 --memory 256m \
    -v "${CONF_DIR}/coredns-container:/etc/coredns" \
    -- "$DNS_IMAGE" -conf /etc/coredns/Corefile >/dev/null 2>&1

  local ip
  wait_for "[ -n \"\$(ip_of $DNS)\" ]" 15 || { ko "CoreDNS did not start"; return 1; }
  ip="$(ip_of "$DNS")"
  ok "CoreDNS for containers at ${ip} — *.${DOMAIN##*.} → ${host}"
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
  # The bind-mount source has to exist: Apple `container` does not create a
  # missing one, it refuses to bootstrap at all, and `container run`'s output
  # is discarded — so the only symptom is "Ganymede did not start", pointing
  # at the bundle. setup-nginx.sh happens to create this directory, which is
  # why the order the scripts are run in decided whether `up` worked.
  mkdir -p "$STATE" "${CONF_DIR}/nginx-gateways.d"
  cp -R "${BUNDLE_DIR}/"* "$STATE/"

  [ -f "${STATE}/jwt.key" ] || {
    openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 \
      -out "${STATE}/jwt.key" 2>/dev/null
    openssl rsa -pubout -in "${STATE}/jwt.key" -out "${STATE}/jwt.pub" 2>/dev/null
  }
  chmod 600 "${STATE}/jwt.key"

  local pgip
  pgip=$(ip_of "$PG")

  # Whether this environment is being tunnelled. Set in the environment it
  # wins; unset, whatever is already staged is kept — because this file is
  # rewritten from the template on every restart, and a plain
  # `ganymede-apple.sh restart` silently switching a live tunnel back off would
  # look like the tunnel breaking on its own. tunnel.sh passes it explicitly
  # both ways. See doc/guides/PUBLIC_TUNNEL.md.
  local staged_tunnel=""
  [ -f "${STATE}/ganymede.env" ] && staged_tunnel=$(
    grep '^PUBLIC_TUNNEL=' "${STATE}/ganymede.env" 2>/dev/null | head -1 | cut -d= -f2
  )
  local public_tunnel="${PUBLIC_TUNNEL:-${staged_tunnel:-0}}"

  # A GitHub App configured by hand survives a redeploy. Rewriting the env file
  # from the template is what `up` does, and silently dropping these turned the
  # image route back into a 503 that read like a regression in whatever had
  # just been rebuilt.
  local keep=""
  if [ -f "${STATE}/ganymede.env" ]; then
    keep=$(grep -E '^GITHUB_APP_(ID|SLUG|PRIVATE_KEY_B64)=' "${STATE}/ganymede.env" 2>/dev/null)
  elif [ -f "${HOME}/.holistix-apple/ganymede.env" ]; then
    # The old single-environment location. This directory moved to
    # ~/.holistix-macos/<env> when the script started serving more than one
    # environment, and the preservation above then found nothing on the first
    # run after the move — dropping a GitHub App somebody had configured by
    # hand and turning the image route back into a 503 that reads like a
    # regression in whatever was last rebuilt. Read once, from where it was.
    keep=$(grep -E '^GITHUB_APP_(ID|SLUG|PRIVATE_KEY_B64)=' "${HOME}/.holistix-apple/ganymede.env" 2>/dev/null)
    [ -n "$keep" ] && note "carried the GitHub App settings over from ~/.holistix-apple"
  fi

  # Two of these are JSON and not strings, which is not obvious from their
  # names and costs a confusing 500 on the first request rather than a refusal
  # at startup: GANYMEDE_SERVER_BIND and ALLOWED_ORIGINS are both JSON.parse'd.
  python3 - "$pgip" "$STATE" "$DB" "$DB_USER" "$DB_PASSWORD" "$PORT" \
    "$DOMAIN" "$HTTPS_PORT" "$ENV_NAME" "$CONF_DIR" "$public_tunnel" <<'PY'
import base64, pathlib, sys
(pgip, state, db, user, password, port, domain, https_port, env_name,
 conf_dir, public_tunnel) = sys.argv[1:12]
d = pathlib.Path(state)
# The FQDNs carry the port. `CONFIG.APP_FRONTEND_URL` is `https://${FRONTEND_FQDN}`
# and nginx does not listen on 443 here — binding under 1024 needs root — so a
# name without the port produces links nobody can follow.
host = f'{domain}:{https_port}'
env = {
  'FRONTEND_FQDN': host,
  'GANYMEDE_FQDN': f'ganymede.{host}',
  'GANYMEDE_SERVER_BIND': '[{"host":"0.0.0.0","port":%s}]' % port,
  'ALLOWED_ORIGINS': '["https://%s"]' % host,
  'PG_HOST': pgip, 'PG_PORT': '5432',
  'PG_DATABASE': db, 'PG_USER': user, 'PG_PASSWORD': password,
  'GITHUB_CLIENT_ID': 'unset', 'GITHUB_CLIENT_SECRET': 'unset',
  'GITLAB_CLIENT_ID': 'unset', 'GITLAB_CLIENT_SECRET': 'unset',
  'LINKEDIN_CLIENT_ID': 'unset', 'LINKEDIN_CLIENT_SECRET': 'unset',
  'DISCORD_CLIENT_ID': 'unset', 'DISCORD_CLIENT_SECRET': 'unset',
  'MAILING_HOST': 'localhost', 'MAILING_PORT': '1025',
  'MAILING_USER': 'unset', 'MAILING_PASSWORD': 'unset',
  'SESSION_COOKIE_KEY': 'macos-session-key-not-for-production',
  # Ganymede makes HTTPS calls to itself — it health-checks a gateway it has
  # just allocated at `https://org-<uuid>.<domain>` — and the certificate is
  # mkcert's, which nothing in this container has been told to trust. Node's
  # `fetch` refuses it, the health check swallows the reason and reports the
  # gateway as not ready, and the allocation is rolled back. create-env.sh:289
  # sets exactly this, for exactly this, on the Linux side.
  'NODE_TLS_REJECT_UNAUTHORIZED': '0',
  # Where nginx is, for the server blocks Ganymede writes when it allocates a
  # gateway. Three of these are paths on the *Mac* and not in this container:
  # Ganymede only writes them into a file that nginx then reads. The directory
  # is the one path that is both, through the bind mount below.
  'ENV_NAME': env_name,
  # With the port, like the other FQDNs: Ganymede builds
  # `https://org-<uuid>.<DOMAIN>` from it and follows that link itself when it
  # health-checks a gateway it has just allocated. The one place a port would
  # be wrong — the nginx `server_name` — strips it there.
  'DOMAIN': host,
  'NGINX_GATEWAYS_DIR': '/nginx-gateways.d',
  'NGINX_SSL_CERT': '%s/certs/%s.pem' % (conf_dir, domain),
  'NGINX_SSL_KEY': '%s/certs/%s-key.pem' % (conf_dir, domain),
  'NGINX_LOGS_DIR': '%s/logs' % conf_dir,
  'NGINX_LISTEN_PORT': https_port,
  # `nginx -t` needs the certificates and the main configuration, neither of
  # which exists in here, so the host side tests before it reloads. And no
  # signal reaches a process outside this container — so the reload is asked
  # for through a file nginx-reload.sh watches, and waited for.
  'NGINX_TEST_COMMAND': 'true',
  'NGINX_RELOAD_COMMAND': '/app/request-nginx-reload.sh',
  # Trust the host a request arrived on when it is not one of the names above.
  # Only a tunnel produces such a request; scripts/local-dev/tunnel.sh sets
  # this, and with it at 0 nothing about origin handling changes.
  'PUBLIC_TUNNEL': public_tunnel,
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

  # Asking is not the same as it having happened. Ganymede reloads nginx and
  # immediately health-checks the gateway through it — if the reload has not
  # landed, that request falls through to the default server, which answers
  # 200 for a GET and makes the check pass on the wrong server entirely. The
  # first thing that then notices is the POST handshake, with a 405 from nginx
  # and nothing pointing at the reload.
  #
  # So this waits for the acknowledgement nginx-reload.sh writes, and fails if
  # it does not come — which is also how a configuration the host refuses gets
  # back to the caller, since `nginx -t` can only run over there.
  cat > "${STATE}/request-nginx-reload.sh" <<'EOS'
#!/bin/sh
# One file per request, not one slot.
#
# A token and not a timestamp, because both files land in the same second more
# often than not and `-nt` compares whole seconds — an acknowledgement was
# indistinguishable from none.
#
# And its own file, because a single `.reload` is a single slot: two gateways
# set up moments apart, the second request overwrites the first before the
# watcher has read it, and the first waits ten seconds for a confirmation
# nobody will ever write. nginx did reload; Ganymede is told the reload failed
# and abandons an allocation that was fine.
D=/nginx-gateways.d
TOKEN="$$-$(date +%s)-$(awk "BEGIN{srand();print int(rand()*100000)}")"
mkdir -p "$D/.requests" "$D/.acks" || exit 1
: >"$D/.requests/$TOKEN" || exit 1

# BusyBox `sleep` only takes a fraction when it was built with float support.
# It is in current Alpine, but where it is not this errors on every iteration
# and the loop spins through its hundred turns in milliseconds — reporting a
# ten-second timeout that never happened, which reads as a watcher that is not
# running. Measured once, then fixed to whole seconds.
if sleep 0.1 2>/dev/null; then
  TICK=0.1
  TICKS=100
else
  TICK=1
  TICKS=10
fi

i=0
while [ $i -lt $TICKS ]; do
  # A refusal, not a silence. `nginx -t` can only run on the host, so this file
  # is how its actual complaint gets back here instead of surfacing as a
  # timeout that points at the wrong thing entirely.
  if [ -e "$D/.acks/$TOKEN.err" ]; then
    echo "nginx refused the configuration:" >&2
    cat "$D/.acks/$TOKEN.err" >&2
    rm -f "$D/.acks/$TOKEN.err"
    exit 1
  fi
  [ -e "$D/.acks/$TOKEN" ] && { rm -f "$D/.acks/$TOKEN"; exit 0; }
  sleep "$TICK"
  i=$((i + 1))
done
rm -f "$D/.requests/$TOKEN"
echo "nginx did not acknowledge the reload within 10s — is nginx-reload.sh running?" >&2
exit 1
EOS
  chmod +x "${STATE}/request-nginx-reload.sh"

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

  # After the delete, so this environment's own previous container never counts
  # as the conflict. What it catches is a *second* environment: GANYMEDE_PORT
  # defaults to 6100 for everyone, and two of them cannot both have it. The
  # bind failure lands in `container run`'s output, which is discarded, so
  # without this the only symptom is "Ganymede did not start" — pointing at the
  # bundle rather than at the port.
  # Without `@127.0.0.1`. Qualified by address, `lsof` reports only sockets
  # bound literally to loopback and says nothing about a process listening on
  # 0.0.0.0 for the same port — which is the common shape of a conflicting
  # listener, and precisely the case this guard exists to name.
  #
  # Retried, because the probe runs just after this environment's own container
  # was force-deleted and the runtime tears its host-side forwarder down on its
  # own schedule. Read once, the just-removed listener can still be there, and
  # `up` aborts with "another environment?" having already destroyed this one's.
  local waited=0
  while lsof -nP -iTCP:"${GANYMEDE_PORT}" -sTCP:LISTEN >/dev/null 2>&1; do
    [ "$waited" -ge 5 ] && {
      ko "port ${GANYMEDE_PORT} is already listening — another environment?"
      note "Give this one its own port, and nginx the same one:"
      note "  GANYMEDE_PORT=6101 $0 up"
      return 1
    }
    sleep 1
    waited=$((waited + 1))
  done

  container run --detach --name "$GANY" --network "$NET" \
    --cpus 2 --memory 1024m \
    --publish "127.0.0.1:${GANYMEDE_PORT}:${PORT}" \
    --env-file "${STATE}/ganymede.env" \
    -v "${STATE}:/app" -w /app \
    -v "${CONF_DIR}/nginx-gateways.d:/nginx-gateways.d" \
    --dns "$(ip_of "$DNS")" \
    -- docker.io/library/node:22-alpine sh /app/start.sh >/dev/null 2>&1

  local ip
  wait_for "container logs $GANY 2>&1 | grep -q 'server listening'" 20 || {
    ko "Ganymede did not start — container logs $GANY"
    return 1
  }
  ip=$(ip_of "$GANY")
  ok "Ganymede up at http://127.0.0.1:${GANYMEDE_PORT} (container ${ip}:${PORT})"
}

# The other half of the reload arrangement.
#
# `stage_bundle` points NGINX_RELOAD_COMMAND at request-nginx-reload.sh, which
# blocks for ten seconds waiting for an acknowledgement only
# `nginx-reload.sh watch` can write. Nothing here started or checked it, so an
# `up` without a separate `nginx-reload.sh start` made every gateway allocation
# stall and then fail with "nginx did not acknowledge the reload" — which
# Ganymede turns into a thrown error and a rolled-back allocation, and which
# reads as a defect in Ganymede.
check_nginx_watcher() {
  local pidfile="${CONF_DIR}/nginx-reload.pid"
  if [ -f "$pidfile" ] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then
    ok "nginx reload watcher running (pid $(cat "$pidfile"))"
    return 0
  fi
  ko "the nginx reload watcher is not running"
  note "Gateway allocation reloads nginx through it and fails without it:"
  note "  ${REPO_ROOT}/scripts/local-dev/macos/nginx-reload.sh start"
  return 0
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
    echo "DNS for containers"
    up_dns || exit 1
    echo
    echo "Ganymede"
    stage_bundle || exit 1
    up_ganymede || exit 1
    echo
    echo "nginx reload"
    check_nginx_watcher
    echo
    "$0" status
    ;;
  status)
    echo "============================================="
    printf "Postgres   %s\n" "$(ip_of "$PG"):5432 ${DB}"
    printf "Ganymede   http://127.0.0.1:%s  (container %s:%s)\n" \
      "$GANYMEDE_PORT" "$(ip_of "$GANY")" "$PORT"
    printf "Platform   https://ganymede.%s:%s\n" "$DOMAIN" "$HTTPS_PORT"
    printf "State      %s\n" "$STATE"
    echo "============================================="
    note "The internal routes the broker needs are gateway-token protected;"
    note "mint one with the RS256 key in ${STATE}/jwt.key."
    ;;
  restart)
    # `up` without the schema. A code change is the common reason to redeploy
    # and `up` would take the database with it — including the gateway rows,
    # so every gateway in the pool would then hold a token for a row that no
    # longer exists and answer nothing.
    up_dns || exit 1
    stage_bundle || exit 1
    up_ganymede || exit 1
    check_nginx_watcher
    ;;
  seed)   seed_catalogue ;;
  logs)   container logs "$GANY" ;;
  down)
    # Only this environment's Ganymede. Postgres is one container holding every
    # environment's database — the container name is global while the database
    # name is not — so removing it here would take down whoever else is
    # running. DNS is likewise one per machine, not one per environment.
    container delete --force "$GANY" >/dev/null 2>&1
    ok "removed ${GANY}; Postgres and DNS left running for the other environments"
    note "drop just this database:  $0 drop-db"
    note "remove Postgres, DNS and all:  $0 down-all"
    ;;
  drop-db)
    container exec "$PG" psql -U postgres -c "DROP DATABASE IF EXISTS ${DB};" \
      >/dev/null 2>&1 \
      && ok "dropped ${DB}" || ko "could not drop ${DB}"
    ;;
  down-all)
    # Stated rather than implied: this is the one that takes everyone's data.
    #
    # DNS goes too. It is one container per machine, recreated on every `up`,
    # and leaving it behind meant "remove everything" left a resolver running —
    # so the help text overstated what actually happened.
    container delete --force "$GANY" "$PG" "$DNS" >/dev/null 2>&1
    ok "removed ${GANY}, Postgres and DNS — every environment's database is gone"
    ;;
  *) echo "usage: $0 [up|restart|seed|status|logs|down|drop-db|down-all]"; exit 1 ;;
esac
