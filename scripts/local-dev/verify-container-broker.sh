#!/bin/bash
# =============================================================================
# verify-container-broker.sh — prove the broker's guarantees on a real runtime
# =============================================================================
# Unit tests can assert what argv the broker builds. Only a real container
# daemon can say what that argv actually grants. This script runs the whole
# path — auth, refusals, pull, start — and then reads the container's real
# privileges back out of the engine.
#
#   ./verify-container-broker.sh                 # Docker, the Linux path
#   BROKER_ENGINE=apple ./verify-container-broker.sh   # Apple container, macOS
#
# It stands up a stub catalog rather than talking to Ganymede, so it needs no
# GitHub App and no database. What it exercises is the broker itself.
#
# BROKER_RUNTIME defaults to runc under Docker. That is a testing choice, not
# the deployment default: the broker has no built-in default precisely so
# running without microVM isolation must be stated out loud.
#
# Under `apple` there is no such choice to make. Every container is a VM with
# its own kernel at level 1 — no nested virtualisation, so it runs on Apple
# Silicon that cannot host Kata at all. That is what this engine is for, and it
# is why the `guest` group below can finally say something.

set -uo pipefail

ENGINE="${BROKER_ENGINE:-docker}"
case "$ENGINE" in
  docker)
    CLI=docker
    BROKER_RUNTIME="${BROKER_RUNTIME:-runc}"
    # The Linux path gives up none of the controls the design rests on.
    CONCESSIONS=""
    ;;
  apple)
    CLI=container
    BROKER_RUNTIME="${BROKER_RUNTIME:-container-runtime-linux}"
    # Every one of these has to be named or the broker refuses to start. That
    # refusal is a feature and this line is what it costs.
    CONCESSIONS="no-new-privileges,pids-cgroup,restart-policy,run-may-pull,no-hot-network-attach"
    ;;
  *)
    echo "BROKER_ENGINE must be docker or apple; got $ENGINE"; exit 1 ;;
esac

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
#             refusal. True of any engine; green since the first day.
#   daemon    read back out of the engine's own inspect. Proves the
#             broker→engine wiring applied what was asked, not that the guest
#             is isolated.
#   guest     probed from inside the container. The only group that says
#             anything about isolation.
#
# It matters because the expensive run — a host with KVM, which no Apple
# Silicon before M3 can provide — should spend itself on `guest`, not on
# re-proving twenty checks that have been green for months. Under `apple` that
# expense disappears: the guest is a VM on any Mac.
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

# --- engine shims ------------------------------------------------------------
# The only places this script knows which engine it is driving. Everything
# below reads a *logical* field and lets these decide where it lives.

eng_rm()     { case "$ENGINE" in docker) docker rm -f "$@";; apple) container delete --force "$@";; esac; }
eng_exec()   { local c="$1"; shift; case "$ENGINE" in docker) docker exec "$c" "$@";; apple) container exec "$c" "$@";; esac; }
eng_net_rm() { case "$ENGINE" in docker) docker network rm "$@";; apple) container network delete "$@";; esac; }
eng_net_ls() { case "$ENGINE" in docker) docker network ls --format '{{.Name}}';; apple) container network list --quiet;; esac; }
# Containers this script has ever created, from any run — see cleanup().
eng_ls_verify() {
  case "$ENGINE" in
    docker) docker ps -a --filter 'name=holistix_verify_' --format '{{.Names}}' ;;
    apple)  container list --all --quiet 2>/dev/null | grep '^holistix_verify_' ;;
  esac
}

