#!/bin/bash
# =============================================================================
# verify-container-broker.sh — prove the broker's guarantees on a real runtime
# =============================================================================
# Unit tests can assert what argv the broker builds. Only a real container
# daemon can say what that argv actually grants. This script runs the whole
# path — auth, refusals, pull, start — and then reads the container's real
# privileges back out of Docker.
#
# Run it on a host with Docker (the dev VM, or a platform host):
#
#   ./verify-container-broker.sh
#
# It stands up a stub catalog rather than talking to Ganymede, so it needs no
# GitHub App and no database. What it exercises is the broker itself.
#
# BROKER_RUNTIME defaults to runc here. That is a testing choice, not the
# deployment default: the broker has no built-in default precisely so running
# without microVM isolation must be stated out loud. Apple Silicon before M3
# has no nested virtualisation, so a Lima VM on those machines cannot run kata
# at all — which is why this script exists in the first place.

set -uo pipefail

BROKER_RUNTIME="${BROKER_RUNTIME:-runc}"
# Ports chosen at run time rather than fixed: a broker or a stub left over from
# an earlier run would otherwise be silently reused, and the script would report
# on someone else's process.
free_port() {
  python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1]);s.close()'
}
BROKER_PORT="${BROKER_PORT:-$(free_port)}"
STUB_PORT="$(free_port)"
TOKEN="verify-$$"
B="http://127.0.0.1:${BROKER_PORT}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUNDLE="${REPO_ROOT}/dist/packages/app-container-broker/main.js"
NAME="holistix_verify_$$"

GREEN='\033[0;32m'; RED='\033[0;31m'; GRAY='\033[0;90m'; NC='\033[0m'
pass=0; fail=0
ok()   { printf "  ${GREEN}✓${NC} %s\n" "$1"; pass=$((pass+1)); }
ko()   { printf "  ${RED}✗${NC} %s ${GRAY}(%s)${NC}\n" "$1" "$2"; fail=$((fail+1)); }
skip() { printf "  ${GRAY}‑ %s (skipped: %s)${NC}\n" "$1" "$2"; skipped=$((skipped+1)); }

# Every check declares what it proves, because "26 checks pass" hid how few of
# them were ever about the runtime:
#
#   contract  the broker's HTTP surface — validation, authz, cross-project
#             refusal. True of any runtime; green since the first day.
#   daemon    read back out of `docker inspect`. Proves the broker→Docker
#             wiring applied what was asked, not that the guest is isolated.
#   guest     probed from inside the container. The only group that says
#             anything about isolation.
#
# It matters because the expensive run — a host with KVM, which no Apple
# Silicon before M3 can provide — should spend itself on `guest`, not on
# re-proving twenty checks that have been green for months.
#
# Filter with CHECK_GROUPS=guest, CHECK_GROUPS="contract daemon"; default all.
#
# Not GROUPS: that is a bash built-in array holding the caller's group ids, so
# `GROUPS="${GROUPS:-…}"` silently reads a gid and every check is skipped. The
# script reported "groups: 20" and 26 skips before this was renamed.
CHECK_GROUPS="${CHECK_GROUPS:-contract daemon guest}"
skipped=0

in_group() { [[ " $CHECK_GROUPS " == *" $1 "* ]]; }

# check <group> <name> <actual> <expected>
check() {
  local group="$1" name="$2" actual="$3" expected="$4"
  in_group "$group" || { skip "$name" "group $group"; return 0; }
  [ "$actual" = "$expected" ] && ok "$name" || ko "$name" "expected $expected, got $actual"
}

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1
  [ -n "${BROKER_PID:-}" ] && kill "$BROKER_PID" 2>/dev/null
  [ -n "${STUB_PID:-}" ] && kill "$STUB_PID" 2>/dev/null
  rm -f /tmp/verify-stub-$$.mjs
  return 0
}
trap cleanup EXIT

command -v docker >/dev/null || { echo "docker not found"; exit 1; }
docker info >/dev/null 2>&1 || { echo "cannot reach the Docker daemon"; exit 1; }
[ -f "$BUNDLE" ] || {
  echo "Broker bundle missing. Build it first:"
  echo "  NX_DAEMON=false npx nx build @holistix-forge/app-container-broker"
  exit 1
}

echo "Pulling a test image…"
docker pull -q nginx:alpine >/dev/null 2>&1
REF=$(docker inspect nginx:alpine --format '{{index .RepoDigests 0}}')
DIGEST="${REF#*@sha256:}"

