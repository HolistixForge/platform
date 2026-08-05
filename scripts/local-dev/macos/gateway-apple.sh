#!/bin/bash
# =============================================================================
# gateway-apple.sh — a gateway pool on Apple `container`
# =============================================================================
# The macOS sibling of gateway-pool.sh, which stays exactly as it is: it runs
# on the Linux platform host, under Docker, and nothing here touches it.
#
#   ./gateway-apple.sh image     build gateway:latest for this machine
#   ./gateway-apple.sh pack      build app-gateway and pack the tarball
#   ./gateway-apple.sh serve     the build server the containers fetch from
#   ./gateway-apple.sh up [n]    register n gateways and run them
#   ./gateway-apple.sh list      what is running, and where
#   ./gateway-apple.sh logs [i]  one container's gateway log
#   ./gateway-apple.sh down      remove this environment's gateways, DB included
#
# `all` does image, pack, serve and up in that order — the usual first run.
#
# What differs from the Docker path, and why each difference exists:
#
#   No `--device /dev/net/tun`. Apple's guest kernel mounts devtmpfs and the
#   node is already there — measured in a running container, `crw------- 10,
#   200`, and `ip tuntap add tun0` succeeds. Passing a host device that does
#   not exist on macOS would only fail.
#
#   No `--restart`. Apple has no restart policy — the `restart-policy`
#   concession the broker's engine already names. Nothing here brings a gateway
#   back after a reboot; that is launchd's job and it is not written yet.
#
#   No `--dns`. Apple's takes an IP and no port, and the CoreDNS this platform
#   runs on macOS is on 15353 precisely so it needs no root. Worse, its
#   template answers 127.0.0.1 — right for the host, and inside a container
#   that is the container. So the container resolves the platform's names from
#   the gateway of its own network instead, the same way user containers have
#   since dd0d0dd2, and needs to be told nothing.
#
#   The nginx upstream is the container network's gateway, which is what the
#   docker0 bridge address is on Linux and for the same reason. It cannot be
#   the loopback: two things reach a gateway by that address, nginx on this Mac
#   and Ganymede health-checking it from inside its own container, and
#   127.0.0.1 is only ever right for one of them.
#
#   So the HTTP port is published on every interface rather than on the
#   loopback. On a laptop that means anything able to route to this Mac can
#   reach it — the same posture the VPN port already has, because a VPN nobody
#   outside can reach is not one.

set -uo pipefail

ENV_NAME="${ENV_NAME:-apollo}"
DOMAIN="${DOMAIN:-apollo.test}"
HTTPS_PORT="${HTTPS_PORT:-8443}"
GANYMEDE_PORT="${GANYMEDE_PORT:-6100}"
COUNT_DEFAULT=2

# Same ports as the Linux pool by default, so a gateway registered by either
# path is at the address the other would have used. Overridable because on a
# machine still running the Lima VM this platform is migrating out of, that VM
# forwards exactly this range to the loopback and gets there first.
HTTP_BASE="${HTTP_BASE:-7100}"
VPN_BASE="${VPN_BASE:-49100}"
BUILD_PORT="${BUILD_PORT:-8090}"

NET=default
PG=hx-postgres
IMAGE=gateway:latest
DB="ganymede_${ENV_NAME//-/_}"
DB_USER="ganymede_app_${ENV_NAME//-/_}"
DB_PASSWORD="${GANYMEDE_DB_PASSWORD:-${GANYMEDE_APPLE_DB_PASSWORD:-applepass123}}"

CONF_DIR="${HOME}/.holistix-macos"
STATE="${CONF_DIR}/${ENV_NAME}"
BUILDS="${CONF_DIR}/builds"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CMDS="${REPO_ROOT}/dist/packages/app-ganymede-cmds/main.js"

GREEN='\033[0;32m'; RED='\033[0;31m'; GRAY='\033[0;90m'; NC='\033[0m'
ok()   { printf "  ${GREEN}✓${NC} %s\n" "$1"; }
ko()   { printf "  ${RED}✗${NC} %s\n" "$1"; }
note() { printf "  ${GRAY}%s${NC}\n" "$1"; }

command -v container >/dev/null || {
  echo "Apple 'container' is not installed — https://github.com/apple/container"
  exit 1
}
container system status >/dev/null 2>&1 || {
  echo "The container service is not running:  container system start"
  exit 1
}

