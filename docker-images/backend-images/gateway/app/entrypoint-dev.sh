#!/bin/bash
# Gateway container entrypoint with hot-reload support
# Watches a single explicit trigger file for reload signals

set -e

echo "🚀 Gateway Container Starting..."
echo "   GATEWAY_STATE: ${GATEWAY_STATE}"
echo "   HTTP Port: ${GATEWAY_HTTP_PORT}"
echo "   VPN Port: ${GATEWAY_VPN_PORT}"
echo "   Ganymede: ${GANYMEDE_FQDN}"
echo "   Domain: ${DOMAIN}"
echo ""

# Validate environment variables
if [ -z "$GATEWAY_STATE" ] || [ -z "$GATEWAY_HTTP_PORT" ] || [ -z "$GATEWAY_VPN_PORT" ]; then
    echo "❌ Missing required environment variables!"
    echo "   Required: GATEWAY_STATE, GATEWAY_HTTP_PORT, GATEWAY_VPN_PORT"
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

# Function to start app-gateway
start_gateway() {
    echo "🚀 Starting app-gateway process..."
    
    # Set environment for the app
    export NODE_ENV=${NODE_ENV:-development}
    export PORT=${GATEWAY_HTTP_PORT}
    export LOG_LEVEL=${LOG_LEVEL:-6}
    
    # Start in background and capture PID
    node dist/packages/app-gateway/main.js > /logs/gateway.log 2>&1 &
    APP_PID=$!
    
    echo "✅ app-gateway started (PID: $APP_PID)"
    echo "📊 Logs: /logs/gateway.log"
    echo ""
    
    # Return PID for monitoring
    echo $APP_PID
}

# Initial start
APP_PID=$(start_gateway)

# Setup signal handlers for graceful shutdown
shutdown() {
    echo ""
    echo "🛑 Shutdown signal received..."
    
    if [ -n "$APP_PID" ] && kill -0 $APP_PID 2>/dev/null; then
        echo "   Stopping app-gateway (PID: $APP_PID)..."
        kill -TERM $APP_PID 2>/dev/null || true
        
        # Wait for graceful shutdown (max 30s)
        for i in $(seq 1 30); do
            if ! kill -0 $APP_PID 2>/dev/null; then
                echo "   ✅ app-gateway stopped gracefully"
                break
            fi
            sleep 1
        done
        
        # Force kill if still running
        if kill -0 $APP_PID 2>/dev/null; then
            echo "   ⚠️  Forcing kill..."
            kill -KILL $APP_PID 2>/dev/null || true
        fi
    fi
    
    exit 0
}

trap shutdown SIGTERM SIGINT

# Hot-reload loop: watch trigger file for changes
echo "♻️  Hot-reload enabled: watching ${RELOAD_TRIGGER}"
echo "   To trigger reload: touch ${RELOAD_TRIGGER}"
echo ""

while true; do
    # Check if app is still running
    if ! kill -0 $APP_PID 2>/dev/null; then
        echo "⚠️  app-gateway process died unexpectedly!"
        echo "   Restarting in 3 seconds..."
        sleep 3
        APP_PID=$(start_gateway)
        continue
    fi
    
    # Wait for trigger file modification
    # Using timeout to check process health every 30s
    inotifywait -t 30 -e modify "${RELOAD_TRIGGER}" 2>/dev/null || true
    
    # If inotifywait detected a change (not timeout)
    if [ $? -eq 0 ]; then
        echo ""
        echo "🔄 Reload triggered! Restarting app-gateway..."
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        # Graceful shutdown
        if kill -0 $APP_PID 2>/dev/null; then
            kill -TERM $APP_PID 2>/dev/null || true
            
            # Wait for shutdown (max 10s)
            for i in $(seq 1 10); do
                if ! kill -0 $APP_PID 2>/dev/null; then
                    break
                fi
                sleep 1
            done
            
            # Force kill if needed
            if kill -0 $APP_PID 2>/dev/null; then
                kill -KILL $APP_PID 2>/dev/null || true
            fi
        fi
               
        # Restart
        sleep 1
        APP_PID=$(start_gateway)
        
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
    fi
done