# A stub in place of Ganymede.
#
# KNOWN BROKEN, and it takes the accepted-start path with it: thirteen of the
# checks below cannot pass until this is fixed. The broker now refuses an image
# that carries neither a pull token nor the `builtin` flag — "no token" equally
# describes a tenant image whose credential failed to mint — and this stub was
# written before that rule.
#
# It cannot simply answer `builtin: true` either, and that is not an oversight:
# ganymedeCatalogue deliberately does not carry that field through. A catalogue
# response able to declare itself built-in would skip both the digest-pinning
# requirement and the always-pull authorization re-check. Built-ins are decided
# host-side, in builtin-catalogue.ts.
#
# So the fix is one of:
#   - use a public image under ghcr.io/<org>/ and have the stub return
#     pull_token and github_organization, exercising the tenant path — which is
#     the one that matters, and the one no test covers today
#   - or run against a real Ganymede
#
# Not guessed at here: whichever is chosen has to be run to be believed, and
# the run needs a host this script was written for.
cat > "/tmp/verify-stub-$$.mjs" <<EOF
import { createServer } from 'node:http';
createServer((req, res) => {
  const m = req.url.match(/^\/internal\/projects\/([^/]+)\/images\/(.+)\$/);
  if (!m || decodeURIComponent(m[2]) !== 'verify:image') {
    res.writeHead(404).end('{}'); return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    imageId: 'verify:image',
    reference: 'docker.io/library/nginx:alpine@sha256:${DIGEST}',
  }));
}).listen(${STUB_PORT}, '127.0.0.1');
EOF
node "/tmp/verify-stub-$$.mjs" & STUB_PID=$!
sleep 1

BROKER_RUNTIME="$BROKER_RUNTIME" BROKER_TOKEN="$TOKEN" BROKER_PORT="$BROKER_PORT" \
BROKER_BIND=127.0.0.1 GANYMEDE_INTERNAL_URL="http://127.0.0.1:${STUB_PORT}" \
GANYMEDE_INTERNAL_TOKEN=unused \
  node "$BUNDLE" > "/tmp/verify-broker-$$.log" 2>&1 & BROKER_PID=$!
sleep 2

SETTINGS=$(printf '%s' '{"user_id":"u1","project_id":"project-1"}' | base64 -w0)
req() {
  python3 - "$1" "$NAME" "$SETTINGS" <<'PY'
import json, sys
r = {"organization_id": "org-verify", "project_id": "project-1",
     "user_container_id": "uc_verify01", "name": sys.argv[2],
     "image_id": "verify:image", "settings": sys.argv[3],
     "capabilities": ["NET_ADMIN"], "devices": [], "extra_hosts": [],
     "limits": {"cpus": 1, "memoryMb": 256, "pidsLimit": 128}}
r.update(json.loads(sys.argv[1]))
print(json.dumps(r))
PY
}
post() {
  curl -s -o /dev/null -w '%{http_code}' -X POST "$B/containers" \
    -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -d "$(req "$1")"
}

echo
echo "Broker answers"
check contract "health reports the configured runtime" \
  "$(curl -s "$B/health" | python3 -c 'import json,sys; print(json.load(sys.stdin)["runtime"])')" \
  "$BROKER_RUNTIME"
check contract "an unauthenticated start is refused" \
  "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/containers" -d '{}')" "401"
check contract "a wrong token is refused" \
  "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/containers" -H 'Authorization: Bearer wrong' -d '{}')" "401"

echo
echo "Requests the broker must refuse"
check contract "a capability outside the allowlist" "$(post '{"capabilities":["SYS_ADMIN"]}')" "400"
check contract "host device passthrough"            "$(post '{"devices":["/dev/net/tun"]}')" "400"
check contract "a name that would parse as a flag"  "$(post '{"name":"--privileged"}')" "400"
check contract "settings that are not base64"       "$(post '{"settings":"not base64!"}')" "400"
check contract "a start carrying no limits"         "$(post '{"limits":{}}')" "400"
check contract "an image absent from the catalog"   "$(post '{"image_id":"nope:missing"}')" "404"

echo
echo "An accepted start"
check contract "the broker accepts a valid request" "$(post '{}')" "201"
sleep 2
check daemon "the container is running"  "$(docker inspect "$NAME" --format '{{.State.Status}}')" "running"
check daemon "it is not privileged"      "$(docker inspect "$NAME" --format '{{.HostConfig.Privileged}}')" "false"
check daemon "all capabilities dropped first" "$(docker inspect "$NAME" --format '{{.HostConfig.CapDrop}}')" "[ALL]"
check daemon "no host device passed through"  "$(docker inspect "$NAME" --format '{{.HostConfig.Devices}}')" "[]"
check daemon "cpu limit applied"    "$(docker inspect "$NAME" --format '{{.HostConfig.NanoCpus}}')" "1000000000"
check daemon "memory limit applied" "$(docker inspect "$NAME" --format '{{.HostConfig.Memory}}')" "268435456"
check daemon "swap capped at the memory limit" \
  "$(docker inspect "$NAME" --format '{{.HostConfig.MemorySwap}}')" "268435456"