# eng_field <container> <logical field>
#
# `n/a` for a field the engine has no notion of — never an empty string, so a
# missing value can never read as a passing comparison.
eng_field() {
  local c="$1" f="$2"
  if [ "$ENGINE" = "docker" ]; then
    case "$f" in
      state)        docker inspect "$c" --format '{{.State.Status}}' 2>/dev/null ;;
      privileged)   docker inspect "$c" --format '{{.HostConfig.Privileged}}' 2>/dev/null ;;
      cap_drop)     docker inspect "$c" --format '{{.HostConfig.CapDrop}}' 2>/dev/null ;;
      devices)      docker inspect "$c" --format '{{.HostConfig.Devices}}' 2>/dev/null ;;
      cpus)         docker inspect "$c" --format '{{.HostConfig.NanoCpus}}' 2>/dev/null ;;
      memory)       docker inspect "$c" --format '{{.HostConfig.Memory}}' 2>/dev/null ;;
      memory_swap)  docker inspect "$c" --format '{{.HostConfig.MemorySwap}}' 2>/dev/null ;;
      pids)         docker inspect "$c" --format '{{.HostConfig.PidsLimit}}' 2>/dev/null ;;
      runtime)      docker inspect "$c" --format '{{.HostConfig.Runtime}}' 2>/dev/null ;;
      label_uc)     docker inspect "$c" --format '{{index .Config.Labels "holistix.user_container"}}' 2>/dev/null ;;
      image)        docker inspect "$c" --format '{{.Config.Image}}' 2>/dev/null ;;
      ip)           docker inspect "$c" --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null ;;
      *)            echo "n/a" ;;
    esac
    return
  fi

  # Apple `container inspect` has no --format at all: it answers JSON, always,
  # wrapped in an array even for one id.
  #
  # The document goes through the environment rather than a pipe: the program
  # itself already occupies stdin (`python3 -` plus a heredoc), so a pipe into
  # it is silently discarded and every field comes back empty.
  INSPECT_JSON="$(container inspect "$c" 2>/dev/null)" python3 - "$f" <<'PY'
import json, os, sys
field = sys.argv[1]
try:
    doc = json.loads(os.environ.get("INSPECT_JSON") or "")
except Exception:
    print(""); raise SystemExit
doc = doc[0] if isinstance(doc, list) else doc
cfg = doc.get("configuration", {})
st  = doc.get("status", {})

def rlimit(name):
    for r in cfg.get("initProcess", {}).get("rlimits", []):
        if r.get("limit") == name:
            return r.get("soft")
    return None

out = {
    "state":       st.get("state"),
    # No host to be privileged on, and no --device to pass: a VM per container
    # means both have no expression here rather than being set to false.
    "privileged":  "n/a",
    "devices":     "n/a",
    # No swap in the guest at all, so the memory limit is hard by construction
    # rather than by equalising two numbers. Checked from inside instead.
    "memory_swap": "n/a",
    "cap_drop":    ",".join(cfg.get("capDrop", []) or []),
    "cap_add":     ",".join(cfg.get("capAdd", []) or []),
    "cpus":        cfg.get("resources", {}).get("cpus"),
    "memory":      cfg.get("resources", {}).get("memoryInBytes"),
    "pids":        rlimit("RLIMIT_NPROC"),
    "runtime":     cfg.get("runtimeHandler"),
    "label_uc":    cfg.get("labels", {}).get("holistix.user_container"),
    # `reference` is normalised on the way in — repo:tag@sha256:… comes back as
    # repo@sha256:… — so anything comparing what started against what was asked
    # for has to use the digest.
    "image":       cfg.get("image", {}).get("reference"),
    "digest":      cfg.get("image", {}).get("descriptor", {}).get("digest"),
    "ip":          (st.get("networks") or [{}])[0].get("ipv4Address", "").split("/")[0],
}.get(field, "n/a")
print("" if out is None else out)
PY
}

