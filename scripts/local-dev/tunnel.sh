#!/bin/bash
# =============================================================================
# tunnel.sh — put a local environment on the internet, on one hostname
# =============================================================================
#
#   ./tunnel.sh up [cloudflare|tailscale]   expose this environment, print the URL
#   ./tunnel.sh url                         print the public URL again
#   ./tunnel.sh status                      what is running, and what answers
#   ./tunnel.sh down                        stop exposing it
#
# The platform addresses its pieces by name — the frontend at `<domain>`,
# Ganymede at `ganymede.<domain>`, a gateway per organization at
# `org-<uuid>.<domain>` — and that needs wildcard DNS and a wildcard
# certificate. A tunnel gives neither: a Cloudflare quick tunnel is one
# `*.trycloudflare.com` name minted at start, a Tailscale funnel is one machine
# name. There is no `ganymede.` in front of either.
#
# So on a tunnel the same three pieces are addressed by path instead, and this
# script is what arranges that: one nginx server block that answers on *any*
# hostname, serving the frontend at `/`, Ganymede at `/-/ganymede/` and each
# organization's gateway at `/-/gw/org-<uuid>/`. Nothing needs to know the
# public name in advance, which is what makes a quick tunnel usable at all.
#
# The application follows on its own. The frontend compares the host it was
# served from against the one it was built for and switches to paths when they
# differ; Ganymede does the same per request and hands out gateway locations to
# match. See doc/guides/PUBLIC_TUNNEL.md.
#
# What is *not* arranged here, stated so it is not discovered: the nested names
# a user container is published under — `uc-<id>.org-<uuid>.<domain>` — have no
# path form, and are reachable on the local domain only. Everything the
# platform itself serves is reachable through the tunnel.

set -uo pipefail

ENV_NAME="${ENV_NAME:-apollo}"
PROVIDER_DEFAULT="${TUNNEL_PROVIDER:-cloudflare}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; GRAY='\033[0;90m'; NC='\033[0m'
ok()   { printf "  ${GREEN}✓${NC} %s\n" "$1"; }
ko()   { printf "  ${RED}✗${NC} %s\n" "$1"; }
warn() { printf "  ${YELLOW}!${NC} %s\n" "$1"; }
note() { printf "  ${GRAY}%s${NC}\n" "$1"; }

# -----------------------------------------------------------------------------
# Where this environment lives
# -----------------------------------------------------------------------------
# Two layouts, both current: create-env.sh writes .env.ganymede under
# /root/.local-dev on Linux, the macOS harness writes ganymede.env under
# ~/.holistix-macos. build-frontend.sh already probes for the pair in this
# order; this keeps to it so the two never disagree about which environment is
# meant.
locate_env() {
  for candidate in \
    "/root/.local-dev/${ENV_NAME}/.env.ganymede" \
    "${HOME}/.holistix-macos/${ENV_NAME}/ganymede.env"; do
    [ -f "$candidate" ] && { ENV_FILE="$candidate"; return 0; }
  done
  ko "environment '${ENV_NAME}' not found"
  note "Looked for:"
  note "  /root/.local-dev/${ENV_NAME}/.env.ganymede   (Linux)"
  note "  ${HOME}/.holistix-macos/${ENV_NAME}/ganymede.env   (macOS)"
  note "Set another with:  ENV_NAME=<name> $0 ${1:-up}"
  return 1
}

env_value() {
  grep "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'
}

# The value of a single-argument nginx directive, quotes off.
#
# Not `awk '{print $2}'`: a checkout on an external volume carries that
# volume's name and those have spaces, so the site file quotes its `root` —
# and field two of that line is `"/Volumes`. Read that way, the public block
# gets a truncated root and serves 404 for the whole application.
directive_value() {
  awk -v want="$1" '
    $1 == want {
      line = $0
      sub("^[[:space:]]*" want "[[:space:]]+", "", line)
      sub(/[[:space:]]*;[[:space:]]*$/, "", line)
      gsub(/^"|"$/, "", line)
      print line
      exit
    }
  ' "$SITE_FILE"
}

