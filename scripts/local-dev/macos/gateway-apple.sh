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
#   ./gateway-apple.sh broker    the container broker, without which the
#                                service card offers only the local runner
#   ./gateway-apple.sh up [n]    register n gateways and run them
#   ./gateway-apple.sh resume    reconcile, then start the ones that exist
#   ./gateway-apple.sh reconcile make the containers and the rows agree
#   ./gateway-apple.sh list      what is running, and where
#   ./gateway-apple.sh logs [i]  one container's gateway log
#   ./gateway-apple.sh down      remove this environment's gateway containers
#                                and their rows. The database itself is left
#                                alone — ganymede-apple.sh drop-db is that.
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
#   concession the broker's engine already names. `resume` starts the gateways
#   that already exist, and supervise.sh runs it at login, which is what stands
#   in for the flag.
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
BROKER_PORT="${BROKER_PORT:-9080}"
# Off unless asked for. The VPN server then *requires* a username and password,
# so every container built before the base image learned to send them stops
# connecting. Turn it on only once every image in the catalogue is rebuilt —
# start-vpn.sh says the same thing from the other side.
VPN_PER_CLIENT_IDENTITY="${VPN_PER_CLIENT_IDENTITY:-0}"
# TCP here, UDP everywhere else — a concession, and it is Apple's UDP proxy
# that forces it.
#
# `--publish <p>:<p>/udp` binds on the Mac and works, until traffic goes
# through it: measured, the port is listening after `container start`, a
# container completes its handshake, and about a minute later nothing is bound
# on the host while the TCP publish beside it carries every HTTP request of the
# night without a hiccup. There is no repair from outside, either — the host
# cannot reach a container's own address, so a relay has nowhere to relay to.
#
# The cost is real and is the reason this is not the default anywhere else:
# OpenVPN over TCP nests one reliable transport in another, so a single lost
# packet stalls every tunnelled connection rather than one. On a Mac talking to
# containers on the same machine, that loss does not happen; a proxy that dies
# under load does.
VPN_PROTO="${VPN_PROTO:-tcp}"

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
CMDS_IMAGE="${CMDS_IMAGE:-docker.io/library/node:22-alpine}"

GREEN='\033[0;32m'; RED='\033[0;31m'; GRAY='\033[0;90m'; NC='\033[0m'
ok()   { printf "  ${GREEN}✓${NC} %s\n" "$1"; }
ko()   { printf "  ${RED}✗${NC} %s\n" "$1"; }
note() { printf "  ${GRAY}%s${NC}\n" "$1"; }

# app-ganymede-cmds writes a gateway's row itself and signs its token, so it
# needs the database. On macOS it cannot have it from this host: `node`
# answers EHOSTUNREACH for every container address, every time, while `nc`,
# `curl` and `python3` connect to the same address and port from the same
# shell. That is the local-network privacy check, which exempts Apple's own
# binaries in /usr/bin and not Homebrew's node — and a reboot resets it, so a
# pool that registered yesterday fails to register today with no change to
# anything here. Measured against Postgres at 192.168.65.35:5432.
#
# Granting the permission by hand fixes it until the next reset. Running the
# bundle in a container on the same network removes the question: nothing on
# the host opens the socket. It costs one microVM boot per call, a few seconds.
run_cmds() {
  container run --rm --network "$NET" \
    --volume "$(dirname "$CMDS"):/cmds" \
    -e "PG_HOST=${PG_HOST:-}" \
    -e "PG_PORT=${PG_PORT:-5432}" \
    -e "PG_DATABASE=${PG_DATABASE:-}" \
    -e "PG_USER=${PG_USER:-}" \
    -e "PG_PASSWORD=${PG_PASSWORD:-}" \
    -e "JWT_PRIVATE_KEY=${JWT_PRIVATE_KEY:-}" \
    -e "JWT_PUBLIC_KEY=${JWT_PUBLIC_KEY:-}" \
    -e "LOG_LEVEL=${LOG_LEVEL:-3}" \
    -- "$CMDS_IMAGE" node /cmds/main.js "$@"
}

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
# Bound to the container network's gateway address, not the loopback and not
# every interface.
#
# The loopback is not reachable from inside a microVM, which is the whole point
# of this server — so it was bound to 0.0.0.0. That also serves it to every
# host that can route to this machine, and on a laptop on an untrusted network
# that is everyone in the room. The directory holds packed gateway builds:
# no key and no environment file, but the platform's server-side code, and
# nothing about "it is only a dev harness" makes handing that out on a café
# network a good default.
#
# The bridge address is reachable from exactly the place that needs it and from
# nowhere off the machine. Same address the broker binds to, for the same
# reason.
BUILD_BIND="${BUILD_BIND:-}"