cleanup() {
  eng_rm "$NAME" "${NAME}_peer" "${NAME}_hosts" >/dev/null 2>&1
  # Anything left by an earlier run too, not only this one's. The names are
  # PID-suffixed, so a run that died — `BROKER_RUNTIME=kata` on a host with no
  # kata registered is the easy way to see it — leaves its containers behind
  # and they go on holding the networks below, which are *not* PID-suffixed.
  # The prefix is this script's own, so nothing else can match it.
  for stale in $(eng_ls_verify); do
    eng_rm "$stale" >/dev/null 2>&1
  done
  # The per-container private networks the broker creates on the way in. They
  # outlive the containers, so without this a host accumulates a pair per run.
  #
  # One name per call, and retried. Two reasons, both measured:
  #
  #   Apple's `container network delete` is all-or-nothing — pass it four names
  #   of which one does not exist and it removes none of them, answering only
  #   `failed to delete one or more networks: ["nosuchnet"]`. Some of these are
  #   already gone by here, so a single call would always be that case.
  #
  #   `container delete` returns before the VM has released its interfaces, so
  #   the first attempt on a just-freed network still reports it in use.
  for _ in 1 2 3 4 5; do
    for net in holistix_uc_uc_verify01 holistix_uc_uc_verify02 \
               holistix_uc_uc_verify03 "holistix_net_${PROJECT_ID}_link"; do
      eng_net_rm "$net" >/dev/null 2>&1
    done
    eng_net_ls | grep -q '^holistix_' || break
    sleep 1
  done
  # `wait` after the kill, so bash reaps the job itself instead of printing
  # "Terminated: 15" over the summary and making a clean run look broken.
  for pid in "${BROKER_PID:-}" "${STUB_PID:-}"; do
    [ -n "$pid" ] || continue
    kill "$pid" 2>/dev/null
    wait "$pid" 2>/dev/null
  done
  rm -f "/tmp/verify-stub-$$.mjs"
  # Drop the tag this script invented. Leaving a `holistixforge/…` name
  # pointing at nginx behind on a developer's machine would quietly shadow the
  # real built-in on the next run that expects it.
  case "$ENGINE" in
    docker) docker rmi "$BUILTIN_REF" >/dev/null 2>&1 ;;
    apple)  container image delete "$BUILTIN_REF" >/dev/null 2>&1 ;;
  esac
  return 0
}
trap cleanup EXIT

command -v "$CLI" >/dev/null || { echo "$CLI not found"; exit 1; }
[ -f "$BUNDLE" ] || {
  echo "Broker bundle missing. Build it first:"
  echo "  NX_DAEMON=false npx nx build @holistix-forge/app-container-broker"
  exit 1
}

# The image under test.
#
# A *built-in* id, resolved from the broker's own host-side list, deliberately.
# The obvious alternative — a stub Ganymede answering a tenant entry — cannot
# work offline: the broker refuses an image that carries neither a pull token
# nor the built-in flag ("no token" equally describes a credential that failed
# to mint), and `ganymedeCatalogue` will not carry `builtin` through, because a
# catalogue response able to declare itself built-in would skip both the
# digest-pinning requirement and the always-pull authorization re-check.
#
# So a public image is tagged under the built-in reference and started through
# the built-in id. What this does *not* cover, and no offline run can, is the
# tenant path: a real digest-pinned ghcr.io pull with a minted token. That
# needs a real Ganymede and is stated here rather than implied by a green line.
BUILTIN_ID='ubuntu:terminal'
BUILTIN_REF='holistixforge/ubuntu-terminal:24.04'
SOURCE_IMAGE="${VERIFY_SOURCE_IMAGE:-docker.io/library/nginx:alpine}"

echo "Preparing ${BUILTIN_REF} from ${SOURCE_IMAGE}…"
case "$ENGINE" in
  docker)
    docker pull -q "$SOURCE_IMAGE" >/dev/null 2>&1
    docker tag "$SOURCE_IMAGE" "$BUILTIN_REF" >/dev/null 2>&1 ;;
  apple)
    container image inspect "$SOURCE_IMAGE" >/dev/null 2>&1 || \
      container image pull "$SOURCE_IMAGE" >/dev/null 2>&1
    container image tag "$SOURCE_IMAGE" "$BUILTIN_REF" >/dev/null 2>&1 ;;
esac

# Where the broker resolves a tenant image.
#
# By default a stub that answers 404 to everything, so only the built-in list
# resolves — enough to prove the refusal of an unknown id and nothing more.
#
# Point it at a real one instead, which is what finally exercises the wire
# between the two services:
#
#   ./ganymede-apple.sh up
#   VERIFY_GANYMEDE_URL=http://<ip>:6870 \
#   VERIFY_GANYMEDE_TOKEN=<a gateway JWT, signed with ~/.holistix-apple/jwt.key> \
#     BROKER_ENGINE=apple ./verify-container-broker.sh
#
# That is not a nicety. Everything about this hop — the header, the status
# mapping, the project id being a UUID — had never been exercised, and the
# first attempt found the broker authenticating with a header Ganymede does
# not read.
# Ganymede's project_id columns are `uuid`, so a real one refuses "project-1"
# in SQL before the catalogue is consulted — the broker then reports 502 and
# blames Ganymede for a request this side malformed. Against the stub the
# readable id is friendlier, so the default follows the catalogue.
if [ -n "${VERIFY_GANYMEDE_URL:-}" ]; then
  PROJECT_ID="${VERIFY_PROJECT_ID:-$(python3 -c 'import uuid;print(uuid.uuid4())')}"
