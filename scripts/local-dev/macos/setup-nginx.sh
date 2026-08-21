#!/bin/bash
# =============================================================================
# setup-nginx.sh — terminate TLS and route the platform's names, on macOS
# =============================================================================
# The same three server blocks create-env.sh writes on Linux — frontend,
# Ganymede, and an include for the gateway configs Ganymede writes at runtime —
# with the differences macOS forces:
#
#   No sudo, and no /etc/nginx. Homebrew's nginx reads
#   /opt/homebrew/etc/nginx/servers/, which belongs to the user. The Linux path
#   writes /etc/nginx/sites-available and needs root for it.
#
#   Port 443 needs root; 8443 does not. Homebrew ships nginx on 8080 for the
#   same reason. Nothing else here is affected: the platform's URLs carry the
#   port, and the gateway blocks Ganymede writes are included as they are.
#
#   ./scripts/local-dev/macos/setup-nginx.sh [domain] [https-port]

set -uo pipefail

DOMAIN="${1:-apollo.test}"
HTTPS_PORT="${2:-8443}"
GANYMEDE_PORT="${GANYMEDE_PORT:-6100}"

CONF_DIR="${HOME}/.holistix-macos"
CERT="${CONF_DIR}/certs/${DOMAIN}.pem"
KEY="${CONF_DIR}/certs/${DOMAIN}-key.pem"
GATEWAYS_D="${CONF_DIR}/nginx-gateways.d"
LOGS="${CONF_DIR}/logs"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SERVERS_DIR="$(nginx -V 2>&1 | tr ' ' '\n' | grep -- '--conf-path=' | cut -d= -f2 | xargs dirname)/servers"
SITE="${SERVERS_DIR}/holistix-${DOMAIN}.conf"

GREEN='\033[0;32m'; YELLOW='\033[0;33m'; GRAY='\033[0;90m'; NC='\033[0m'

command -v nginx >/dev/null || { echo "nginx not found — brew install nginx"; exit 1; }
[ -f "$CERT" ] || { echo "No certificate. Run setup-tls.sh first."; exit 1; }

mkdir -p "$GATEWAYS_D" "$LOGS" "$SERVERS_DIR"

# An empty placeholder so the include below has something to match. nginx
# refuses to start on an include glob that matches nothing, and a fresh machine
# has no gateways yet — which would make the very first start fail for a reason
# that has nothing to do with the configuration being wrong.
[ -f "${GATEWAYS_D}/00-placeholder.conf" ] || \
  printf '# Ganymede writes one file here per gateway. This keeps the glob\n# non-empty until it does.\n' \
    > "${GATEWAYS_D}/00-placeholder.conf"

# The same, for the by-path form of those gateway configs, which the public
# server block below includes. Ganymede writes one per organization next to the
# server block it already wrote; see services/nginx-manager.ts.
mkdir -p "${GATEWAYS_D}/locations"
[ -f "${GATEWAYS_D}/locations/00-placeholder.conf" ] || \
  printf '# Ganymede writes one location here per gateway.\n' \
    > "${GATEWAYS_D}/locations/00-placeholder.conf"

cat > "$SITE" <<EOF
# Holistix, ${DOMAIN} — written by scripts/local-dev/macos/setup-nginx.sh

# Frontend
server {
    listen ${HTTPS_PORT} ssl;
    server_name ${DOMAIN};

    ssl_certificate ${CERT};
    ssl_certificate_key ${KEY};

    root ${REPO_ROOT}/packages/app-frontend/dist;
    index index.html;

    location / {
        try_files \$uri /index.html;
    }

    # index.html is the one file Vite does not fingerprint — it is what points
    # at the hashed bundles. Caching it means that after a rebuild the browser
    # asks for asset names that no longer exist.
    location = /index.html {
        expires -1;
    }

    location ~* \.(js|css|svg|ttf|woff|woff2)\$ {
        expires max;
        add_header Cache-Control public;
        error_page 404 = @stale_bundle;
    }

    # A hashed asset that does not exist means the browser is holding an
    # index.html from an older build. Nothing server-side can invalidate that;
    # this header can, and it costs one reload. "cache" only, so the session
    # survives.
    location @stale_bundle {
        add_header Clear-Site-Data '"cache"' always;
        return 404;
    }

    access_log ${LOGS}/frontend-access.log;
    error_log ${LOGS}/frontend-error.log;
}

# Ganymede
server {
    listen ${HTTPS_PORT} ssl;
    server_name ganymede.${DOMAIN};

    ssl_certificate ${CERT};
    ssl_certificate_key ${KEY};

    location / {
        proxy_pass http://127.0.0.1:${GANYMEDE_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    access_log ${LOGS}/ganymede-access.log;
    error_log ${LOGS}/ganymede-error.log;
}

# One file per gateway, written by Ganymede as organizations are allocated.
include ${GATEWAYS_D}/*.conf;
EOF

printf "${GREEN}Wrote${NC} %s\n" "$SITE"

if nginx -t 2>&1 | grep -q "successful"; then
  printf "${GREEN}✓${NC} nginx accepts the configuration\n"
else
  printf "${YELLOW}nginx rejected it:${NC}\n"
  nginx -t 2>&1 | sed 's/^/  /'
  exit 1
fi

if pgrep -x nginx >/dev/null 2>&1; then
  nginx -s reload && printf "${GREEN}✓${NC} reloaded\n"
else
  nginx && printf "${GREEN}✓${NC} started\n"
fi

echo
printf "  frontend  ${GRAY}https://%s:%s${NC}\n" "$DOMAIN" "$HTTPS_PORT"
printf "  ganymede  ${GRAY}https://ganymede.%s:%s${NC}\n" "$DOMAIN" "$HTTPS_PORT"
printf "  gateways  ${GRAY}%s/*.conf${NC}\n" "$GATEWAYS_D"
echo