# The nginx site this environment already has is the single source of truth for
# the four things below. Deriving them from it rather than recomputing them
# means the public server block cannot drift from the private ones — a
# frontend root or a Ganymede port guessed differently here would produce a
# tunnel that serves a stale build, or a 502, with nothing obviously wrong.
locate_site() {
  if command -v nginx >/dev/null 2>&1; then
    local conf_dir
    conf_dir="$(nginx -V 2>&1 | tr ' ' '\n' | grep -- '--conf-path=' | cut -d= -f2 | xargs dirname 2>/dev/null)"
    for candidate in \
      "${conf_dir}/servers/holistix-${DOMAIN_HOST}.conf" \
      "/etc/nginx/sites-available/${ENV_NAME}"; do
      [ -f "$candidate" ] && { SITE_FILE="$candidate"; return 0; }
    done
  fi
  [ -f "/etc/nginx/sites-available/${ENV_NAME}" ] && {
    SITE_FILE="/etc/nginx/sites-available/${ENV_NAME}"; return 0;
  }
  ko "no nginx site found for '${ENV_NAME}'"
  note "Create it first:  scripts/local-dev/macos/setup-nginx.sh ${DOMAIN_HOST} ${HTTPS_PORT}"
  note "            or:   scripts/local-dev/create-env.sh ${ENV_NAME}"
  return 1
}

load_environment() {
  locate_env "$@" || return 1

  # DOMAIN carries the port on the macOS layout — `apollo.test:8443`, because
  # nginx does not listen on 443 there. Both halves are needed and they are
  # needed apart: the host for a certificate path and a server_name, the port
  # for what to dial.
  local domain
  domain="$(env_value DOMAIN)"
  [ -n "$domain" ] || { ko "DOMAIN is not set in ${ENV_FILE}"; return 1; }
  DOMAIN_HOST="${domain%%:*}"
  case "$domain" in
    *:*) HTTPS_PORT="${domain##*:}" ;;
    *)   HTTPS_PORT="$(env_value NGINX_LISTEN_PORT)"; HTTPS_PORT="${HTTPS_PORT:-443}" ;;
  esac

  locate_site || return 1

  # Read out of the Ganymede server block, not the file at large: the gateway
  # blocks written by Ganymede also contain proxy_pass lines, and on Linux they
  # are included into this same file.
  #
  # Both of the values below are overridable from the environment, like
  # ENV_NAME and DOMAIN are. The site file is the right default and almost
  # always the right answer; the exception is a second build of the same
  # environment — a branch's Ganymede on another port, a frontend built in
  # another checkout — which is exactly what you want a public URL for.
  [ -n "${GANYMEDE_PORT:-}" ] && GANYMEDE_PORT_OVERRIDDEN=1
  GANYMEDE_PORT="${GANYMEDE_PORT:-$(awk '
    /server_name[[:space:]]+ganymede\./ { in_gany = 1 }
    in_gany && /proxy_pass[[:space:]]+http:\/\/127\.0\.0\.1:/ {
      match($0, /127\.0\.0\.1:[0-9]+/)
      print substr($0, RSTART + 10, RLENGTH - 10)
      exit
    }
  ' "$SITE_FILE")}"
  [ -n "$GANYMEDE_PORT" ] || {
    ko "could not find Ganymede's port in ${SITE_FILE}"
    return 1
  }

  FRONTEND_ROOT="${FRONTEND_ROOT:-$(directive_value root)}"
  SSL_CERT="$(directive_value ssl_certificate)"
  SSL_KEY="$(directive_value ssl_certificate_key)"
  for v in FRONTEND_ROOT SSL_CERT SSL_KEY; do
    [ -n "${!v}" ] || { ko "could not read ${v} out of ${SITE_FILE}"; return 1; }
  done

  # Same directory Ganymede writes its gateway configs into; its `locations`
  # subdirectory is the by-path form of each, which the public block includes.
  GATEWAYS_D="$(env_value NGINX_GATEWAYS_DIR)"
  case "${ENV_FILE}" in
    "${HOME}/.holistix-macos/"*)
      LAYOUT=macos
      CONF_DIR="${HOME}/.holistix-macos"
      # NGINX_GATEWAYS_DIR is a path *inside* Ganymede's container there; the
      # host side of the same bind mount is what nginx reads.
      GATEWAYS_D="${CONF_DIR}/nginx-gateways.d"
      LOGS_DIR="${CONF_DIR}/logs"
      PUBLIC_CONF="$(dirname "$SITE_FILE")/holistix-public.conf"
      ;;
    *)
      LAYOUT=linux
      CONF_DIR="/root/.local-dev/${ENV_NAME}"
      GATEWAYS_D="${GATEWAYS_D:-${CONF_DIR}/nginx-gateways.d}"
      LOGS_DIR="${CONF_DIR}/logs"
      PUBLIC_CONF="/etc/nginx/sites-available/holistix-public"
      ;;
  esac

  STATE_DIR="${CONF_DIR}/tunnel"
  mkdir -p "$STATE_DIR" "${GATEWAYS_D}/locations"
  [ -f "${GATEWAYS_D}/locations/00-placeholder.conf" ] || \
    printf '# Ganymede writes one location here per gateway.\n' \
      > "${GATEWAYS_D}/locations/00-placeholder.conf"
}