else
  PROJECT_ID="${VERIFY_PROJECT_ID:-project-1}"
fi

CATALOGUE="${VERIFY_GANYMEDE_URL:-}"
CATALOGUE_TOKEN="${VERIFY_GANYMEDE_TOKEN:-unused}"
if [ -n "$CATALOGUE" ]; then
  echo "Catalogue: real Ganymede at ${CATALOGUE}"
else
  cat > "/tmp/verify-stub-$$.mjs" <<EOF
import { createServer } from 'node:http';
createServer((req, res) => {
  res.writeHead(404).end('{}');
}).listen(${STUB_PORT}, '127.0.0.1');
EOF
  node "/tmp/verify-stub-$$.mjs" & STUB_PID=$!
  sleep 1
  CATALOGUE="http://127.0.0.1:${STUB_PORT}"
fi

BROKER_ENGINE="$ENGINE" BROKER_RUNTIME="$BROKER_RUNTIME" \
BROKER_ACCEPT_CONCESSIONS="$CONCESSIONS" \
BROKER_TOKEN="$TOKEN" BROKER_PORT="$BROKER_PORT" \
BROKER_BIND=127.0.0.1 GANYMEDE_INTERNAL_URL="$CATALOGUE" \
GANYMEDE_INTERNAL_TOKEN="$CATALOGUE_TOKEN" \
  node "$BUNDLE" > "/tmp/verify-broker-$$.log" 2>&1 & BROKER_PID=$!
sleep 2

SETTINGS=$(printf '{"user_id":"u1","project_id":"%s"}' "$PROJECT_ID" | base64 | tr -d '\n')

# req <overrides-json> [name] [user_container_id]
#
# Name and id are separate parameters rather than fields of the overrides
# object on purpose. Building `{"name":"$NAME2"}` inline meant escaped quotes
# inside a command substitution inside a quoted argument, which bash 3.2 — the
# one macOS ships — word-splits: the function ran twice, each half a fragment,
# and curl was handed an empty body.
req() {
  python3 - "$1" "${2:-$NAME}" "$SETTINGS" "$BUILTIN_ID" "${3:-uc_verify01}" "$PROJECT_ID" <<'PY'
import json, sys
r = {"organization_id": "org-verify", "project_id": sys.argv[6],
     "user_container_id": sys.argv[5], "name": sys.argv[2],
     "image_id": sys.argv[4], "settings": sys.argv[3],
     "capabilities": ["NET_ADMIN"], "devices": [], "extra_hosts": [],
     "limits": {"cpus": 1, "memoryMb": 256, "pidsLimit": 128}}
r.update(json.loads(sys.argv[1]))
print(json.dumps(r))
PY
}
post() {
  curl -s -o /dev/null -w '%{http_code}' -X POST "$B/containers" \
    -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -d "$(req "$1" "${2:-$NAME}" "${3:-uc_verify01}")"
}

# The start response body, for the fields the gateway forwards to the card.
post_body() {
  curl -s -X POST "$B/containers" \
    -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -d "$(req "$1" "$2" "$3")"
}

echo
echo "Broker answers"
check contract "health reports the configured runtime" \
  "$(curl -s "$B/health" | python3 -c 'import json,sys; print(json.load(sys.stdin)["runtime"])')" \
  "$BROKER_RUNTIME"
check contract "health reports the configured engine" \
  "$(curl -s "$B/health" | python3 -c 'import json,sys; print(json.load(sys.stdin)["engine"])')" \
  "$ENGINE"
check contract "health reports what this deployment gave up" \
  "$(curl -s "$B/health" | python3 -c 'import json,sys; print(",".join(json.load(sys.stdin)["concessions"]))')" \
  "$CONCESSIONS"
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
if [ "$ENGINE" = "apple" ]; then
  # Not a concession: nothing is lost quietly. `--add-host` has no equivalent
  # here, and a container that silently cannot resolve its gateway fails
  # minutes later looking like a network fault.
  check contract "extra hosts, which this engine cannot set" \
    "$(post '{"extra_hosts":[{"host":"gw.local","ip":"10.0.0.1"}]}')" "400"
