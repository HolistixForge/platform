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
resolve_platform_hosts() {
    local host_ip
    host_ip=$(ip route 2>/dev/null | awk '/^default/{print $3; exit}')
    [ -z "${host_ip}" ] && return 0

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
        case "${resolved}" in
            '') ;;                       # nothing answered — ours to write
            127.*|::1) ;;                # answered with itself — not usable here
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
