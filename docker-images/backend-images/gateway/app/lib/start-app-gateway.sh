#!/bin/bash
# Start app-gateway Node.js process with auto-restart on crash
# Simple restart loop - reload is triggered via reload-gateway.sh

set -e

# Set working directory to gateway app
GATEWAY_ROOT=${GATEWAY_ROOT:-"/opt/gateway"}

# Source config for GATEWAY_DEV and other vars
if [ -f "${GATEWAY_ROOT}/app/config.conf" ]; then
    source "${GATEWAY_ROOT}/app/config.conf"
fi
GATEWAY_APP_DIR="${GATEWAY_ROOT}/app-gateway"

if [ ! -f "${GATEWAY_APP_DIR}/main.js" ]; then
    echo "❌ Gateway app not found: ${GATEWAY_APP_DIR}/main.js"
    exit 1
fi

# Set log file
export LOG_FILE=${LOG_FILE:-"/tmp/gateway.log"}

echo "🚀 Starting app-gateway with auto-restart..."
echo "📂 App directory: ${GATEWAY_APP_DIR}"
echo "📊 Logs: ${LOG_FILE}"
echo ""

while true; do
    # Set environment for the app
    export NODE_ENV=${NODE_ENV:-development}
    export PORT=${GATEWAY_HTTP_PORT:-8888}
    export LOG_LEVEL=${LOG_LEVEL:-6}

    echo "✅ app-gateway starting..."
    
    # Start app-gateway (blocks until exit)
    # CRITICAL: Use absolute path AND set working directory in the node command
    # to avoid uv_cwd errors when started via nohup/setsid
    # The `cd` in a subshell ensures Node.js bootstrap can read cwd correctly
    GATEWAY_ID="${GATEWAY_ID}" \
    GATEWAY_TOKEN="${GATEWAY_TOKEN}" \
    GANYMEDE_FQDN="${GANYMEDE_FQDN}" \
    ALLOWED_ORIGINS="${ALLOWED_ORIGINS}" \
    JWT_PUBLIC_KEY="${JWT_PUBLIC_KEY}" \
    GATEWAY_DEV="${GATEWAY_DEV:-}" \
        bash -c "cd '${GATEWAY_APP_DIR}' && node --enable-source-maps '${GATEWAY_APP_DIR}/main.js'" > "$LOG_FILE" 2>&1
    
    EXIT_CODE=$?
    
    # Check if process died due to reload-gateway.sh (graceful reload)
    if [ -f /tmp/gateway-reloading ]; then
        echo "🔄 Reload triggered, restarting..."
        rm -f /tmp/gateway-reloading
        sleep 1
        continue
    fi
    
    # Check if process died due to reset-gateway.sh (full reset in progress)
    if [ -f /tmp/gateway-resetting ]; then
        echo "✅ Gateway reset in progress, exiting..."
        echo "   reset-gateway.sh will start new instance"
        exit 0
    fi
    
    # Process died unexpectedly (crash/error)
    echo "⚠️  app-gateway exited with code: $EXIT_CODE"
    echo "   Restarting in 3 seconds..."
    sleep 3
done