else
  check contract "extra hosts are accepted on this engine" \
    "$(post '{"extra_hosts":[{"host":"gw.local","ip":"10.0.0.1"}]}' "${NAME}_hosts" uc_verify03)" "201"
  eng_rm "${NAME}_hosts" >/dev/null 2>&1
fi

echo
echo "An accepted start"
START_BODY=$(post_body '{}' "$NAME" uc_verify01)
check contract "the broker accepts a valid request" \
  "$(printf '%s' "$START_BODY" | python3 -c 'import json,sys; print("201" if json.load(sys.stdin).get("container_id") else "no")')" \
  "201"

# The isolation verdict, which the gateway forwards into shared state and the
# service card renders. It is answered here, by the engine, rather than left
# for a frontend to infer from a runtime name — a UI matching strings against a
# list would quietly call an unfamiliar runtime safe.
if [ "$ENGINE" = "apple" ]; then
  # Every container is a VM here, whatever the runtime handler is called.
  EXPECTED_ISOLATION=microvm
else
  case "$BROKER_RUNTIME" in
    kata|kata-*) EXPECTED_ISOLATION=microvm ;;
    *)           EXPECTED_ISOLATION=shared-kernel ;;
  esac
fi
check contract "the start says what isolated the container" \
  "$(printf '%s' "$START_BODY" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("isolation",""))')" \
  "$EXPECTED_ISOLATION"
check contract "the start says which engine ran it" \
  "$(printf '%s' "$START_BODY" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("engine",""))')" \
  "$ENGINE"
check contract "the start carries what this deployment gave up" \
  "$(printf '%s' "$START_BODY" | python3 -c 'import json,sys; print(",".join(json.load(sys.stdin).get("concessions",[])))')" \
  "$CONCESSIONS"
sleep 3
check daemon "the container is running"  "$(eng_field "$NAME" state)" "running"
check daemon "it is not privileged" "$(eng_field "$NAME" privileged)" \
  "$([ "$ENGINE" = apple ] && echo 'n/a' || echo 'false')"
check daemon "all capabilities dropped first" "$(eng_field "$NAME" cap_drop)" \
  "$([ "$ENGINE" = apple ] && echo 'ALL' || echo '[ALL]')"
# Where /dev/net/tun comes from, which is the whole device policy.
#
# The container runs an OpenVPN client to reach its gateway, so it needs a tun
# device either way. Under a microVM the guest kernel provides one and passing
# the host's in would punch through the isolation the microVM exists for; under
# a shared-kernel runtime there is no guest kernel, so the host device is the
# only source and OpenVPN would otherwise connect to its peer and exit.
#
# So the expectation follows the runtime rather than being fixed at "absent" —
# asserting `[]` under runc was checking half the policy and calling the other
# half a failure. A request still cannot ask for a device on any of them.
case "$ENGINE:$BROKER_RUNTIME" in
  apple:*)
    # Nothing to pass: there is no --device in this vocabulary at all.
    check daemon "no host device passed through" "$(eng_field "$NAME" devices)" "n/a" ;;
  docker:kata|docker:kata-*)
    check daemon "no host device passed through" "$(eng_field "$NAME" devices)" "[]" ;;
  *)
    check daemon "tun passed in, because a shared kernel has none to give" \
      "$(eng_field "$NAME" devices)" "[{/dev/net/tun /dev/net/tun rwm}]" ;;
esac
check daemon "cpu limit applied" "$(eng_field "$NAME" cpus)" \
  "$([ "$ENGINE" = apple ] && echo '1' || echo '1000000000')"
check daemon "memory limit applied" "$(eng_field "$NAME" memory)" "268435456"
if [ "$ENGINE" = "apple" ]; then
  skip "swap capped at the memory limit" "the guest boots without swap; checked from inside"
  # The `pids-cgroup` concession, read back: RLIMIT_NPROC where Docker has a
  # cgroup pids.max. Asserted so the substitution stays visible rather than
  # becoming an unexplained gap.
  check daemon "process count capped by an nproc rlimit" "$(eng_field "$NAME" pids)" "128"
else
  check daemon "swap capped at the memory limit" "$(eng_field "$NAME" memory_swap)" "268435456"
  check daemon "pids limit applied" "$(eng_field "$NAME" pids)" "128"
