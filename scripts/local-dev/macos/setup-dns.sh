#!/bin/bash
# =============================================================================
# setup-dns.sh — resolve the platform's names on macOS
# =============================================================================
# The Linux path points /etc/resolv.conf at a CoreDNS on port 53. macOS does
# neither of those things, and the difference is not cosmetic:
#
#   `.local` is not available. macOS routes it to mDNS — `scutil --dns` reports
#   `domain: local / options: mdns` — and a resolver file does not reliably
#   take it back. So the macOS platform uses `.test`, which RFC 6761 reserves
#   for exactly this and which nothing on the machine claims.
#
#   Port 53 is not needed. A file under /etc/resolver/ can name a port, so
#   CoreDNS runs unprivileged on a high one and only the resolver file needs
#   sudo — once, and it is three lines someone can read.
#
# Everything a wildcard: the platform mints org-<uuid>.<domain> and
# uc-<uuid>.<org>.<domain> at runtime, so there is no list of names to enumerate
# and a zone file would be stale the moment a project is created.
#
#   ./scripts/local-dev/macos/setup-dns.sh [domain] [port]

set -uo pipefail

DOMAIN="${1:-apollo.test}"
PORT="${2:-15353}"
TLD="${DOMAIN##*.}"
CONF_DIR="${HOME}/.holistix-macos"
COREFILE="${CONF_DIR}/Corefile"
RESOLVER="/etc/resolver/${TLD}"

GREEN='\033[0;32m'; YELLOW='\033[0;33m'; GRAY='\033[0;90m'; NC='\033[0m'

if [ "$TLD" = "local" ]; then
  echo "Refusing '.local': macOS gives it to mDNS, so these names would"
  echo "resolve intermittently or not at all. Use .test — RFC 6761 reserves it."
  exit 1
fi

command -v coredns >/dev/null || { echo "coredns not found — brew install coredns"; exit 1; }

mkdir -p "$CONF_DIR"

cat > "$COREFILE" <<EOF
# Everything under ${DOMAIN} answers 127.0.0.1, where nginx is listening.
#
# A template rather than a zone file: the platform creates org-<uuid> and
# uc-<uuid> names as people create projects and services, so any enumeration
# is out of date before it is written.
${TLD}:${PORT} {
    template IN A {
        answer "{{ .Name }} 60 IN A 127.0.0.1"
    }
    template IN AAAA {
        rcode NOERROR
    }
}

# Anything else is forwarded, so pointing the resolver here cannot take the
# rest of the machine's name resolution with it.
.:${PORT} {
    forward . 1.1.1.1 8.8.8.8
    cache 30
}
EOF

echo
printf "${GREEN}Corefile written${NC} %s\n" "$COREFILE"
echo

# Started in the foreground of its own background process rather than through
# `brew services`: that would want sudo to bind 53, which is the thing this
# arrangement exists to avoid.
if pgrep -f "coredns -conf ${COREFILE}" >/dev/null 2>&1; then
  printf "${GRAY}CoreDNS already running for this Corefile${NC}\n"
else
  nohup coredns -conf "$COREFILE" >"${CONF_DIR}/coredns.log" 2>&1 &
  sleep 2
  printf "${GREEN}CoreDNS started${NC} on 127.0.0.1:%s ${GRAY}(log: %s)${NC}\n" \
    "$PORT" "${CONF_DIR}/coredns.log"
fi

echo
echo "Checking it answers…"
for name in "org-probe.${DOMAIN}" "uc-probe.org-probe.${DOMAIN}"; do
  got=$(dig +short +time=2 +tries=1 @127.0.0.1 -p "$PORT" "$name" A 2>/dev/null | head -1)
  if [ "$got" = "127.0.0.1" ]; then
    printf "  ${GREEN}✓${NC} %-40s → %s\n" "$name" "$got"
  else
    printf "  ${YELLOW}!${NC} %-40s → %s\n" "$name" "${got:-no answer}"
  fi
done
got=$(dig +short +time=2 +tries=1 @127.0.0.1 -p "$PORT" example.com A 2>/dev/null | head -1)
printf "  ${GREEN}✓${NC} %-40s → %s ${GRAY}(the rest of the world still resolves)${NC}\n" \
  "example.com" "${got:-no answer}"

echo
if [ -f "$RESOLVER" ] && grep -q "port ${PORT}" "$RESOLVER" 2>/dev/null \
   && grep -q "nameserver 127.0.0.1" "$RESOLVER" 2>/dev/null; then
  printf "${GREEN}%s already points here.${NC}\n" "$RESOLVER"
else
  printf "${YELLOW}One step left, and it needs sudo — run it yourself:${NC}\n\n"
  cat <<EOF
  sudo mkdir -p /etc/resolver
  sudo tee ${RESOLVER} >/dev/null <<'RESOLVER'
nameserver 127.0.0.1
port ${PORT}
RESOLVER

EOF
  if [ -f "$RESOLVER" ]; then
    printf "${GRAY}  %s exists and points elsewhere:${NC}\n" "$RESOLVER"
    sed 's/^/    /' "$RESOLVER"
    printf "${GRAY}  Overwriting it is what the command above does.${NC}\n"
  fi
  echo
  printf "${GRAY}It is left to you on purpose: a wrong resolver file takes name${NC}\n"
  printf "${GRAY}resolution down for the whole machine, and this one is three lines${NC}\n"
  printf "${GRAY}you can read before running.${NC}\n"
fi
echo
