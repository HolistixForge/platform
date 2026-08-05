#!/bin/bash
# =============================================================================
# preflight.sh — what this Mac has, and what the macOS platform still needs
# =============================================================================
# The Linux path installs its dependencies with apt and runs the platform in a
# VM. The macOS path runs it on the machine itself, under Apple `container`,
# and gets its dependencies from Homebrew. Nothing here replaces the Linux
# path: that is what runs on the server, and it is untouched.
#
# Read-only. It installs nothing and changes nothing — it says what is missing
# and what each thing is for, because a setup script that fails half way
# through leaves a machine in a state nobody asked for.
#
#   ./scripts/local-dev/macos/preflight.sh

set -uo pipefail

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; GRAY='\033[0;90m'; NC='\033[0m'
missing=0

have() { command -v "$1" >/dev/null 2>&1; }

# need <binary> <what it is for> <how to get it>
need() {
  if have "$1"; then
    printf "  ${GREEN}✓${NC} %-12s ${GRAY}%s${NC}\n" "$1" "$(command -v "$1")"
  else
    printf "  ${RED}✗${NC} %-12s %s\n" "$1" "$2"
    printf "    ${GRAY}%s${NC}\n" "$3"
    missing=$((missing+1))
  fi
}

echo
echo "Platform, on this Mac"
echo "====================="
echo

echo "Container engine"
need container \
  "starts every service in its own VM, on Kata's guest kernel" \
  "https://github.com/apple/container/releases — the signed .pkg"

if have container; then
  status=$(timeout 20 container system status 2>&1 | awk '/^status/{print $2}')
  if [ "${status:-}" = "running" ]; then
    printf "  ${GREEN}✓${NC} %-12s ${GRAY}apiserver running${NC}\n" "daemon"
  else
    printf "  ${YELLOW}!${NC} %-12s daemon is not running\n" "daemon"
    printf "    ${GRAY}container system start — the first run is interactive: it offers${NC}\n"
    printf "    ${GRAY}to install the guest kernel, and waits for an answer.${NC}\n"
    missing=$((missing+1))
  fi
fi

echo
echo "Services the platform needs beside it"
need nginx   "terminates TLS and routes the .local names to each service" \
             "brew install nginx"
need coredns "resolves the .local names — containers ask the host for them" \
             "brew install coredns"
need mkcert  "issues the wildcard certificate for *.local" \
             "brew install mkcert"
need psql    "Ganymede's database" \
             "brew install postgresql@16 && brew services start postgresql@16"

echo
echo "Toolchain"
need node "" "brew install node"
need jq   "" "brew install jq"

echo
echo "What is not automated, and why"
echo "=============================="
cat <<'NOTES'
  DNS      macOS resolves through its own configuration, not /etc/resolv.conf.
           Pointing .local at a local CoreDNS is done with a resolver file
           under /etc/resolver/, which needs sudo — and getting it wrong takes
           name resolution down for the whole machine, so it is a step someone
           should take deliberately rather than have a script take for them.

  launchd  Apple `container` has no --restart, which the engine names as the
           `restart-policy` concession. The gateway pool therefore needs a
           supervisor to bring it back after a reboot. A launchd agent is the
           macOS answer; the runner's own loop already reconverges without one.

  Ansible  infra/ansible targets apt and systemd. The macOS path does not use
           it and does not change it.
NOTES

echo
if [ "$missing" -eq 0 ]; then
  printf "${GREEN}Everything this checks for is present.${NC}\n"
else
  printf "${YELLOW}%d thing(s) to install before the platform can come up here.${NC}\n" "$missing"
fi
echo

[ "$missing" -eq 0 ]