fi
check daemon "runtime is the configured one" "$(eng_field "$NAME" runtime)" "$BROKER_RUNTIME"
check daemon "labelled for reaping" "$(eng_field "$NAME" label_uc)" "uc_verify01"
# Apple normalises a reference on the way in: a repository with no registry
# host gains `docker.io/`, and `repo:tag@sha256:…` comes back as
# `repo@sha256:…`. So the expectation is normalised too rather than the
# comparison loosened — anything that compares what started against what was
# asked for has to know this, and a digest-pinned tenant image must be checked
# by digest.
EXPECTED_REF="$BUILTIN_REF"
if [ "$ENGINE" = "apple" ]; then
  case "${BUILTIN_REF%%/*}" in
    *.*|*:*|localhost) ;;
    *) EXPECTED_REF="docker.io/${BUILTIN_REF}" ;;
  esac
fi
check daemon "started from the reference the catalog named" \
  "$(eng_field "$NAME" image)" "$EXPECTED_REF"

echo
echo "What the container can actually do"
# Adding an address to an interface, rather than `ip link add … type dummy`:
# the dummy driver is a kernel module the Kata guest kernel does not carry, so
# that probe answered `RTNETLINK: Not supported` on a container that did hold
# NET_ADMIN — a capability check failing on a kernel config. Confirmed on both
# engines that this one is denied without the capability and allowed with it.
eng_exec "$NAME" sh -c 'ip addr add 10.99.99.99/32 dev lo' >/dev/null 2>&1 \
  && ok "NET_ADMIN works — the VPN client can bring its link up" \
  || ko "NET_ADMIN works" "denied; the container could not reach its gateway"
eng_exec "$NAME" sh -c 'mkdir -p /mnt/x && mount -t tmpfs none /mnt/x' >/dev/null 2>&1 \
  && ko "SYS_ADMIN is denied" "it was granted" \
  || ok "SYS_ADMIN is denied"
if [ "$ENGINE" = "apple" ]; then
  # The inverse of the Docker check, and the point of the engine. There is no
  # host device here to leak; tun has to come from the guest's own kernel, and
  # without it the container's OpenVPN client cannot come up.
  eng_exec "$NAME" sh -c 'ls /dev/net/tun' >/dev/null 2>&1 \
    && ok "the guest kernel provides its own /dev/net/tun" \
    || ko "the guest provides /dev/net/tun" "absent; the VPN client cannot start"
  eng_exec "$NAME" sh -c 'uname -r' >/dev/null 2>&1 \
    && ok "the container runs its own kernel ($(eng_exec "$NAME" sh -c 'uname -r' 2>/dev/null | tr -d '\r'))" \
    || ko "the container runs its own kernel" "could not read it"
  swap=$(eng_exec "$NAME" sh -c "grep SwapTotal /proc/meminfo | tr -s ' ' | cut -d' ' -f2" 2>/dev/null | tr -d '\r')
  check guest "no swap in the guest, so the memory limit is hard" "$swap" "0"
else
  case "$BROKER_RUNTIME" in
    kata|kata-*)
      eng_exec "$NAME" sh -c 'ls /dev/net/tun' >/dev/null 2>&1 \
        && ko "no host device leaked in" "/dev/net/tun is present" \
        || ok "no host device leaked in" ;;
    *)
      # Under a shared kernel the device is the host's and is meant to be
      # there. That it is present is the check; that this is unavoidable
      # without a guest kernel is the reason the microVM path exists.
      eng_exec "$NAME" sh -c 'ls /dev/net/tun' >/dev/null 2>&1 \
        && ok "the host's tun is reachable, as a shared kernel requires" \
        || ko "the host's tun is reachable" "absent; the VPN client cannot start" ;;
  esac
fi
got=$(eng_exec "$NAME" sh -c 'echo -n $SETTINGS' 2>/dev/null | tr -d '\r')
check guest "the SETTINGS payload arrived intact" "$got" "$SETTINGS"
check guest "the memory limit is real inside the container" \
  "$(eng_exec "$NAME" sh -c 'cat /sys/fs/cgroup/memory.max' 2>/dev/null | tr -d '\r')" "268435456"