# -----------------------------------------------------------------------------
# nginx
# -----------------------------------------------------------------------------

nginx_write_public() {
  local public_host="$1"

  # `default_server` and `server_name _` together: the first is what makes this
  # block answer for a Host that matches no other server_name, the second makes
  # sure it never *wins* one that does. A tunnel hostname matches nothing, so
  # it lands here; `apollo.test` keeps going to the block that names it.
  #
  # $public_host is the name the browser used, and it is a map rather than
  # $host because a tunnel daemon may rewrite Host to the origin it dialled.
  # Ganymede decides "is this request same-origin" by comparing the browser's
  # Origin header to the host the request arrived on, so getting this wrong
  # does not misroute anything — it fails every state-changing request with a
  # 403 from the CSRF gate, which reads as the application being broken.
  #
  # `^~` on the two platform prefixes. Without it the regex location for
  # static assets below wins over a prefix match — that is nginx's rule, not a
  # matter of order — and a request for anything under /-/ ending in .js would
  # be looked for on disk instead of proxied.
  local tmp="${STATE_DIR}/holistix-public.conf.new"
  cat > "$tmp" <<EOF
# Holistix — public entry point for '${ENV_NAME}', written by scripts/local-dev/tunnel.sh
# Public URL: https://${public_host}
#
# DO NOT EDIT: rewritten on every 'tunnel.sh up', removed by 'tunnel.sh down'.

map \$http_x_forwarded_host \$public_host {
    default \$http_x_forwarded_host;
    ""      "${public_host}";
}

server {
    listen ${HTTPS_PORT} ssl default_server;
    server_name _;

    ssl_certificate "${SSL_CERT}";
    ssl_certificate_key "${SSL_KEY}";

    # Quoted, all of them: a checkout on an external volume carries that
    # volume's name and those have spaces. Unquoted, nginx counts the words and
    # refuses the whole configuration — "invalid number of arguments in root
    # directive" — which names the directive and not the reason.
    root "${FRONTEND_ROOT}";
    index index.html;

    # Ganymede.
    location = /-/ganymede { return 308 /-/ganymede/; }
    location ^~ /-/ganymede/ {
        proxy_pass http://127.0.0.1:${GANYMEDE_PORT}/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$public_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Host \$public_host;
    }

    # One file per organization, written by Ganymede as it allocates gateways.
    include "${GATEWAYS_D}/locations/*.conf";

    # The frontend, byte for byte what the private block serves.
    location / {
        try_files \$uri /index.html;
    }

    location = /index.html {
        expires -1;
    }

    location ~* \.(js|css|svg|ttf|woff|woff2)\$ {
        expires max;
        add_header Cache-Control public;
        error_page 404 = @stale_bundle;
    }

    location @stale_bundle {
        add_header Clear-Site-Data '"cache"' always;
        return 404;
    }

    access_log "${LOGS_DIR}/public-access.log";
    error_log "${LOGS_DIR}/public-error.log";
}
EOF

  install_conf "$tmp" || return 1
  nginx_reload
}

install_conf() {
  local src="$1"
  if [ "$LAYOUT" = linux ]; then
    sudo cp "$src" "$PUBLIC_CONF" || return 1
    sudo ln -sf "$PUBLIC_CONF" "/etc/nginx/sites-enabled/holistix-public" || return 1
  else
    cp "$src" "$PUBLIC_CONF" || return 1
  fi
  rm -f "$src"
  ok "wrote ${PUBLIC_CONF}"
}

remove_conf() {
  if [ "$LAYOUT" = linux ]; then
    sudo rm -f "$PUBLIC_CONF" "/etc/nginx/sites-enabled/holistix-public"
  else
    rm -f "$PUBLIC_CONF"
  fi
}

