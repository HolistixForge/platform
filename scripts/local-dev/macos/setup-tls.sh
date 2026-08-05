#!/bin/bash
# =============================================================================
# setup-tls.sh — the wildcard certificate the platform's names are served under
# =============================================================================
# The platform mints names at two depths:
#
#   apollo.test                       the frontend
#   org-<uuid>.apollo.test            an organization's gateway
#   uc-<uuid>.org-<uuid>.apollo.test  one service
#
# The certificate covers the first two. It does not cover the third, and
# cannot: a wildcard matches one label, `*.*.<domain>` is not a name mkcert
# will issue — it refuses it outright — and the organization ids that would
# make `*.org-<uuid>.<domain>` concrete do not exist until someone creates one.
#
# This is not a gap the macOS path introduces. create-env.sh on Linux issues
# exactly `${DOMAIN}` and `*.${DOMAIN}` too, and the second level is reached
# the same way it is there: the container bootstrap uses `curl -k`, and a
# browser gets one warning per service. Fixing it properly means issuing a
# certificate per organization when one is created, which belongs with that
# code rather than here.
#
#   ./scripts/local-dev/macos/setup-tls.sh [domain]

set -uo pipefail

DOMAIN="${1:-apollo.test}"
CONF_DIR="${HOME}/.holistix-macos"
CERT_DIR="${CONF_DIR}/certs"

GREEN='\033[0;32m'; YELLOW='\033[0;33m'; GRAY='\033[0;90m'; NC='\033[0m'

command -v mkcert >/dev/null || { echo "mkcert not found — brew install mkcert"; exit 1; }

mkdir -p "$CERT_DIR"

CAROOT="$(mkcert -CAROOT)"
if [ ! -f "${CAROOT}/rootCA.pem" ]; then
  printf "${YELLOW}mkcert's local CA is not installed yet.${NC}\n\n"
  printf "  mkcert -install\n\n"
  printf "${GRAY}It adds a certificate authority to your login keychain, and asks for${NC}\n"
  printf "${GRAY}your password to do it. That is a trust decision about your own${NC}\n"
  printf "${GRAY}machine, so it is left to you rather than taken.${NC}\n\n"
  exit 1
fi

CERT="${CERT_DIR}/${DOMAIN}.pem"
KEY="${CERT_DIR}/${DOMAIN}-key.pem"

if [ -f "$CERT" ] && openssl x509 -in "$CERT" -noout -checkend 604800 >/dev/null 2>&1; then
  printf "${GRAY}Certificate already valid for another week — leaving it alone.${NC}\n"
else
  mkcert -cert-file "$CERT" -key-file "$KEY" \
    "$DOMAIN" "*.${DOMAIN}" localhost 127.0.0.1 ::1 \
    || { echo "mkcert failed — see above"; exit 1; }
  printf "${GREEN}Certificate issued${NC} %s\n" "$CERT"
fi

echo
echo "Names it covers"
openssl x509 -in "$CERT" -noout -ext subjectAltName 2>/dev/null \
  | tail -n +2 | tr ',' '\n' | sed 's/^ */  /'

echo
printf "${GREEN}✓${NC} key %s ${GRAY}(%s)${NC}\n" "$KEY" "$(stat -f '%Sp' "$KEY" 2>/dev/null)"
echo
