#!/bin/bash
# =============================================================================
# certwatch.sh — keep the local certificate covering the services that exist
# =============================================================================
# A user service is reached at `{service}.uc-{container}.org-{org}.{domain}`,
# and a TLS wildcard matches exactly one label (RFC 6125). So `*.{domain}` does
# not cover it, `*.org-{org}.{domain}` does not cover it either, and the only
# name that does is `*.uc-{container}.org-{org}.{domain}` — one per container,
# minted when the container is.
#
# Nothing minted them. Every service created after the certificate was issued
# was therefore unreachable in the browser with "refused to connect", while the
# gateway routed it correctly and `curl -k` served the page: the failure is a
# certificate the browser will not accept, and it looks nothing like one.
#
# This watches the names the gateways are actually serving — they write them
# into their own nginx as they learn them, which makes them the only honest
# source — and reissues when one is not covered.
#
#   ./certwatch.sh once      check now, reissue if needed
#   ./certwatch.sh watch     the same, on an interval, in the foreground
#   ./certwatch.sh names     print what the gateways are serving
#   ./certwatch.sh sans      print what the certificate covers
#   ./certwatch.sh engine    print the engine and paths in use
#
# Both engines, one implementation. Apple `container` on macOS and Docker on
# the Linux platform host differ in three places and three only — how gateways
# are listed, how a command runs inside one, and how nginx is reloaded — so
# those are functions and the rest is shared. A second copy for Linux would
# drift from this one, and the two things worth keeping (see `serving_parents`
# and `reissue`) are exactly the parts that are easy to get wrong twice.
#
# The Linux path has the same one-label limit: `create-env.sh` issues
# `${DOMAIN}` and `*.${DOMAIN}` once, at environment creation, and nothing ever
# adds to them.
#
# This is a local-development answer and deliberately not a design for
# production, where the naming itself is the thing to fix (TAC-187): one label
# per container means one certificate name per container, and no amount of
# automation makes that free at scale. Here it costs a `mkcert` run and a
# reload, and it removes a step nobody can be expected to remember.

set -uo pipefail

ENV_NAME="${ENV_NAME:-apollo}"
DOMAIN="${DOMAIN:-apollo.test}"
INTERVAL="${CERTWATCH_INTERVAL:-10}"

GREEN='\033[0;32m'; RED='\033[0;31m'; GRAY='\033[0;90m'; NC='\033[0m'
ok()   { printf "  ${GREEN}✓${NC} %s\n" "$1"; }
ko()   { printf "  ${RED}✗${NC} %s\n" "$1"; }
note() { printf "  ${GRAY}%s${NC}\n" "$1"; }

command -v mkcert >/dev/null || { echo "mkcert not found — brew install mkcert / install-mkcert.sh"; exit 1; }

# --------------------------------------------------------------------------
# Which engine, and where its certificate lives
# --------------------------------------------------------------------------
# Explicit wins. Otherwise Apple `container` is preferred when its daemon
# actually answers — `command -v` is not enough, the binary can be installed on
# a machine where the service is not running, and every call would then fail
# one at a time instead of once here.
ENGINE="${CERTWATCH_ENGINE:-}"
if [ -z "$ENGINE" ]; then
  if command -v container >/dev/null && container system status >/dev/null 2>&1; then
    ENGINE=apple
  elif command -v docker >/dev/null; then
    ENGINE=docker
  else
    echo "no container engine found — set CERTWATCH_ENGINE=apple|docker"
    exit 1
  fi
fi

case "$ENGINE" in
  apple)
    CONF_DIR="${CONF_DIR:-${HOME}/.holistix-macos}"
    CERT="${CERTWATCH_CERT:-${CONF_DIR}/certs/${DOMAIN}.pem}"
    KEY="${CERTWATCH_KEY:-${CONF_DIR}/certs/${DOMAIN}-key.pem}"
    # nginx runs on this Mac and Ganymede is in a container, so the reload goes
    # through the queue nginx-reload.sh serves rather than being run here.
    GATEWAYS_D="${NGINX_GATEWAYS_DIR:-${CONF_DIR}/nginx-gateways.d}"
    LOG="${CERTWATCH_LOG:-${CONF_DIR}/certwatch.log}"
    ;;
  docker)
    # Where create-env.sh puts them, under the names its nginx blocks reference.
    CONF_DIR="${CONF_DIR:-/root/.local-dev/${ENV_NAME}}"
    CERT="${CERTWATCH_CERT:-${CONF_DIR}/ssl-cert.pem}"
    KEY="${CERTWATCH_KEY:-${CONF_DIR}/ssl-key.pem}"
    GATEWAYS_D=""
    LOG="${CERTWATCH_LOG:-${CONF_DIR}/certwatch.log}"
    ;;
  *) echo "unknown CERTWATCH_ENGINE '${ENGINE}' — apple|docker"; exit 1 ;;