# The address a container reaches the host at: the gateway of its own network.
# Read from something already running rather than assumed, because it is
# Apple's to choose and it is not documented as stable.
host_gateway() {
  container inspect "$PG" 2>/dev/null | python3 -c '
import json, sys
try: doc = json.load(sys.stdin)[0]
except Exception: sys.exit(0)
nets = doc.get("status", {}).get("networks") or []
print(nets[0].get("ipv4Gateway", "") if nets else "")
'
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

names() {
  container ls -a --format json 2>/dev/null | python3 -c '
import json, sys
prefix = sys.argv[1]
try: docs = json.load(sys.stdin)
except Exception: sys.exit(0)
for c in docs:
    cid = (c.get("configuration") or {}).get("id", "")
    if cid.startswith(prefix):
        print(cid)
' "gw-pool-${ENV_NAME}-"
}

# --------------------------------------------------------------------------
# image
# --------------------------------------------------------------------------
cmd_image() {
  echo "Building ${IMAGE} from docker-images/backend-images/gateway"
  note "ubuntu:24.04 plus node, openvpn, nginx and iptables — several minutes"
  ( cd "${REPO_ROOT}/docker-images/backend-images/gateway" \
      && container build -t "$IMAGE" . ) \
    && ok "${IMAGE} built" \
    || { ko "build failed"; return 1; }
}

# --------------------------------------------------------------------------
# pack — the same layout pack-gateway-build.sh produces, from macOS paths
# --------------------------------------------------------------------------
cmd_pack() {
  local dist="${REPO_ROOT}/dist/packages/app-gateway"
  [ -d "$dist" ] || {
    ko "app-gateway is not built. Run:"
    note "NX_DAEMON=false npx nx build app-gateway"
    return 1
  }

  mkdir -p "$BUILDS"
  local tmp
  tmp="$(mktemp -d)"
  mkdir -p "${tmp}/gateway"
  cp -R "$dist" "${tmp}/gateway/"
  cp -R "${REPO_ROOT}/docker-images/backend-images/gateway/app" "${tmp}/gateway/"

  # The container greps this file when someone asks which build it is running,
  # so it has to say something a person can act on.
  cat > "${tmp}/gateway/BUILD_INFO.txt" <<EOF
Environment: ${ENV_NAME}
Built: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
Engine: apple container
Workspace: ${REPO_ROOT}
Node Version: $(node --version 2>/dev/null || echo unknown)
Commit: $(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)
EOF

  ( cd "$tmp" && tar czf "${BUILDS}/gateway-${ENV_NAME}.tar.gz" gateway/ )
  rm -rf "$tmp"
  ok "packed $(du -h "${BUILDS}/gateway-${ENV_NAME}.tar.gz" | cut -f1) → ${BUILDS}/gateway-${ENV_NAME}.tar.gz"
}

# --------------------------------------------------------------------------
# serve — where the containers fetch that tarball from
# --------------------------------------------------------------------------
# Bound to every interface, not the loopback: the point is to be reachable from
# inside a microVM, which the loopback is not. It serves one directory holding
# nothing but build tarballs — no environment file, no key — and that is the
# reason it can be bound that way at all.
cmd_serve() {
  mkdir -p "$BUILDS"
  if pgrep -f "http.server ${BUILD_PORT}" >/dev/null 2>&1; then
    ok "build server already running on :${BUILD_PORT}"
    return 0
  fi
  nohup python3 -m http.server "$BUILD_PORT" --bind 0.0.0.0 --directory "$BUILDS" \
    >"${CONF_DIR}/build-server.log" 2>&1 &
  sleep 1
  pgrep -f "http.server ${BUILD_PORT}" >/dev/null 2>&1 \
    && ok "build server on :${BUILD_PORT} serving ${BUILDS}" \
    || { ko "build server did not start — ${CONF_DIR}/build-server.log"; return 1; }
}

# --------------------------------------------------------------------------
# up
# --------------------------------------------------------------------------
cmd_up() {
  local count="${1:-$COUNT_DEFAULT}"

  [ -f "$CMDS" ] || {
    ko "app-ganymede-cmds is not built. Run:"
    note "NX_DAEMON=false npx nx build app-ganymede-cmds"
    return 1
  }
  [ -f "${STATE}/jwt.key" ] || {
    ko "no JWT key for '${ENV_NAME}' — run ganymede-apple.sh up first"
    return 1
  }
  [ -f "${BUILDS}/gateway-${ENV_NAME}.tar.gz" ] || {
    ko "no build to fetch — run:  $0 pack"
    return 1
  }
  container image ls 2>/dev/null | grep -q '^gateway ' || {
    ko "${IMAGE} is not built — run:  $0 image"
    return 1
  }

  local pgip host
  pgip="$(ip_of "$PG")"
  host="$(host_gateway)"
  [ -n "$pgip" ] || { ko "Postgres is not running — ganymede-apple.sh up"; return 1; }
  [ -n "$host" ] || { ko "could not read the network gateway from ${PG}"; return 1; }

  cmd_serve || return 1

  # app-ganymede-cmds signs the gateway's token with this environment's key and
  # writes the row itself, so it needs the database and the key — the same two
  # things Ganymede has, reached from the host rather than from inside.
  export PG_HOST="$pgip" PG_PORT=5432 PG_DATABASE="$DB" \
         PG_USER="$DB_USER" PG_PASSWORD="$DB_PASSWORD"
  export JWT_PRIVATE_KEY JWT_PUBLIC_KEY
  JWT_PRIVATE_KEY="$(cat "${STATE}/jwt.key")"
  JWT_PUBLIC_KEY="$(cat "${STATE}/jwt.pub")"

  local existing
  existing="$(names | wc -l | tr -d ' ')"

  local i
  for ((i = 0; i < count; i++)); do
    local index=$((existing + i))
    local name="gw-pool-${ENV_NAME}-${index}"
    local http=$((HTTP_BASE + index))
    local vpn=$((VPN_BASE + index))

    # Two different things use this address and they are not on the same side
    # of the container boundary here: nginx, on this Mac, proxies to it, and
    # Ganymede — which is itself in a container — health-checks it before it
    # hands the gateway to an organization. The loopback is only ever right for
    # one of them; from inside Ganymede's microVM 127.0.0.1 is Ganymede. The
    # gateway of the container network is right for both: a local address on
    # the Mac, and the default route from any container.
    #
    # On Linux the docker0 bridge address plays exactly this role, for exactly
    # this reason.
    local upstream="${host}:${http}"

    # Before the row, not after. `container run` reports a busy port as
    # "Address already in use" and exits without creating anything — while the
    # gateway row is already written and claims to be at that address, so the
    # next organization to open a project is allocated a gateway that does not
    # exist. Whoever holds the port is named, because on this machine it is
    # usually the Lima VM this platform is migrating out of, forwarding the
    # same range to the same loopback.
    local holder
    holder="$(lsof -nP -iTCP:"${http}" -sTCP:LISTEN -t 2>/dev/null | head -1)"
    if [ -n "$holder" ]; then
      ko "port ${http} is taken by $(ps -p "$holder" -o comm= 2>/dev/null || echo "pid ${holder}") (pid ${holder})"
      note "Give this pool another range:  HTTP_BASE=7200 VPN_BASE=49200 $0 up ${count}"
      return 1
    fi

    echo "${name}  http ${http}  vpn ${vpn}  → ${upstream}"

    # container_name is unique in `gateways`. A row can outlive its container —
    # a failed `container run` leaves exactly that — and the index for this name
    # was computed from the containers that exist, so a row here with no
    # container behind it is an orphan. Left alone it makes every later `up`
    # fail on a constraint violation with a stack trace and no name in it.
    node "$CMDS" remove-gateway -c "$name" >/dev/null 2>&1 \
      && note "removed a leftover row for ${name}"

    local out id token
    out="$(LOG_LEVEL=6 node "$CMDS" add-gateway \
      -gv 0.0.1 -c "$name" -hp "$http" -vp "$vpn" -nu "$upstream" 2>&1)"
    id="$(printf '%s' "$out" | grep 'gateway_id:' | grep -oE '[a-f0-9-]{36}' | head -1)"
    token="$(printf '%s' "$out" | grep '^token:' | awk '{print $2}')"
    if [ -z "$id" ] || [ -z "$token" ]; then
      ko "could not register ${name}"
      printf '%s\n' "$out" | tail -5
      return 1
    fi

    container delete --force "$name" >/dev/null 2>&1

    # GANYMEDE_API_URL is an address and not a name on purpose: this call is
    # made before anything has resolved anything, and the Host header carries
    # the name so nginx still picks the right server block.
    container run --detach --name "$name" \
      --label "environment=${ENV_NAME}" --label "gateway_id=${id}" \
      --network "$NET" --cpus 2 --memory 2048m \
      --cap-add NET_ADMIN \
      --publish "${http}:${http}" \
      --publish "${vpn}:${vpn}/udp" \
      -e "ENV_NAME=${ENV_NAME}" \
      -e "GATEWAY_ID=${id}" \
      -e "GATEWAY_TOKEN=${token}" \
      -e "GATEWAY_HTTP_PORT=${http}" \
      -e "GATEWAY_VPN_PORT=${vpn}" \
      -e "GANYMEDE_FQDN=ganymede.${DOMAIN}:${HTTPS_PORT}" \
      -e "GANYMEDE_API_URL=https://${host}:${HTTPS_PORT}" \
      -e "DOMAIN=${DOMAIN}:${HTTPS_PORT}" \
      -e "BUILD_SERVER_IP=${host}" \
      -e "ALLOWED_ORIGINS=[\"https://${DOMAIN}:${HTTPS_PORT}\"]" \
      -e "JWT_PUBLIC_KEY=${JWT_PUBLIC_KEY}" \
      -e "OTEL_SERVICE_NAME=gateway-${name}" \
      -e "OTEL_DEPLOYMENT_ENVIRONMENT=${ENV_NAME}" \
      -e "NODE_TLS_REJECT_UNAUTHORIZED=0" \
      -- "$IMAGE" >/dev/null 2>&1

    local ip
    ip="$(ip_of "$name")"
    [ -n "$ip" ] \
      && ok "${name} up at ${ip}" \
      || { ko "${name} did not start — container logs ${name}"; return 1; }
  done

  echo
  cmd_list
}

# --------------------------------------------------------------------------
# list / logs / down
# --------------------------------------------------------------------------
cmd_list() {
  local any=0 n
  while read -r n; do
    [ -z "$n" ] && continue
    any=1
    printf "  %-28s %-16s %s\n" "$n" "$(ip_of "$n")" \
      "$(container exec "$n" sh -c 'pgrep -f "node.*main.js" >/dev/null && echo "app running" || echo "app not running"' 2>/dev/null || echo unreachable)"
  done < <(names)
  [ "$any" = 1 ] || note "no gateway containers for '${ENV_NAME}'"
}

cmd_logs() {
  local index="${1:-0}"
  container exec "gw-pool-${ENV_NAME}-${index}" tail -n 80 /tmp/gateway.log 2>/dev/null \
    || container logs "gw-pool-${ENV_NAME}-${index}"
}

cmd_down() {
  [ -f "$CMDS" ] && {
    export PG_HOST PG_PORT=5432 PG_DATABASE="$DB" PG_USER="$DB_USER" PG_PASSWORD="$DB_PASSWORD"
    PG_HOST="$(ip_of "$PG")"
  }
  local n
  while read -r n; do
    [ -z "$n" ] && continue
    # The row goes first. A container removed while its row still says ready
    # gets handed to the next organization that opens a project, which then
    # waits on a handshake with something that no longer exists.
    [ -f "$CMDS" ] && node "$CMDS" remove-gateway -c "$n" >/dev/null 2>&1
    container delete --force "$n" >/dev/null 2>&1
    ok "removed ${n}"
  done < <(names)
}

case "${1:-}" in
  image) cmd_image ;;
  pack)  cmd_pack ;;
  serve) cmd_serve ;;
  up)    shift; cmd_up "$@" ;;
  list)  cmd_list ;;
  logs)  shift; cmd_logs "$@" ;;
  down)  cmd_down ;;
  all)
    cmd_image || exit 1
    cmd_pack  || exit 1
    cmd_up    || exit 1
    ;;
  *) echo "usage: $0 [image|pack|serve|up [n]|list|logs [i]|down|all]"; exit 1 ;;
esac
