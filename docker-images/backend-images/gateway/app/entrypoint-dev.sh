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

# Ensure workspace exists
if [ ! -d "$WORKSPACE" ]; then
    echo "❌ Workspace not found: $WORKSPACE"
    exit 1
fi

# Navigate to workspace repository root
REPO_ROOT="${WORKSPACE}/monorepo"
if [ ! -d "$REPO_ROOT" ]; then
    echo "❌ Repository not found: $REPO_ROOT"
    exit 1
fi

cd "$REPO_ROOT"
echo "📂 Working directory: $(pwd)"
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Call reset-gateway to set up infrastructure and start app-gateway
# reset-gateway will start app-gateway with hot-reload loop in background
echo "🔧 Setting up gateway infrastructure (VPN, Nginx, app-gateway)..."
echo ""

# Set environment for reset-gateway
export RELOAD_TRIGGER=${RELOAD_TRIGGER:-"${REPO_ROOT}/.gateway-reload-trigger"}
export LOG_FILE="/logs/gateway.log"

# Call reset-gateway via main.sh (runs in background via nohup)
"${SCRIPT_DIR}/main.sh" -r bin/reset-gateway.sh

echo "✅ Gateway infrastructure setup initiated"
echo "📊 App-gateway logs: ${LOG_FILE}"
echo ""

# Keep container alive
echo "🔄 Container running"
tail -f /dev/null