# Where to bind, worked out once and shared by both forms below.
serve_bind() {
  local bind="$BUILD_BIND"
  [ -z "$bind" ] && bind="$(host_gateway)"
  printf '%s' "$bind"
}

# In the foreground, for launchd. A job that backgrounds itself is a job
# launchd sees exit, and it restarts it forever against a port the previous
# copy still holds — the same reason the broker has this pair.
cmd_serve_foreground() {
  mkdir -p "$BUILDS"
  local bind
  bind="$(serve_bind)"
  [ -n "$bind" ] || bind=0.0.0.0
  exec python3 -m http.server "$BUILD_PORT" --bind "$bind" --directory "$BUILDS"
}

cmd_serve() {
  mkdir -p "$BUILDS"
  if pgrep -f "http.server ${BUILD_PORT}" >/dev/null 2>&1; then
    ok "build server already running on :${BUILD_PORT}"
    return 0
  fi

  local bind
  bind="$(serve_bind)"
  if [ -z "$bind" ]; then
    # Reached by `serve` on its own, before anything is on the container
    # network. Said out loud rather than silently widened.
    ko "could not read the container network gateway — binding every interface"
    note "Anyone who can route to this machine can fetch the gateway builds."
    note "Start the environment first, or set BUILD_BIND explicitly."
    bind=0.0.0.0
  fi

  nohup python3 -m http.server "$BUILD_PORT" --bind "$bind" --directory "$BUILDS" \
    >"${CONF_DIR}/build-server.log" 2>&1 &
  sleep 1
  pgrep -f "http.server ${BUILD_PORT}" >/dev/null 2>&1 \
    && ok "build server on ${bind}:${BUILD_PORT} serving ${BUILDS}" \
    || { ko "build server did not start — ${CONF_DIR}/build-server.log"; return 1; }
}

# --------------------------------------------------------------------------
# broker — without it the gateway offers only the local runner
# --------------------------------------------------------------------------
# The gateway registers the platform runner only when it has *both* a broker
# URL and a broker token; config/modules.ts says why, and it is the right rule:
# half a broker would put a button in front of the user that fails on click.
# The consequence when neither is set is quiet — the picker simply offers
# "Local" alone, with nothing anywhere saying a mode is missing.
#
# It binds on the container network's gateway address, not the loopback: its
# only client is a gateway *inside* a microVM, for which 127.0.0.1 is itself.
#
# And it is reached over `http`, not `https`. The broker has no TLS at all —
# no certificate option, no secure server, `http.createServer` and nothing
# more — so the bearer token that authorises starting a tenant container
# travels in clear. That is tolerable only because both ends sit on a
# host-local network: the docker bridge on Linux, vmnet here.
#
# The port used to be 9443, which said the opposite of all of that. It cost one
# debugging session here — a URL written as the port implied, and a `fetch
# failed` in the gateway with no mention of TLS in it — and it was an invitation
# to copy the same shape somewhere it would matter. 9080 claims nothing.
# The same broker, in the foreground: launchd needs a process it can watch, and
# a job that backgrounds itself is a job launchd declares dead and restarts
# forever. `foreground=1` is the only difference.
cmd_broker_foreground() { BROKER_FOREGROUND=1 cmd_broker; }

