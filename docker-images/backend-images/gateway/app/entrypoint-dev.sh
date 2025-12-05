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