# Not `pgrep -x nginx`. nginx rewrites its own argv, so the master's process
# name is "nginx: master process /usr/.../nginx …" and an exact-name match
# never finds it. Measured: with `-x`, a running nginx was reported as absent,
# this function tried to *start* a second one, that one failed to bind 8443 —
# and the caller was told nginx had started. The public server block was never
# loaded, and the check afterwards passed anyway on the SPA's catch-all.
nginx_running() {
  pgrep -f "nginx: master process" >/dev/null 2>&1
}

nginx_reload() {
  local test_out
  if [ "$LAYOUT" = linux ]; then
    test_out="$(sudo nginx -t 2>&1)"
  else
    test_out="$(nginx -t 2>&1)"
  fi
  if ! printf '%s' "$test_out" | grep -q "successful"; then
    ko "nginx rejected the configuration:"
    printf '%s\n' "$test_out" | sed 's/^/    /'
    return 1
  fi

  local action out rc
  if nginx_running; then action=(-s reload); else action=(); fi
  if [ "$LAYOUT" = linux ]; then
    out="$(sudo nginx "${action[@]}" 2>&1)"; rc=$?
  else
    out="$(nginx "${action[@]}" 2>&1)"; rc=$?
  fi

  # Checked, because it fails in ways that matter and used to be silent: a
  # second nginx that cannot bind, a reload refused for want of permission.
  if [ $rc -ne 0 ]; then
    ko "nginx did not ${action[*]:-start}:"
    printf '%s\n' "$out" | sed 's/^/    /'
    return 1
  fi
  [ ${#action[@]} -gt 0 ] && ok "nginx reloaded" || ok "nginx started"
}

# -----------------------------------------------------------------------------
# Ganymede
# -----------------------------------------------------------------------------
# PUBLIC_TUNNEL is what lets Ganymede trust a hostname it was never configured
# with — see packages/backend-engine/.../public-origin.ts. Off by default, so
# an instance that is not being tunnelled is unaffected by any of this.
ganymede_set_tunnel() {
  local value="$1"

  # Not ours to restart. `GANYMEDE_PORT` in the environment says the operator
  # is pointing this at a Ganymede they are running themselves — a branch
  # build on a spare port, say — and restarting "the" Ganymede would restart
  # a different process than the one being exposed, taking down whatever was
  # serving the environment and still not touching the one behind the tunnel.
  if [ -n "${GANYMEDE_PORT_OVERRIDDEN:-}" ]; then
    warn "PUBLIC_TUNNEL not set: Ganymede is yours (GANYMEDE_PORT=${GANYMEDE_PORT})"
    note "It has to be ${value} in that process's environment, or every"
    note "state-changing request through the tunnel answers 403."
    return 0
  fi

  if grep -q '^PUBLIC_TUNNEL=' "$ENV_FILE"; then
    # A portable in-place edit: `sed -i` takes an argument on BSD and not on
    # GNU, and this script runs on both.
    local tmp="${STATE_DIR}/ganymede.env.new"
    sed "s/^PUBLIC_TUNNEL=.*/PUBLIC_TUNNEL=${value}/" "$ENV_FILE" > "$tmp" \
      && cat "$tmp" > "$ENV_FILE" && rm -f "$tmp"
  else
    printf 'PUBLIC_TUNNEL=%s\n' "$value" >> "$ENV_FILE"
  fi

  if [ "$LAYOUT" = macos ]; then
    # ganymede-apple.sh rewrites this file from its template on every restart,
    # so the value has to travel in the environment as well as in the file —
    # the file is what a restart *preserves*, the variable is what it writes.
    PUBLIC_TUNNEL="$value" ENV_NAME="$ENV_NAME" DOMAIN="$DOMAIN_HOST" \
      HTTPS_PORT="$HTTPS_PORT" \
      "${REPO_ROOT}/scripts/local-dev/macos/ganymede-apple.sh" restart \
      >/dev/null 2>&1 \
      && ok "Ganymede restarted with PUBLIC_TUNNEL=${value}" \
      || { ko "could not restart Ganymede"; \
           note "Run it yourself and read the output:"; \
           note "  PUBLIC_TUNNEL=${value} scripts/local-dev/macos/ganymede-apple.sh restart"; \
           return 1; }
  else
    "${REPO_ROOT}/scripts/local-dev/envctl.sh" restart "$ENV_NAME" ganymede \
      >/dev/null 2>&1 \
      && ok "Ganymede restarted with PUBLIC_TUNNEL=${value}" \
      || { ko "could not restart Ganymede — ./envctl.sh restart ${ENV_NAME}"; return 1; }
  fi
}

# -----------------------------------------------------------------------------
# Providers
# -----------------------------------------------------------------------------

# A Cloudflare quick tunnel: no account, no domain, a fresh hostname per start.
# The hostname is only knowable *after* the daemon has one, which is why the
# nginx block is written afterwards rather than before.
start_cloudflare() {
  command -v cloudflared >/dev/null || {
    ko "cloudflared is not installed"
    note "  brew install cloudflared        (macOS)"
    note "  https://github.com/cloudflare/cloudflared/releases"
    return 1
  }

  local log="${STATE_DIR}/cloudflared.log"
  : > "$log"

  # --no-tls-verify because nginx presents a mkcert certificate that nothing
  # outside this machine has been told to trust, and the connector dials it
  # over the loopback where there is nothing to intercept anyway.
  nohup cloudflared tunnel \
    --url "https://127.0.0.1:${HTTPS_PORT}" \
    --no-tls-verify \
    --origin-server-name "${DOMAIN_HOST}" \
    >> "$log" 2>&1 &
  echo $! > "${STATE_DIR}/cloudflared.pid"

  local url=""
  for _ in $(seq 1 40); do
    url="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$log" | head -1)"
    [ -n "$url" ] && break
    kill -0 "$(cat "${STATE_DIR}/cloudflared.pid")" 2>/dev/null || break
    sleep 1
  done

  [ -n "$url" ] || {
    ko "cloudflared did not report a URL"
    tail -15 "$log" | sed 's/^/    /'
    return 1
  }

  PUBLIC_URL="$url"
}

# Tailscale Funnel: one stable name per machine, and only reachable while the
# funnel is on. No account beyond the tailnet the machine is already in.
start_tailscale() {
  command -v tailscale >/dev/null || {
    ko "tailscale is not installed — https://tailscale.com/download"
    return 1
  }

  # https+insecure, for the same reason cloudflared gets --no-tls-verify.
  tailscale funnel --bg "https+insecure://127.0.0.1:${HTTPS_PORT}" >/dev/null 2>&1 || {
    ko "tailscale funnel refused to start"
    note "Funnel needs to be enabled for this machine in the tailnet policy:"
    note "  tailscale funnel status"
    return 1
  }

  local name
  name="$(tailscale status --json 2>/dev/null | python3 -c '
import json, sys
try:
    print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))