cmd_broker() {
  local bundle="${REPO_ROOT}/dist/packages/app-container-broker/main.js"
  [ -f "$bundle" ] || {
    ko "the broker is not built. Run:"
    note "NX_DAEMON=false npx nx build app-container-broker"
    return 1
  }
  [ -f "${STATE}/jwt.key" ] || {
    ko "no JWT key for '${ENV_NAME}' — run ganymede-apple.sh up first"
    return 1
  }

  local host
  host="$(host_gateway)"
  [ -n "$host" ] || { ko "could not read the network gateway from ${PG}"; return 1; }

  # Generated once and kept, because the gateway is handed the same value and a
  # regenerated secret would leave a running gateway holding one nothing
  # accepts — which surfaces as the platform runner failing on start rather
  # than as an authentication problem.
  [ -f "${STATE}/broker.token" ] || {
    openssl rand -hex 32 > "${STATE}/broker.token"
    chmod 600 "${STATE}/broker.token"
  }

  # The *port*, not the process name. A broker left over from
  # verify-container-broker.sh binds a random free port, so asking whether any
  # broker process exists answers yes while nothing is listening where the
  # gateway will look — and the gateway then registers a platform runner whose
  # first request is refused.
  if lsof -nP -iTCP@"${host}":"${BROKER_PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
    ok "broker already listening on ${host}:${BROKER_PORT}"
    return 0
  fi

  # Ganymede verifies this as an RS256 `gateway_token`, so it is *signed*, not
  # generated. A random string authenticates nothing, and the failure it
  # produces is every project image reported as non-existent rather than as
  # refused — the same defect the containerbroker Ansible role had.
  local internal_token
  internal_token="$(node -e '
const crypto = require("crypto"), fs = require("fs");
const key = fs.readFileSync(process.argv[1]);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const h = b64({ alg: "RS256", typ: "JWT" });
const now = Math.floor(Date.now() / 1000);
const p = b64({
  type: "gateway_token",
  gateway_id: "00000000-0000-0000-0000-0000000000b0",
  scope: "gateway:broker:catalogue",
  iat: now, exp: now + 31536000,
});
process.stdout.write(h + "." + p + "." +
  crypto.sign("RSA-SHA256", Buffer.from(h + "." + p), key).toString("base64url"));
' "${STATE}/jwt.key")"

  # Every concession the apple engine names has to be listed or the broker
  # refuses to start — which is the point of them. See engine-apple.ts.
  BROKER_ENGINE=apple \
  BROKER_RUNTIME=container-runtime-linux \
  BROKER_ACCEPT_CONCESSIONS=no-new-privileges,pids-cgroup,restart-policy,run-may-pull,no-hot-network-attach \
  BROKER_TOKEN="$(cat "${STATE}/broker.token")" \
  BROKER_PORT="$BROKER_PORT" \
  BROKER_BIND="$host" \
  GANYMEDE_INTERNAL_URL="https://ganymede.${DOMAIN}:${HTTPS_PORT}" \
  GANYMEDE_INTERNAL_TOKEN="$internal_token" \
  NODE_TLS_REJECT_UNAUTHORIZED=0 \
    node_broker "$bundle"

  # Under launchd the line above never returns, so nothing below runs — which is
  # the point: a job that backgrounds itself is a job launchd sees exit, and it
  # restarts it forever against a port the previous copy still holds.
  sleep 3
  lsof -nP -iTCP@"${host}":"${BROKER_PORT}" -sTCP:LISTEN >/dev/null 2>&1 \
    && ok "broker on ${host}:${BROKER_PORT} (apple engine, log ${CONF_DIR}/broker.log)" \
    || { ko "the broker did not start — ${CONF_DIR}/broker.log"; tail -8 "${CONF_DIR}/broker.log"; return 1; }
}

# Foreground for launchd, detached for a person at a terminal. `exec … &` is
# neither: the `&` forks, so exec never replaces the shell and the job dies
# anyway — which is what happened the first time.
node_broker() {
  if [ -n "${BROKER_FOREGROUND:-}" ]; then
    exec node "$1"
  fi
  nohup node "$1" >"${CONF_DIR}/broker.log" 2>&1 &
}

# --------------------------------------------------------------------------
# up
# --------------------------------------------------------------------------
# Everything a registration needs that is per-run rather than per-gateway.
#
# Sets HOST_GATEWAY, which the caller passes to create_gateway, and exports the
# database and key environment run_cmds hands to app-ganymede-cmds.
prepare_registration() {
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

  local pgip
  pgip="$(ip_of "$PG")"
  HOST_GATEWAY="$(host_gateway)"
  [ -n "$pgip" ] || { ko "Postgres is not running — ganymede-apple.sh up"; return 1; }
  [ -n "$HOST_GATEWAY" ] || { ko "could not read the network gateway from ${PG}"; return 1; }

  cmd_serve || return 1
  cmd_broker || return 1

  # app-ganymede-cmds signs the gateway's token with this environment's key and
  # writes the row itself, so it needs the database and the key — the same two
  # things Ganymede has, reached from the host rather than from inside.
  export PG_HOST="$pgip" PG_PORT=5432 PG_DATABASE="$DB" \
         PG_USER="$DB_USER" PG_PASSWORD="$DB_PASSWORD"
  export JWT_PRIVATE_KEY JWT_PUBLIC_KEY
  JWT_PRIVATE_KEY="$(cat "${STATE}/jwt.key")"
  JWT_PUBLIC_KEY="$(cat "${STATE}/jwt.pub")"
}