check daemon "pids limit applied"   "$(docker inspect "$NAME" --format '{{.HostConfig.PidsLimit}}')" "128"
check daemon "runtime is the configured one" \
  "$(docker inspect "$NAME" --format '{{.HostConfig.Runtime}}')" "$BROKER_RUNTIME"
check daemon "labelled for reaping" \
  "$(docker inspect "$NAME" --format '{{index .Config.Labels "holistix.user_container"}}')" "uc_verify01"
check daemon "started from the digest we asked for" \
  "$(docker inspect "$NAME" --format '{{.Config.Image}}')" \
  "docker.io/library/nginx:alpine@sha256:${DIGEST}"

echo
echo "What the container can actually do"
docker exec "$NAME" sh -c 'ip link add dummy0 type dummy' >/dev/null 2>&1 \
  && ok "NET_ADMIN works — the VPN client can bring its link up" \
  || ko "NET_ADMIN works" "denied; the container could not reach its gateway"
docker exec "$NAME" sh -c 'mkdir -p /mnt/x && mount -t tmpfs none /mnt/x' >/dev/null 2>&1 \
  && ko "SYS_ADMIN is denied" "it was granted" \
  || ok "SYS_ADMIN is denied"
docker exec "$NAME" sh -c 'ls /dev/net/tun' >/dev/null 2>&1 \
  && ko "no host device leaked in" "/dev/net/tun is present" \
  || ok "no host device leaked in"
got=$(docker exec "$NAME" sh -c 'echo -n $SETTINGS' 2>/dev/null)
check guest "the SETTINGS payload arrived intact" "$got" "$SETTINGS"
check guest "the memory limit is real inside the container" \
  "$(docker exec "$NAME" sh -c 'cat /sys/fs/cgroup/memory.max' 2>/dev/null)" "268435456"

echo
echo "Network isolation, and wiring services after the fact"
# A second service in the same project, started independently.
NAME2="${NAME}_peer"
docker rm -f "$NAME2" >/dev/null 2>&1
post2=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/containers" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "$(req "{\"name\":\"$NAME2\",\"user_container_id\":\"uc_verify02\"}")")
check contract "a second service starts" "$post2" "201"
sleep 2

IP1=$(docker inspect "$NAME" --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')
docker exec "$NAME2" sh -c "wget -q -T 3 -O /dev/null http://$IP1/" >/dev/null 2>&1 \
  && ko "two services are isolated by default" "the second reached the first" \
  || ok "two services are isolated by default"

NET=$(curl -s -X POST "$B/networks" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"project_id":"project-1","name":"link"}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin).get("network",""))')
check contract "a network can be created on its own" "$NET" "holistix_net_project-1_link"

for c in "$NAME" "$NAME2"; do
  curl -s -o /dev/null -X POST "$B/networks/$NET/members" \
    -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -d "{\"container_id\":\"$c\"}"
done
sleep 1
IP1_ON_NET=$(docker inspect "$NAME" --format "{{(index .NetworkSettings.Networks \"$NET\").IPAddress}}" 2>/dev/null)
docker exec "$NAME2" sh -c "wget -q -T 3 -O /dev/null http://$IP1_ON_NET/" >/dev/null 2>&1 \
  && ok "attaching both to a network links them, with no restart" \
  || ko "attaching both to a network links them" "still unreachable"

# A container from another project must not be attachable to this network.
docker rm -f netcross >/dev/null 2>&1
docker run -d --name netcross --label holistix.project=other-project nginx:alpine >/dev/null 2>&1
cross=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/networks/$NET/members" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"container_id":"netcross"}')
check contract "a container from another project is refused" "$cross" "403"
docker rm -f netcross "$NAME2" >/dev/null 2>&1
docker network rm "$NET" >/dev/null 2>&1

echo
echo "============================================="
printf "passed: ${GREEN}%d${NC}   failed: ${RED}%d${NC}   skipped: ${GRAY}%d${NC}\n" \
  "$pass" "$fail" "$skipped"
printf "${GRAY}groups: %s${NC}\n" "$CHECK_GROUPS"
if [ "$BROKER_RUNTIME" = "runc" ]; then
  printf "${GRAY}Ran under runc. The contract and daemon groups hold on any runtime;\n"
  printf "what is unproven is isolation from the host kernel, and only the guest\n"
  printf "group speaks to it. --runtime=kata needs /dev/kvm, which no Apple\n"
  printf "Silicon before M3 exposes to a guest — a Mac runs VMs perfectly well,\n"
  printf "it cannot run one inside another, and Docker already spent that level.${NC}\n"
fi
echo "============================================="
[ "$fail" -eq 0 ]