if [ "$ENGINE" = "apple" ]; then
  check guest "the nproc ceiling is real inside the container" \
    "$(eng_exec "$NAME" sh -c 'ulimit -u' 2>/dev/null | tr -d '\r')" "128"
fi

echo
echo "Network isolation, and wiring services after the fact"
NAME2="${NAME}_peer"
eng_rm "$NAME2" >/dev/null 2>&1
check contract "a second service starts" "$(post '{}' "$NAME2" uc_verify02)" "201"
sleep 3

IP1=$(eng_field "$NAME" ip)
eng_exec "$NAME2" sh -c "wget -q -T 3 -O /dev/null http://$IP1/" >/dev/null 2>&1 \
  && ko "two services are isolated by default" "the second reached the first" \
  || ok "two services are isolated by default"

NET=$(curl -s -X POST "$B/networks" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d "{\"project_id\":\"$PROJECT_ID\",\"name\":\"link\"}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin).get("network",""))')
check contract "a network can be created on its own" "$NET" "holistix_net_${PROJECT_ID}_link"

attach() {
  curl -s -o /dev/null -w '%{http_code}' -X POST "$B/networks/$NET/members" \
    -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -d "{\"container_id\":\"$1\"}"
}

if [ "$ENGINE" = "apple" ]; then
  # `container network connect` does not exist. The refusal is the check: a
  # no-op would let someone draw an edge between two services, save it, and
  # have it mean nothing. 501 rather than 400 so a caller can tell "you asked
  # wrongly" from "this deployment does not have that verb".
  check contract "attaching a running container is refused, not ignored" \
    "$(attach "$NAME")" "501"
  skip "attaching both to a network links them" "no-hot-network-attach concession"
  skip "a container from another project is refused" "attach is unavailable on this engine"
else
  for c in "$NAME" "$NAME2"; do attach "$c" >/dev/null; done
  sleep 1
  IP1_ON_NET=$(docker inspect "$NAME" --format "{{(index .NetworkSettings.Networks \"$NET\").IPAddress}}" 2>/dev/null)
  eng_exec "$NAME2" sh -c "wget -q -T 3 -O /dev/null http://$IP1_ON_NET/" >/dev/null 2>&1 \
    && ok "attaching both to a network links them, with no restart" \
    || ko "attaching both to a network links them" "still unreachable"

  # A container from another project must not be attachable to this network.
  docker rm -f netcross >/dev/null 2>&1
  docker run -d --name netcross --label holistix.project=other-project "$BUILTIN_REF" >/dev/null 2>&1
  check contract "a container from another project is refused" "$(attach netcross)" "403"
  docker rm -f netcross >/dev/null 2>&1
fi

eng_rm "$NAME2" >/dev/null 2>&1
eng_net_rm "$NET" >/dev/null 2>&1

echo
echo "============================================="
printf "passed: ${GREEN}%d${NC}   failed: ${RED}%d${NC}   skipped: ${GRAY}%d${NC}\n" \
  "$pass" "$fail" "$skipped"
printf "${GRAY}engine: %s   runtime: %s   groups: %s${NC}\n" "$ENGINE" "$BROKER_RUNTIME" "$CHECK_GROUPS"
if [ "$ENGINE" = "docker" ] && [ "$BROKER_RUNTIME" = "runc" ]; then
  printf "${GRAY}Ran under runc. The contract and daemon groups hold on any runtime;\n"
  printf "what is unproven is isolation from the host kernel, and only the guest\n"
  printf "group speaks to it. --runtime=kata needs /dev/kvm, which no Apple\n"
  printf "Silicon before M3 exposes to a guest — a Mac runs VMs perfectly well,\n"
  printf "it cannot run one inside another, and Docker already spent that level.\n"
  printf "BROKER_ENGINE=apple is the way to get the guest group answered on such\n"
  printf "a machine.${NC}\n"
fi
if [ "$ENGINE" = "apple" ]; then
  printf "${GRAY}Ran under Apple container: every check above happened inside a real\n"
  printf "microVM with its own kernel. What that does NOT cover is the Docker+Kata\n"
  printf "pairing itself, and the tenant pull path — a digest-pinned ghcr.io fetch\n"
  printf "with a minted token — which needs a real Ganymede.${NC}\n"
fi
echo "============================================="
[ "$fail" -eq 0 ]