cmd_up() {
  local count="${1:-$COUNT_DEFAULT}"

  prepare_registration || return 1
  local host="$HOST_GATEWAY"

  # The highest suffix in use, not how many there are. With gw-pool-<env>-0
  # deleted and -1 still running, a count of 1 names the new one -1 as well —
  # and the loop below force-deletes whatever holds that name, taking a live
  # gateway and its database row with it while the organization using it just
  # loses its connection.
  local existing
  existing="$(names | sed "s/^gw-pool-${ENV_NAME}-//" | sort -n | tail -1)"
  existing=$(( ${existing:--1} + 1 ))

  local i
  for ((i = 0; i < count; i++)); do
    create_gateway "$((existing + i))" "$host" || return 1
  done

  echo
  cmd_list
}

# Register one gateway and run its container.
#
# Split out of cmd_up so `reconcile` can rebuild a single index without
# renumbering the pool: a container whose row is gone has to be recreated, and
# recreating it at the next free index would move its ports out from under the
# nginx upstream that already points at them.
#
# The caller prepares the environment — Postgres address, JWT keys, the build
# server and the broker — because those are per-run, not per-gateway.
create_gateway() {
    local index="$1" host="$2"
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

    # The container this one replaces goes before the port check, not after.
    #
    # `reconcile` rebuilds a gateway at its own index, and that gateway is
    # running: it holds ${http} and ${vpn}, so the check below named Apple's
    # own runtime as the holder and refused — the pool could never repair
    # itself, which is the whole point of reconcile. Measured, rebuilding
    # gw-pool-apollo-0 with its row deleted.
    #
    # Nothing is lost by deleting first: this container is going to be replaced
    # either way, and on the path where the port really is taken by something
    # foreign it would have been force-deleted a few lines further down.
    container delete --force "$name" >/dev/null 2>&1

    # Before the row, not after. `container run` reports a busy port as
    # "Address already in use" and exits without creating anything — while the
    # gateway row is already written and claims to be at that address, so the
    # next organization to open a project is allocated a gateway that does not
    # exist. Whoever holds the port is named, because on this machine it is
    # usually the Lima VM this platform is migrating out of, forwarding the
    # same range to the same loopback.
    # Both published ports, not just the web one.
    #
    # The tunnel was UDP when this check was written, and `--publish` without
    # `/udp` is TCP — so once VPN_PROTO started defaulting to tcp, a clash on
    # ${vpn} produced exactly the failure this guard exists to prevent, one
    # port later: `container run` exits on "Address already in use" with the
    # row already written, and the next organization is handed a gateway that
    # is not there. The leftover Lima VM named below forwards the same range,
    # which is precisely what binds the tunnel port.
    local port_holder proto
    for port_holder in "${http}:tcp" "${vpn}:${VPN_PROTO}"; do
      local port="${port_holder%%:*}"
      proto="${port_holder##*:}"
      local holder
      if [ "$proto" = udp ]; then
        holder="$(lsof -nP -iUDP:"${port}" -t 2>/dev/null | head -1)"
      else
        holder="$(lsof -nP -iTCP:"${port}" -sTCP:LISTEN -t 2>/dev/null | head -1)"
      fi
      if [ -n "$holder" ]; then
        ko "port ${port}/${proto} is taken by $(ps -p "$holder" -o comm= 2>/dev/null || echo "pid ${holder}") (pid ${holder})"
        note "Give this pool another range:  HTTP_BASE=7200 VPN_BASE=49200 $0 up"
        return 1
      fi
    done

    echo "${name}  http ${http}  vpn ${vpn}  → ${upstream}"

    # container_name is unique in `gateways`. A row can outlive its container —
    # a failed `container run` leaves exactly that — and the index for this name
    # was computed from the containers that exist, so a row here with no
    # container behind it is an orphan. Left alone it makes every later `up`
    # fail on a constraint violation with a stack trace and no name in it.
    run_cmds remove-gateway -c "$name" >/dev/null 2>&1 \
      && note "removed a leftover row for ${name}"

    local out id token
    out="$(LOG_LEVEL=6 run_cmds add-gateway \
      -gv 0.0.1 -c "$name" -hp "$http" -vp "$vpn" -nu "$upstream" 2>&1)"
    id="$(printf '%s' "$out" | grep 'gateway_id:' | grep -oE '[a-f0-9-]{36}' | head -1)"
    token="$(printf '%s' "$out" | grep '^token:' | awk '{print $2}')"
    if [ -z "$id" ] || [ -z "$token" ]; then
      ko "could not register ${name}"
      printf '%s\n' "$out" | tail -5
      return 1
    fi

    # GANYMEDE_API_URL is an address and not a name on purpose: this call is
    # made before anything has resolved anything, and the Host header carries
    # the name so nginx still picks the right server block.
    #
    # JWT_PUBLIC_KEY is a whole PEM in one `-e`, newlines and all.
    # ganymede-apple.sh base64s the same key because an env *file* is
    # KEY=VALUE per line and a PEM cannot travel in one; an exec argument is
    # not an env file and has no such limit. Measured on `container` 1.2.0: a
    # four-line PEM passed this way arrives with all three newlines intact.
    # Worth having measured, because a truncated key does not fail at start-up
    # — it fails later, as token verification refusing everyone.
    #
    # Every note about this command lives *here*, above it. A `#` inside a
    # backslash continuation does not comment out one argument: it ends the
    # command at that line. Written between two `-e` flags, this paragraph
    # silently truncated the run — no image, no broker address, no key — and
    # the remainder was parsed as a second command named `-e`, whose failure
    # the trailing `>/dev/null 2>&1` swallowed. `bash -n` reports it as valid,
    # because it is; it just means something else.
    container run --detach --name "$name" \
      --label "environment=${ENV_NAME}" --label "gateway_id=${id}" \
      --network "$NET" --cpus 2 --memory 2048m \
      --cap-add NET_ADMIN \
      --publish "${http}:${http}" \
      --publish "${vpn}:${vpn}$([ "$VPN_PROTO" = udp ] && echo /udp)" \
      -e "ENV_NAME=${ENV_NAME}" \
      -e "GATEWAY_ID=${id}" \
      -e "GATEWAY_TOKEN=${token}" \
      -e "GATEWAY_HTTP_PORT=${http}" \
      -e "GATEWAY_VPN_PORT=${vpn}" \
      -e "GANYMEDE_FQDN=ganymede.${DOMAIN}:${HTTPS_PORT}" \
      -e "GANYMEDE_API_URL=https://${host}:${HTTPS_PORT}" \
      -e "DOMAIN=${DOMAIN}:${HTTPS_PORT}" \
      -e "BUILD_SERVER_IP=${host}" \
      -e "BUILD_SERVER_PORT=${BUILD_PORT}" \
      -e "ALLOWED_ORIGINS=[\"https://${DOMAIN}:${HTTPS_PORT}\"]" \
      -e "JWT_PUBLIC_KEY=${JWT_PUBLIC_KEY}" \
      -e "OTEL_SERVICE_NAME=gateway-${name}" \
      -e "OTEL_DEPLOYMENT_ENVIRONMENT=${ENV_NAME}" \
      -e "NODE_TLS_REJECT_UNAUTHORIZED=0" \
      -e "GATEWAY_DEV=1" \
      -e "VPN_PER_CLIENT_IDENTITY=${VPN_PER_CLIENT_IDENTITY:-0}" \
      -e "GATEWAY_VPN_PROTO=${VPN_PROTO}" \
      -e "CONTAINER_BROKER_URL=http://${host}:${BROKER_PORT}" \
      -e "CONTAINER_BROKER_TOKEN=$(cat "${STATE}/broker.token")" \
      -- "$IMAGE" >/dev/null 2>&1

    # Polled, not read once. The address is Apple's to assign and it is not
    # there the instant `container run --detach` returns — every other place in
    # this harness already treats it that way. Read immediately, an empty
    # result is the common case, and a perfectly healthy gateway is declared
    # dead *after* its row is in the database: the pool aborts half-built with
    # a message pointing at the container.
    local ip=""
    for _ in $(seq 1 20); do
      ip="$(ip_of "$name")"
      [ -n "$ip" ] && break
      sleep 1
    done
    [ -n "$ip" ] \
      && ok "${name} up at ${ip}" \
      || { ko "${name} did not start — container logs ${name}"; return 1; }
}

