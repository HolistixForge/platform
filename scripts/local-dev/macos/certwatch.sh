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
#
# This is a local-development answer and deliberately not a design for
# production, where the naming itself is the thing to fix (TAC-187): one label
# per container means one certificate name per container, and no amount of
# automation makes that free at scale. Here it costs a `mkcert` run and a
# reload, and it removes a step nobody can be expected to remember.

set -uo pipefail

ENV_NAME="${ENV_NAME:-apollo}"
DOMAIN="${DOMAIN:-apollo.test}"
CONF_DIR="${HOME}/.holistix-macos"
CERTS="${CONF_DIR}/certs"
CERT="${CERTS}/${DOMAIN}.pem"
KEY="${CERTS}/${DOMAIN}-key.pem"
GATEWAYS_D="${NGINX_GATEWAYS_DIR:-${CONF_DIR}/nginx-gateways.d}"
LOG="${CONF_DIR}/certwatch.log"
INTERVAL="${CERTWATCH_INTERVAL:-10}"

GREEN='\033[0;32m'; RED='\033[0;31m'; GRAY='\033[0;90m'; NC='\033[0m'
ok()   { printf "  ${GREEN}✓${NC} %s\n" "$1"; }
ko()   { printf "  ${RED}✗${NC} %s\n" "$1"; }
note() { printf "  ${GRAY}%s${NC}\n" "$1"; }

command -v mkcert >/dev/null || { echo "mkcert not found — brew install mkcert"; exit 1; }
command -v container >/dev/null || { echo "container not found"; exit 1; }

stamp() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

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
  for c in $(container list --format json 2>/dev/null \
    | sed -n 's/.*"id" *: *"\(gw-pool-[^"]*\)".*/\1/p' | sort -u); do
    container exec "$c" sh -c \
      'grep -h "server_name" /etc/nginx/conf.d/*.conf 2>/dev/null' 2>/dev/null
  done \
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

  ( cd "$CERTS" && mkcert -cert-file "${DOMAIN}.pem" -key-file "${DOMAIN}-key.pem" \
      "${args[@]}" >>"$LOG" 2>&1 ) || { ko "mkcert failed — ${LOG}"; return 1; }

  # Through the queue nginx-reload.sh serves, not `nginx -s reload` directly:
  # the reload may need a password this has no way to ask for, and the queue is
  # already the one path every other writer on this machine uses.
  mkdir -p "${GATEWAYS_D}/.requests"
  : >"${GATEWAYS_D}/.requests/certwatch-$$"
  printf '%s  reissued for %s names\n' "$(stamp)" "$(echo "$wanted" | wc -w | tr -d ' ')" >>"$LOG"
  ok "certificate reissued and a reload requested"
}

check_once() {
  mkdir -p "$CERTS"
  local parents missing wanted
  parents="$(serving_parents)"

  local sans
  sans="$(cert_sans)"

  # The union with what the certificate already covers, not a replacement.
  #
  # `serving_parents` is a snapshot, and a gateway that is restarting or slow
  # contributes nothing to it — `container exec` fails and the failure is
  # swallowed. Reissuing from that snapshot alone would drop every name whose
  # gateway happened to be quiet during one pass, and `mkcert` writes only the
  # names it is given: a service nobody touched would go unreachable in the
  # browser the next time anything else triggered a rebuild. A name is only
  # ever added here; the certificate is reissued from scratch when its own
  # expiry comes, which is where forgetting belongs.
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
  mkdir -p "$CONF_DIR"
  printf '%s  watching for uncovered service names\n' "$(stamp)" >>"$LOG"
  while true; do
    check_once
    sleep "$INTERVAL"
  done
}

case "${1:-once}" in
  once)  check_once ;;
  watch) watch_loop ;;
  names) serving_parents ;;
  sans)  cert_sans ;;
  *) echo "usage: $0 [once|watch|names|sans]"; exit 1 ;;
esac