esac

# The same default nginx-manager.ts uses, and overridable the same way, so a
# host that needs something else needs to say it once.
RELOAD_COMMAND="${NGINX_RELOAD_COMMAND:-sudo nginx -s reload}"

stamp() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

# --------------------------------------------------------------------------
# The three engine-specific things
# --------------------------------------------------------------------------
# The gateway containers of this environment, one name per line.
gateway_names() {
  case "$ENGINE" in
    apple)
      # `grep -o`, not `sed`.
      #
      # `container list --format json` emits the whole array on one line, and
      # sed substitutes once per line with a greedy `.*` — so it returned
      # exactly one gateway no matter how many were running, and which one
      # depended on the array's order. Measured: two gateways up, the allocated
      # one serving three user-service names, and this printed the *other*
      # one's id and therefore no names at all. The certificate then went a
      # whole organization without being reissued, and every service in it
      # failed in the browser only — the gateway routed it and `curl -k` served
      # the page.
      #
      # `grep -o` prints every match on its own line, which is the property
      # this needs and the one sed does not have here.
      container list --format json 2>/dev/null \
        | grep -o '"id" *: *"gw-pool-[^"]*"' \
        | sed 's/.*"\(gw-pool-[^"]*\)"$/\1/' | sort -u
      ;;
    docker)
      docker ps --filter "name=gw-pool-${ENV_NAME}-" --format '{{.Names}}' \
        2>/dev/null | sort -u
      ;;
  esac
}

# Read the `server_name` lines out of one gateway's own nginx.
gateway_server_names() {
  local c="$1" cmd='grep -h "server_name" /etc/nginx/conf.d/*.conf 2>/dev/null'
  case "$ENGINE" in
    apple)  container exec "$c" sh -c "$cmd" 2>/dev/null ;;
    docker) docker exec "$c" sh -c "$cmd" 2>/dev/null ;;
  esac
}

# Ask for a reload and find out whether it happened.
#
# Not fire-and-forget. `nginx -t` refusing means the new certificate is written
# and *not being served*, so the browser keeps failing exactly as before while
# this prints "reissued" — the same shape of silent failure this whole script
# exists to remove. On Apple the refusal can only be seen on the host side, and
# the queue writes it to `<token>.err`; that file is the only way it gets back
# here.
#
# A fresh token per reissue, never one for the life of the watcher: the queue
# answers per token, and a name reused across reissues would match a leftover
# acknowledgement from the previous one and report success without waiting.
request_reload() {
  if [ "$ENGINE" = docker ]; then
    if $RELOAD_COMMAND >>"$LOG" 2>&1; then
      ok "nginx reloaded"
      return 0
    fi
    ko "nginx did not reload — ${LOG}"
    return 1
  fi

  local token="certwatch-$$-$(date +%s)"
  mkdir -p "${GATEWAYS_D}/.requests" "${GATEWAYS_D}/.acks" || return 1
  : >"${GATEWAYS_D}/.requests/${token}" || return 1

  local i=0
  while [ $i -lt 100 ]; do
    if [ -e "${GATEWAYS_D}/.acks/${token}.err" ]; then
      ko "nginx refused the configuration — the new certificate is NOT being served"
      cat "${GATEWAYS_D}/.acks/${token}.err" >&2
      rm -f "${GATEWAYS_D}/.acks/${token}.err"
      return 1
    fi
    if [ -e "${GATEWAYS_D}/.acks/${token}" ]; then
      rm -f "${GATEWAYS_D}/.acks/${token}"
      ok "nginx reloaded — the new names are being served"
      return 0
    fi
    sleep 0.1
    i=$((i + 1))
  done
  rm -f "${GATEWAYS_D}/.requests/${token}"
  ko "nginx did not acknowledge within 10s — is nginx-reload.sh running?"
  return 1
}