except Exception:
    pass
')"
  [ -n "$name" ] || { ko "could not read this machine name from tailscale"; return 1; }

  PUBLIC_URL="https://${name}"
}

stop_provider() {
  local pidfile="${STATE_DIR}/cloudflared.pid"
  if [ -f "$pidfile" ]; then
    local pid
    pid="$(cat "$pidfile")"
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
      ok "stopped cloudflared (pid ${pid})"
    fi
    rm -f "$pidfile"
  fi

  if [ -f "${STATE_DIR}/provider" ] \
    && [ "$(cat "${STATE_DIR}/provider")" = tailscale ]; then
    tailscale funnel --https=443 off >/dev/null 2>&1 \
      && ok "tailscale funnel off"
  fi
}

# -----------------------------------------------------------------------------
# Checks
# -----------------------------------------------------------------------------

# A bundle built before path routing existed calls `https://ganymede.<domain>`
# no matter what page it was served from, so the tunnel serves a frontend that
# loads and then fails every request against a name the visitor cannot resolve.
# That reads as the tunnel being broken; it is a stale build, and the string
# below is present in every bundle that knows better.
# One probe, judged on what came back rather than on the status line.
check_reachable() {
  local what="$1" url="$2" marker="$3" body code
  body="$(curl -s -w '\n%{http_code}' --max-time 25 "$url" 2>/dev/null)"
  code="${body##*$'\n'}"
  body="${body%$'\n'*}"

  if [ "$code" != 200 ]; then
    warn "$(printf '%-10s %s' "$what" "$code")"
    return 1
  fi
  if ! printf '%s' "$body" | grep -q -- "$marker"; then
    warn "$(printf '%-10s %s, but the body is not %s' "$what" "$code" "$what")"
    note "Something else answered — most likely the SPA catch-all, which"
    note "means the location for it is missing from ${PUBLIC_CONF}."
    return 1
  fi
  ok "$(printf '%-10s %s' "$what" "$code")"
}

check_frontend_build() {
  if grep -rq '/-/ganymede' "${FRONTEND_ROOT}" 2>/dev/null; then
    return 0
  fi
  warn "the built frontend predates path routing — it will call ${DOMAIN_HOST}"
  note "Rebuild it first, or the page will load and everything under it will not:"
  note "  ./scripts/local-dev/build-frontend.sh ${ENV_NAME}"
}

