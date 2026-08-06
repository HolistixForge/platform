#!/bin/bash
# =============================================================================
# supervise.sh — keep the macOS platform's host processes up, via launchd
# =============================================================================
# On Linux these are systemd units. A Mac has launchd, and until now the macOS
# scripts started everything with `nohup … &`: nothing watched them, nothing
# restarted them, and nothing said when one was gone.
#
# That is not a convenience gap. Measured, in one session: nginx and CoreDNS
# both died — the disk had filled — and the platform went dark. The symptoms
# were a page that would not load, a WebSocket with no token and `fetch
# failed`, which read exactly like an application bug and cost an hour before
# anybody thought to ask whether the daemons were still there. A supervisor
# turns that into "it is down", which is a different sentence.
#
#   ./supervise.sh install     write the agents and start them
#   ./supervise.sh status      what is loaded, what is running, what is missing
#   ./supervise.sh restart     bounce them all
#   ./supervise.sh uninstall   stop and remove every agent
#
# Only what belongs to this platform is touched. The agents are named
# `so.holistix.<thing>` and `uninstall` removes exactly those.
#
# What is *not* here: Postgres, Ganymede and the gateway pool are containers,
# and Apple `container` restarts its own on boot. Only `resume` exists for
# them, because Apple has no restart policy — the `restart-policy` concession
# the broker's engine names — so a container that exits stays down.

set -uo pipefail

ENV_NAME="${ENV_NAME:-apollo}"
DOMAIN="${DOMAIN:-apollo.test}"
DNS_PORT="${DNS_PORT:-15353}"
BUILD_PORT="${BUILD_PORT:-8090}"
BROKER_PORT="${BROKER_PORT:-9080}"
# The same default and the same override as ganymede-apple.sh and
# gateway-apple.sh. Pinned to 8443 here, `status` reported nginx as NO — in
# red — on any environment started with another port, while nginx was in fact
# listening. A false negative, in the one table that exists to be believed.
HTTPS_PORT="${HTTPS_PORT:-8443}"

CONF_DIR="${HOME}/.holistix-macos"
STATE="${CONF_DIR}/${ENV_NAME}"
BUILDS="${CONF_DIR}/builds"
LOGS="${CONF_DIR}/logs"
AGENTS="${HOME}/Library/LaunchAgents"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PREFIX=so.holistix

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; GRAY='\033[0;90m'; NC='\033[0m'
ok()   { printf "  ${GREEN}✓${NC} %s\n" "$1"; }
ko()   { printf "  ${RED}✗${NC} %s\n" "$1"; }
warn() { printf "  ${YELLOW}!${NC} %s\n" "$1"; }
note() { printf "  ${GRAY}%s${NC}\n" "$1"; }

# launchd's own vocabulary changed; `bootstrap`/`bootout` against the GUI
# domain is the current one and the only one that reports a useful status.
DOMAIN_TARGET="gui/$(id -u)"

need() {
  command -v "$1" >/dev/null || { ko "$1 not found — $2"; return 1; }
}

# --------------------------------------------------------------------------
# The agents
# --------------------------------------------------------------------------
# Each is: label, the program and its arguments, and whether launchd should
# bring it back. Everything here runs in the foreground on purpose — a job that
# daemonises itself exits immediately and launchd sees a service that will not
# stay up, which is why nginx is given `daemon off`.
plist() {
  local label="$1" keepalive="$2"; shift 2
  local args=""
  for a in "$@"; do
    args+="    <string>${a}</string>"$'\n'
  done
  cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key>
  <array>
${args}  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><${keepalive}/>
  <key>StandardOutPath</key><string>${LOGS}/${label}.log</string>
  <key>StandardErrorPath</key><string>${LOGS}/${label}.log</string>
  <key>WorkingDirectory</key><string>${REPO_ROOT}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>HOME</key><string>${HOME}</string>
    <key>ENV_NAME</key><string>${ENV_NAME}</string>
    <key>DOMAIN</key><string>${DOMAIN}</string>
  </dict>
</dict>
</plist>
EOF
}

write_agents() {
  mkdir -p "$AGENTS" "$LOGS" "$BUILDS"

  plist "${PREFIX}.coredns" true \
    "$(command -v coredns)" -conf "${CONF_DIR}/Corefile" \
    > "${AGENTS}/${PREFIX}.coredns.plist"

  # `daemon off` or launchd sees the master fork, call the job dead, and
  # restart it forever against a port that is already bound.
  plist "${PREFIX}.nginx" true \
    "$(command -v nginx)" -g "daemon off;" \
    > "${AGENTS}/${PREFIX}.nginx.plist"

  plist "${PREFIX}.nginx-reload" true \
    /bin/bash "${REPO_ROOT}/scripts/local-dev/macos/nginx-reload.sh" watch \
    > "${AGENTS}/${PREFIX}.nginx-reload.plist"

  # Through the script, for its bind address. Written straight here it was
  # `--bind 0.0.0.0`, which serves the packed gateway builds to every host that
  # can route to this laptop. gateway-apple.sh resolves the container network's
  # gateway instead — reachable from the microVMs that need it, and from
  # nowhere off the machine.
  plist "${PREFIX}.buildserver" true \
    /bin/bash "${REPO_ROOT}/scripts/local-dev/macos/gateway-apple.sh" serve-foreground \
    > "${AGENTS}/${PREFIX}.buildserver.plist"

  # Started through the script rather than directly: the broker needs its
  # engine, its runtime, every concession named, and a freshly signed internal
  # token. Duplicating that here would be a second place to get it wrong.
  plist "${PREFIX}.broker" true \
    /bin/bash "${REPO_ROOT}/scripts/local-dev/macos/gateway-apple.sh" broker-foreground \
    > "${AGENTS}/${PREFIX}.broker.plist"

  # One-shot. Apple has no restart policy, so a gateway that exited — or a Mac
  # that rebooted — leaves the pool down with its rows still saying ready, and
  # the next organization to open a project is handed one that answers nothing.
  plist "${PREFIX}.gateways" false \
    /bin/bash "${REPO_ROOT}/scripts/local-dev/macos/gateway-apple.sh" resume \
    > "${AGENTS}/${PREFIX}.gateways.plist"
}