# --------------------------------------------------------------------------
# The shared part
# --------------------------------------------------------------------------
# The names the gateways are serving, as wildcard *parents*.
#
# A gateway writes one server block per service, so it holds
# `n8n.uc-abc.org-def.apollo.test`. What the certificate needs is the parent of
# that name with a wildcard in front — `*.uc-abc.org-def.apollo.test` — which
# covers every other service the same container ever publishes without another
# reissue. Taking the parent rather than the leaf is what keeps this from
# running once per service instead of once per container.
serving_parents() {
  local c
  while read -r c; do
    [ -z "$c" ] && continue
    gateway_server_names "$c"
  done < <(gateway_names) \
    | sed -n "s/.*server_name  *\([^;]*\)\.${DOMAIN};.*/\1.${DOMAIN}/p" \
    | grep -v '^_' \
    | sed 's/^[^.]*\.//' \
    | sed "s/^/*./" \
    | sort -u
}

cert_sans() {
  [ -f "$CERT" ] || return 0
  openssl x509 -in "$CERT" -noout -text 2>/dev/null \
    | sed -n '/Subject Alternative Name/{n;p;}' \
    | tr ',' '\n' | sed -n 's/.*DNS:\(.*\)/\1/p' | tr -d ' ' | sort -u
}

# Reissue with everything, not just the new name. `mkcert` writes one
# certificate per invocation and the names it is not given are the names it
# drops — reissuing for the container that just appeared would take every other
# service offline, which is a worse failure than the one this fixes.
reissue() {
  local wanted="$1"
  local args=("${DOMAIN}" "*.${DOMAIN}")
  local n
  for n in $wanted; do args+=("$n"); done
  args+=(localhost 127.0.0.1 ::1)

  local dir cert_file key_file
  dir="$(dirname "$CERT")"
  cert_file="$(basename "$CERT")"
  key_file="$(basename "$KEY")"
  mkdir -p "$dir"

  ( cd "$dir" && mkcert -cert-file "$cert_file" -key-file "$key_file" \
      "${args[@]}" >>"$LOG" 2>&1 ) || { ko "mkcert failed — ${LOG}"; return 1; }

  printf '%s  reissued for %s names\n' "$(stamp)" "$(echo "$wanted" | wc -w | tr -d ' ')" >>"$LOG"
  request_reload
}

check_once() {
  local parents missing wanted
  parents="$(serving_parents)"

  local sans
  sans="$(cert_sans)"

  # The union with what the certificate already covers, not a replacement.
  #
  # `serving_parents` is a snapshot, and a gateway that is restarting or slow
  # contributes nothing to it — the exec fails and the failure is swallowed.
  # Reissuing from that snapshot alone would drop every name whose gateway
  # happened to be quiet during one pass, and `mkcert` writes only the names it
  # is given: a service nobody touched would go unreachable in the browser the
  # next time anything else triggered a rebuild. A name is only ever added
  # here; the certificate is reissued from scratch when its own expiry comes,
  # which is where forgetting belongs.
  #
  # Every organization's own wildcard as well as every container's. The gateway
  # publishes `uc-{container}.org-{org}.{domain}` for the auth guard, whose
  # parent is the organization — so this falls out of the same list and there
  # is nothing extra to enumerate.
  wanted="$(printf '%s\n%s\n' "$parents" "$(printf '%s\n' "$sans" | grep '^\*\..*\.' || true)" \
    | grep -v '^$' | sort -u)"
  [ -z "$wanted" ] && { note "no gateway is serving a user service yet"; return 0; }
  missing=""
  local n
  for n in $wanted; do
    printf '%s\n' "$sans" | grep -qxF "$n" || missing="${missing} ${n}"
  done

  if [ -z "$missing" ]; then
    return 0
  fi
  note "not covered:${missing}"
  reissue "$wanted"
}

watch_loop() {
  mkdir -p "$(dirname "$LOG")"
  printf '%s  watching for uncovered service names (%s)\n' "$(stamp)" "$ENGINE" >>"$LOG"
  while true; do
    check_once
    sleep "$INTERVAL"
  done
}

cmd_engine() {
  printf "  engine  %s\n  cert    %s\n  key     %s\n  reload  %s\n" \
    "$ENGINE" "$CERT" "$KEY" \
    "$([ "$ENGINE" = docker ] && echo "$RELOAD_COMMAND" || echo "${GATEWAYS_D}/.requests")"
  printf "  gateways\n"
  gateway_names | sed 's/^/    /'
}

case "${1:-once}" in
  once)   check_once ;;
  watch)  watch_loop ;;
  names)  serving_parents ;;
  sans)   cert_sans ;;
  engine) cmd_engine ;;
  *) echo "usage: $0 [once|watch|names|sans|engine]"; exit 1 ;;
esac