# -----------------------------------------------------------------------------
# Commands
# -----------------------------------------------------------------------------

cmd_up() {
  local provider="${1:-$PROVIDER_DEFAULT}"

  load_environment up || return 1

  echo "Environment"
  note "name       ${ENV_NAME}"
  note "domain     ${DOMAIN_HOST}:${HTTPS_PORT}"
  note "ganymede   127.0.0.1:${GANYMEDE_PORT}"
  note "frontend   ${FRONTEND_ROOT}"
  check_frontend_build
  echo

  echo "Tunnel"
  case "$provider" in
    cloudflare) start_cloudflare || return 1 ;;
    tailscale)  start_tailscale  || return 1 ;;
    *) ko "unknown provider '${provider}' — cloudflare or tailscale"; return 1 ;;
  esac
  printf '%s' "$provider" > "${STATE_DIR}/provider"
  printf '%s' "$PUBLIC_URL" > "${STATE_DIR}/public-url"
  ok "${PUBLIC_URL}"
  echo

  echo "nginx"
  local public_host="${PUBLIC_URL#https://}"
  nginx_write_public "$public_host" || return 1
  echo

  echo "Ganymede"
  ganymede_set_tunnel 1 || return 1
  echo

  # Proof rather than a claim. Through the tunnel, so what is checked is the
  # whole path — connector, nginx, application — and not just the last hop.
  echo "Reachable"
  check_reachable "frontend" "${PUBLIC_URL}/" '<div id="root"'
  # Not the status code. `try_files $uri /index.html` answers 200 with the
  # single-page application for *every* path that is not proxied — so a status
  # check here passes just as happily when the Ganymede location is missing
  # entirely, which is exactly the failure it exists to catch. Measured, on the
  # first real run of this script.
  check_reachable "ganymede" "${PUBLIC_URL}/-/ganymede/oauth/public-key" \
    'publicKey'
  echo

  printf "  ${GREEN}%s${NC}\n" "$PUBLIC_URL"
  note "Anyone with that URL can reach this environment. 'tunnel.sh down' ends it."
}

cmd_url() {
  load_environment url || return 1
  [ -f "${STATE_DIR}/public-url" ] || { ko "no tunnel is up for '${ENV_NAME}'"; return 1; }
  cat "${STATE_DIR}/public-url"; echo
}

cmd_status() {
  load_environment status || return 1

  if [ -f "${STATE_DIR}/public-url" ]; then
    ok "public URL  $(cat "${STATE_DIR}/public-url")"
    note "provider    $(cat "${STATE_DIR}/provider" 2>/dev/null || echo unknown)"
  else
    warn "no tunnel recorded for '${ENV_NAME}'"
  fi

  [ -f "$PUBLIC_CONF" ] && ok "nginx       ${PUBLIC_CONF}" \
                        || warn "nginx       no public server block"

  grep -q '^PUBLIC_TUNNEL=1' "$ENV_FILE" \
    && ok "ganymede    PUBLIC_TUNNEL=1" \
    || warn "ganymede    PUBLIC_TUNNEL is not 1 — hosts it does not know will be refused"

  local pidfile="${STATE_DIR}/cloudflared.pid"
  if [ -f "$pidfile" ] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then
    ok "cloudflared running (pid $(cat "$pidfile"))"
  fi

  if [ -f "${STATE_DIR}/public-url" ]; then
    local url
    url="$(cat "${STATE_DIR}/public-url")"
    check_reachable "frontend" "${url}/" '<div id="root"'
    check_reachable "ganymede" "${url}/-/ganymede/oauth/public-key" 'publicKey'
  fi
}

cmd_down() {
  load_environment down || return 1

  stop_provider
  remove_conf
  nginx_reload
  ganymede_set_tunnel 0
  rm -f "${STATE_DIR}/public-url" "${STATE_DIR}/provider"
  ok "the environment is local again"
}

case "${1:-up}" in
  up)     shift 2>/dev/null; cmd_up "$@" ;;
  url)    cmd_url ;;
  status) cmd_status ;;
  down)   cmd_down ;;
  *)
    echo "usage: $0 [up [cloudflare|tailscale] | url | status | down]"
    echo
    echo "  ENV_NAME=<name>   which environment to expose (default: apollo)"
    exit 1
    ;;
esac