labels() {
  echo "${PREFIX}.coredns ${PREFIX}.nginx ${PREFIX}.nginx-reload ${PREFIX}.buildserver ${PREFIX}.broker ${PREFIX}.gateways"
}

# --------------------------------------------------------------------------

cmd_install() {
  need coredns "brew install coredns" || return 1
  need nginx "brew install nginx" || return 1
  need python3 "install Xcode command line tools" || return 1
  [ -f "${CONF_DIR}/Corefile" ] || {
    ko "no Corefile — run ./setup-dns.sh ${DOMAIN} ${DNS_PORT} first"
    return 1
  }

  # Whatever is running by hand has to go, or launchd starts a second copy and
  # both fight for the same port — which surfaces as a service that flaps
  # rather than as a conflict.
  echo "Stopping anything started by hand"
  pkill -f "coredns -conf ${CONF_DIR}/Corefile" 2>/dev/null && note "coredns"
  pkill -f "nginx-reload.sh watch" 2>/dev/null && note "nginx-reload"
  pkill -f "http.server ${BUILD_PORT}" 2>/dev/null && note "build server"
  pkill -f "app-container-broker/main.js" 2>/dev/null && note "broker"
  nginx -s quit 2>/dev/null && note "nginx"
  sleep 2

  echo
  echo "Writing agents to ${AGENTS}"
  write_agents

  for label in $(labels); do
    launchctl bootout "${DOMAIN_TARGET}/${label}" >/dev/null 2>&1
    if launchctl bootstrap "$DOMAIN_TARGET" "${AGENTS}/${label}.plist" 2>/dev/null; then
      ok "$label"
    else
      ko "$label — ${LOGS}/${label}.log"
    fi
  done

  echo
  sleep 3
  cmd_status
}

cmd_uninstall() {
  for label in $(labels); do
    launchctl bootout "${DOMAIN_TARGET}/${label}" >/dev/null 2>&1
    rm -f "${AGENTS}/${label}.plist"
    ok "removed ${label}"
  done
  note "the containers are untouched — ganymede-apple.sh down / gateway-apple.sh down"
}

cmd_restart() {
  for label in $(labels); do
    launchctl kickstart -k "${DOMAIN_TARGET}/${label}" >/dev/null 2>&1 \
      && ok "$label" || warn "$label is not loaded"
  done
}

# What is loaded, what is actually answering, and the difference between them.
# A loaded agent whose port is silent is the state this whole script exists to
# make visible.
cmd_status() {
  echo "============================================="
  printf "%-24s %-10s %s\n" "AGENT" "LAUNCHD" "LISTENING"
  local listens=(
    "${PREFIX}.coredns:127.0.0.1:${DNS_PORT}:udp"
    "${PREFIX}.nginx:*:${HTTPS_PORT}:tcp"
    "${PREFIX}.nginx-reload::"
    "${PREFIX}.buildserver:*:${BUILD_PORT}:tcp"
    "${PREFIX}.broker:*:${BROKER_PORT}:tcp"
    "${PREFIX}.gateways::"
  )
  for entry in "${listens[@]}"; do
    local label="${entry%%:*}" rest="${entry#*:}"
    local loaded="no"
    launchctl print "${DOMAIN_TARGET}/${label}" >/dev/null 2>&1 && loaded="yes"

    local port="" proto=""
    port="$(printf '%s' "$rest" | cut -d: -f2)"
    proto="$(printf '%s' "$rest" | cut -d: -f3)"

    local answering="—"
    if [ -n "$port" ]; then
      if [ "$proto" = "udp" ]; then
        lsof -nP -iUDP:"$port" >/dev/null 2>&1 && answering="yes" || answering="NO"
      else
        lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 && answering="yes" || answering="NO"
      fi
    fi

    if [ "$loaded" = "yes" ] && [ "$answering" = "NO" ]; then
      printf "  ${RED}%-22s %-10s %s${NC}\n" "${label#${PREFIX}.}" "$loaded" "$answering"
    else
      printf "  %-22s %-10s %s\n" "${label#${PREFIX}.}" "$loaded" "$answering"
    fi
  done
  echo "============================================="
  note "logs: ${LOGS}/${PREFIX}.<name>.log"
}

case "${1:-status}" in
  install)   cmd_install ;;
  uninstall) cmd_uninstall ;;
  restart)   cmd_restart ;;
  status)    cmd_status ;;
  *) echo "usage: $0 [install|status|restart|uninstall]"; exit 1 ;;
esac
