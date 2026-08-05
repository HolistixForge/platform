#!/bin/bash
# =============================================================================
# nginx-reload.sh — reload the host's nginx when Ganymede asks for it
# =============================================================================
# On Linux, Ganymede and nginx are two processes on one host, so Ganymede runs
# `nginx -s reload` itself. On macOS Ganymede is in a container and nginx is
# Homebrew's on the Mac: no signal crosses that boundary.
#
# So Ganymede drops a request file in the directory it already shares with
# nginx — NGINX_RELOAD_COMMAND, which defaults to `sudo nginx -s reload`, runs
# the requester instead — and this serves the queue. One file per request and
# one acknowledgement per file: a single slot loses a request whenever two
# arrive within a polling interval, and the loser waits out its timeout for a
# confirmation nobody will write.
#
#   ./nginx-reload.sh watch    stay in the foreground and reload on demand
#   ./nginx-reload.sh once     test and reload now
#   ./nginx-reload.sh start    the same watch, detached, one per machine
#   ./nginx-reload.sh stop
#
# `nginx -t` runs here rather than in the container, which is the only place it
# can: the container cannot see the certificates or the main configuration the
# gateway blocks are included from. A block that does not parse therefore
# reaches this side and is refused here, after Ganymede believed it had
# reloaded — so a refusal is printed loudly and left in the log rather than
# swallowed. It is the one thing this arrangement gives up.

set -uo pipefail

CONF_DIR="${HOME}/.holistix-macos"
GATEWAYS_D="${NGINX_GATEWAYS_DIR:-${CONF_DIR}/nginx-gateways.d}"
REQUESTS="${GATEWAYS_D}/.requests"
ACKS="${GATEWAYS_D}/.acks"
LOG="${CONF_DIR}/nginx-reload.log"
PIDFILE="${CONF_DIR}/nginx-reload.pid"
INTERVAL="${NGINX_RELOAD_INTERVAL:-0.2}"

GREEN='\033[0;32m'; RED='\033[0;31m'; GRAY='\033[0;90m'; NC='\033[0m'
ok()   { printf "  ${GREEN}✓${NC} %s\n" "$1"; }
ko()   { printf "  ${RED}✗${NC} %s\n" "$1"; }
note() { printf "  ${GRAY}%s${NC}\n" "$1"; }

command -v nginx >/dev/null || { echo "nginx not found — brew install nginx"; exit 1; }

stamp() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

# Every request taken in this pass is acknowledged, not just the last one seen.
# The callers wait on their own token, and one reload satisfies all of them.
reload_now() {
  local tokens="${1:-}"
  local test_output
  if ! test_output="$(nginx -t 2>&1)"; then
    printf '%s  REFUSED\n%s\n' "$(stamp)" "$test_output" >>"$LOG"
    ko "nginx refused the configuration — it was NOT reloaded"
    note "$LOG"
    return 1
  fi
  if nginx -s reload 2>>"$LOG"; then
    # The acknowledgements. Each caller waits for its own token to appear,
    # because "I asked for a reload" is not "nginx is serving the new
    # configuration" — a request made in between goes to the default server and
    # gets a plausible answer from the wrong place.
    mkdir -p "${GATEWAYS_D}/.acks"
    for tok in $tokens; do : >"${GATEWAYS_D}/.acks/${tok}"; done
    printf '%s  reloaded\n' "$(stamp)" >>"$LOG"
    ok "nginx reloaded"
    return 0
  fi
  # Nothing to signal: nginx is not running. Starting it is not this script's
  # decision to make silently, so it says so.
  printf '%s  reload failed — is nginx running?\n' "$(stamp)" >>"$LOG"
  ko "could not signal nginx — start it with:  nginx"
  return 1
}

watch_loop() {
  mkdir -p "$GATEWAYS_D" "$REQUESTS" "$ACKS"
  # Anything already queued was left by an earlier run and has no caller still
  # waiting on it; serving it would reload for nobody.
  rm -f "$REQUESTS"/* 2>/dev/null
  printf '%s  watching %s\n' "$(stamp)" "$REQUESTS" >>"$LOG"
  while true; do
    local pending
    pending="$(ls -1 "$REQUESTS" 2>/dev/null)"
    if [ -n "$pending" ]; then
      # Claimed before the reload, so a request arriving during it is not
      # swallowed — it stays queued and the next pass serves it.
      for tok in $pending; do rm -f "${REQUESTS}/${tok}"; done
      reload_now "$pending"
    fi
    sleep "$INTERVAL"
  done
}

case "${1:-watch}" in
  watch) watch_loop ;;
  once)  reload_now ;;
  start)
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
      ok "already watching (pid $(cat "$PIDFILE"))"
      exit 0
    fi
    mkdir -p "$CONF_DIR"
    nohup "$0" watch >>"$LOG" 2>&1 &
    echo $! >"$PIDFILE"
    sleep 1
    kill -0 "$(cat "$PIDFILE")" 2>/dev/null \
      && ok "watching ${REQUESTS} (pid $(cat "$PIDFILE"), log ${LOG})" \
      || { ko "did not start — ${LOG}"; exit 1; }
    ;;
  stop)
    [ -f "$PIDFILE" ] && kill "$(cat "$PIDFILE")" 2>/dev/null
    rm -f "$PIDFILE"
    ok "stopped"
    ;;
  *) echo "usage: $0 [watch|once|start|stop]"; exit 1 ;;
esac
