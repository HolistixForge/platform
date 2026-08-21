#!/bin/bash
# =============================================================================
# setup-tls.sh — the wildcard certificate the platform's names are served under
# =============================================================================
# The platform mints names at two depths, and no deeper:
#
#   apollo.test                              the frontend
#   org-<uuid>.apollo.test                   an organization's gateway
#   uc-<id>.org-<uuid>.apollo.test           a container
#   uc-<id>--<service>.org-<uuid>.apollo.test   one of its services
#
# `*.${DOMAIN}` covers the first two. The last two are one label deeper, and a
# wildcard matches exactly one label — `*.*.<domain>` is not a name mkcert will
# issue, it refuses it outright. So they need `*.org-<uuid>.<domain>`, which
# cannot be issued in advance because the organization does not exist yet.
#
# Hence the extra arguments: pass the organizations this machine serves and
# each gets a wildcard of its own. One per organization covers every container
# it will ever hold and every service on them — that is what folding the
# service into the container's label bought, and why it is worth having done.
# See packages/modules/user-containers/src/lib/service-fqdn.ts.
#
#   ./scripts/local-dev/macos/setup-tls.sh [domain] [org-uuid ...]
#
# The organization ids are the ones in the database:
#   psql -d ganymede_<env> -tAc 'select organization_id from organizations'

set -uo pipefail

DOMAIN="${1:-apollo.test}"
shift 2>/dev/null || true
CONF_DIR="${HOME}/.holistix-macos"
CERT_DIR="${CONF_DIR}/certs"

# One wildcard per organization, for the names a label deeper than `*.${DOMAIN}`
# reaches. Accepts either form — `org-<uuid>` as it appears in a hostname, or
# the bare uuid as it comes out of the database — because both are what people
# have in front of them, and getting it wrong produces a certificate that looks
# issued and covers nothing.
ORG_NAMES=()
for org in "$@"; do
  [ -n "$org" ] || continue
  case "$org" in
    org-*) ORG_NAMES+=("*.${org}.${DOMAIN}") ;;
    *)     ORG_NAMES+=("*.org-${org}.${DOMAIN}") ;;
  esac
done

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

# Reissue when an organization was asked for that the current certificate does
# not already carry. Without this check the "still valid for a week" path wins
# and the new organization's services are served under a certificate that never
# names them — which surfaces as a browser warning per service rather than as
# anything pointing back here.
missing_org=0
for name in ${ORG_NAMES+"${ORG_NAMES[@]}"}; do
  openssl x509 -in "$CERT" -noout -ext subjectAltName 2>/dev/null \
    | grep -qF "DNS:${name}" || missing_org=1
done

if [ -f "$CERT" ] && [ "$missing_org" = 0 ] \
  && openssl x509 -in "$CERT" -noout -checkend 604800 >/dev/null 2>&1; then
  printf "${GRAY}Certificate already valid for another week — leaving it alone.${NC}\n"
else
  mkcert -cert-file "$CERT" -key-file "$KEY" \
    "$DOMAIN" "*.${DOMAIN}" ${ORG_NAMES+"${ORG_NAMES[@]}"} localhost 127.0.0.1 ::1 \
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