# --------------------------------------------------------------------------
# list / logs / down
# --------------------------------------------------------------------------
# The container names this environment has rows for.
#
# Read with psql inside the Postgres container rather than through
# app-ganymede-cmds: this is a plain question about state, it needs no signing
# key, and it is the same access ganymede-apple.sh already uses.
registered_names() {
  container exec "$PG" psql -U postgres -d "$DB" -tAc \
    "SELECT container_name FROM gateways
      WHERE container_name LIKE 'gw-pool-${ENV_NAME}-%';" 2>/dev/null \
    | tr -d '\r' | sed 's/[[:space:]]*$//' | grep -v '^$'
}

# Make the containers and the rows agree.
#
# They can disagree in both directions and each one is silent:
#
#   A row with no container — a `container run` that failed after the row was
#   written, or a container deleted by hand. The next organization to open a
#   project is allocated a gateway that answers nothing.
#
#   A container with no row — the database was recreated under a running pool.
#   The container keeps a GATEWAY_ID nobody recognises, `gateways` is empty,
#   and *Start Organization* dies on `no_gateway_available` with nothing in the
#   interface to say why. Measured on 2026-08-07: two gateways running, zero
#   rows, and the only way out was `down` then `up` by hand.
#
# Rebuilt at its own index, never at the next free one. The ports come from the
# index, and nginx already proxies an organization to the port this container
# holds; renumbering would move the gateway out from under a live upstream.
cmd_reconcile() {
  local containers rows n orphan_rows="" orphan_containers=""
  containers="$(names)"
  rows="$(registered_names)"

  for n in $rows; do
    printf '%s\n' "$containers" | grep -qxF "$n" \
      || orphan_rows="${orphan_rows} ${n}"
  done
  for n in $containers; do
    printf '%s\n' "$rows" | grep -qxF "$n" \
      || orphan_containers="${orphan_containers} ${n}"
  done

  [ -z "$orphan_rows" ] && [ -z "$orphan_containers" ] && return 0

  # Only now: the checks it makes — a built bundle, a JWT key, a packed
  # tarball — are what a rebuild needs, and demanding them when nothing has
  # drifted would fail the common path for no reason.
  prepare_registration || return 1

  for n in $orphan_rows; do
    run_cmds remove-gateway -c "$n" >/dev/null 2>&1 \
      && ok "removed the row for ${n} — no container behind it" \
      || ko "could not remove the row for ${n}"
  done

  for n in $orphan_containers; do
    note "${n} holds a GATEWAY_ID no row knows — rebuilding it"
    create_gateway "${n##*-}" "$HOST_GATEWAY" || return 1
  done
}

