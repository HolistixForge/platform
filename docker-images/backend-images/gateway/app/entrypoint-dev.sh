#!/bin/bash
# Gateway container entrypoint
# Calls reset-gateway to set up infrastructure and start app-gateway with hot-reload

set -e

echo "🚀 Gateway Container Starting..."
echo "   HTTP Port: ${GATEWAY_HTTP_PORT}"
echo "   VPN Port: ${GATEWAY_VPN_PORT}"
echo "   Ganymede: ${GANYMEDE_FQDN}"
echo "   Domain: ${DOMAIN}"
echo ""

# Validate environment variables
if [ -z "$GATEWAY_HTTP_PORT" ] || [ -z "$GATEWAY_VPN_PORT" ]; then
    echo "❌ Missing required environment variables!"
    echo "   Required: GATEWAY_HTTP_PORT, GATEWAY_VPN_PORT"
    exit 1
fi

# Make the platform's names resolve, whatever engine started this container.
#
# Under Docker the pool passes `--dns` and CoreDNS answers, so every name here
# already resolves and nothing below writes anything. Apple `container` takes
# an IP for `--dns` and no port, and the CoreDNS this platform runs on macOS is
# unprivileged on 15353 — so there is nothing to point at. The container works
# the host out instead, from the one address it always has and never has to be
# given: the gateway of its own network.
#
# The same reasoning, and the same code, as user containers have had since
# dd0d0dd2. Only names that do not already resolve: a real DNS name in
# production is left exactly as it is, because overriding one would send this
# gateway somewhere else for a reason invisible from outside.

# The default route, without needing `ip`.
#
# iproute2 is not an explicit dependency of this image — it arrives only if
# `openvpn` happens to pull it in — and `ip route` was the sole source here.
# Absent, the function found nothing, returned quietly, and wrote no hosts
# entry at all: the gateway then cannot reach Ganymede by name and nothing in
# its output says why. The same trap was already paid for once in
# `packages/modules/user-containers/docker-images/base/container-functions.sh`,
# and this is the same fallback, kept deliberately identical to it.
#
# /proc/net/route is the kernel's own table and needs no package. The gateway
# column is little-endian hex, which is why the bytes come out backwards.
default_gateway() {
    local gw
    gw=$(ip route 2>/dev/null | awk '/^default/{print $3; exit}')
    if [ -n "${gw}" ]; then
        echo "${gw}"
        return 0
    fi

    local iface dest gwhex flags refcnt use metric mask rest
    while read -r iface dest gwhex flags refcnt use metric mask rest; do
        [ "${dest}" = "00000000" ] || continue
        [ "${mask}" = "00000000" ] || continue
        [ ${#gwhex} -eq 8 ] || continue
        # A link-scope default route has no gateway. Written out it becomes
        # `0.0.0.0 ganymede....` in /etc/hosts — non-empty, so the caller's
        # emptiness check passes, and every request to the platform then goes
        # nowhere with a hosts file that looks right at a glance.
        [ "${gwhex}" = "00000000" ] && continue
        printf '%d.%d.%d.%d\n' \
            "0x${gwhex:6:2}" "0x${gwhex:4:2}" "0x${gwhex:2:2}" "0x${gwhex:0:2}"
        return 0
    done < /proc/net/route 2>/dev/null
    return 1
}

resolve_platform_hosts() {
    local host_ip
    host_ip=$(default_gateway | head -1)
    if [ -z "${host_ip}" ]; then
        # Loud rather than quiet. The silent return is what made the original
        # failure invisible: the platform names simply were not there, and the
        # first symptom was an unreachable Ganymede much later.
        echo "⚠️  No default route — platform names will not resolve in this container"
        return 0
    fi

    for entry in "${GANYMEDE_FQDN:-}" "${DOMAIN:-}"; do
        # The FQDNs carry a port where nginx does not listen on 443. A port is
        # fine in a Host header and meaningless in /etc/hosts.
        name="${entry%%:*}"
        [ -z "${name}" ] && continue
        [ "${name}" = "null" ] && continue
        grep -qE "[[:space:]]${name}\$" /etc/hosts 2>/dev/null && continue

        # "It already resolves" is not the same as "it resolves to somewhere
        # this container can go". Measured on macOS: the host's own CoreDNS
        # answers 127.0.0.1 for every platform name — right for the host, where
        # nginx is listening, and inside a microVM that address is the microVM.
        # So a loopback answer is overridden and anything else is left exactly
        # as it is: a real DNS name in production never points at loopback, and
        # sending this gateway somewhere else would be invisible from outside.
        resolved=$(getent hosts "${name}" 2>/dev/null | awk '{print $1; exit}')
        # Every spelling of loopback, and only loopback. `getent` can answer
        # `0:0:0:0:0:0:0:1` or an IPv4-mapped form depending on the resolver,
        # and those fell through to "a real address" — the exact failure this
        # override exists to fix, differently formatted.
        #
        # `0.0.0.0` is deliberately *not* in this list. It is not loopback: it
        # is what a resolver returns for a name it blackholes, which is an
        # answer somebody configured on purpose. Overriding it would send this
        # gateway to its default route past a deliberate block. The zero
        # address does have to be rejected where it is genuinely meaningless —
        # as a *default route* — and `default_gateway` does that on its own.
        case "${resolved}" in
            '') ;;                       # nothing answered — ours to write
            127.*|::1|0:0:0:0:0:0:0:1|::ffff:127.*) ;;
                                         # answered with itself — not usable here
            *) continue ;;               # a real address, and not ours to move
        esac

        echo "${host_ip} ${name}" >>/etc/hosts
        echo "   resolved ${name} → ${host_ip} (this container's default route)"
    done
}
resolve_platform_hosts

# Fetch gateway build from HTTP server
echo "📥 Fetching gateway build from dev container..."
/app/lib/fetch-gateway-build.sh

# Set gateway root (extracted build location)
export GATEWAY_ROOT="/opt/gateway"

# Verify build was extracted
if [ ! -d "$GATEWAY_ROOT" ]; then
    echo "❌ Gateway build not found at: $GATEWAY_ROOT"
    exit 1
fi

echo "📂 Gateway root: $GATEWAY_ROOT"
echo ""

# Set environment for reset-gateway
export LOG_FILE="/tmp/gateway.log"

# Call reset-gateway to set up infrastructure and start app-gateway
# reset-gateway starts app-gateway with simple auto-restart loop
echo "🔧 Setting up gateway infrastructure (VPN, Nginx, app-gateway)..."
echo ""

# Call reset-gateway via main.sh (runs in background via nohup)
cd "$GATEWAY_ROOT"
./app/main.sh -r bin/reset-gateway.sh

echo "✅ Gateway infrastructure setup initiated"
echo "📊 App-gateway logs: ${LOG_FILE}"
echo ""

# Keep container alive
echo "🔄 Container running"
tail -f /dev/null