# Start the gateways that already exist. Not `up`, which registers new rows —
# after a reboot the pool is down but its rows still say ready, and the next
# organization to open a project is handed a gateway that answers nothing.
#
# Reconciles first. supervise.sh runs this at login, which makes it the one
# place that sees the pool and the database together before anyone opens a
# project — so a drift that would otherwise surface as an unexplained
# `no_gateway_available` is repaired before it can.
cmd_resume() {
  cmd_reconcile
  local any=0 n
  while read -r n; do
    [ -z "$n" ] && continue
    any=1
    if [ -n "$(ip_of "$n")" ]; then
      ok "${n} already up"
    else
      container start "$n" >/dev/null 2>&1
      local ip=""
      for _ in $(seq 1 20); do
        ip="$(ip_of "$n")"
        [ -n "$ip" ] && break
        sleep 1
      done
      [ -n "$ip" ] && ok "${n} resumed at ${ip}" || ko "${n} did not come back"
    fi
  done < <(names)
  [ "$any" = 1 ] || note "no gateway containers for '${ENV_NAME}' — $0 up"
}

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
    [ -f "$CMDS" ] && run_cmds remove-gateway -c "$n" >/dev/null 2>&1
    container delete --force "$n" >/dev/null 2>&1
    ok "removed ${n}"
  done < <(names)
}

case "${1:-}" in
  image) cmd_image ;;
  pack)  cmd_pack ;;
  serve) cmd_serve ;;
  serve-foreground) cmd_serve_foreground ;;
  broker) cmd_broker ;;
  broker-foreground) cmd_broker_foreground ;;
  resume) cmd_resume ;;
  reconcile) cmd_reconcile ;;
  up)    shift; cmd_up "$@" ;;
  list)  cmd_list ;;
  logs)  shift; cmd_logs "$@" ;;
  down)  cmd_down ;;
  all)
    cmd_image || exit 1
    cmd_pack  || exit 1
    cmd_up    || exit 1
    ;;
  *) echo "usage: $0 [image|pack|serve|broker|up [n]|resume|reconcile|list|logs [i]|down|all]"; exit 1 ;;
esac
