#!/bin/bash
# Start app-gateway Node.js process with hot-reload support
# Always executed directly (never sourced)

set -e

# Ensure workspace exists
if [ -z "$WORKSPACE" ]; then
    echo "❌ WORKSPACE environment variable not set"
    exit 1
fi

REPO_ROOT="${WORKSPACE}/monorepo"
if [ ! -d "$REPO_ROOT" ]; then
    echo "❌ Repository not found: $REPO_ROOT"
    exit 1
fi

cd "$REPO_ROOT"

# Set log file
export LOG_FILE=${LOG_FILE:-"/tmp/app-gateway.log"}

# Hot-reload loop: watch trigger file for changes
if [ -n "$RELOAD_TRIGGER" ]; then
    echo "♻️  Hot-reload enabled: watching ${RELOAD_TRIGGER}"
    echo "   To trigger reload: touch ${RELOAD_TRIGGER}"
    echo ""
fi

while true; do
    # Set environment for the app
    export NODE_ENV=${NODE_ENV:-development}
    export PORT=${GATEWAY_HTTP_PORT:-8888}
    export LOG_LEVEL=${LOG_LEVEL:-6}

    # Build environment variables for app-gateway
    local env_vars=(
        "SERVER_BIND=${SERVER_BIND:-[{\"host\": \"127.0.0.1\", \"port\": 8888}]}"
        "GATEWAY_FQDN=${GATEWAY_FQDN}"
        "GANYMEDE_FQDN=${GANYMEDE_FQDN}"
        "ALLOWED_ORIGINS=${ALLOWED_ORIGINS}"
        "GATEWAY_SCRIPTS_DIR=${GATEWAY_SCRIPTS_DIR}"
        "GATEWAY_ID=${GATEWAY_ID}"
        "GATEWAY_TOKEN=${GATEWAY_TOKEN}"
        "GATEWAY_HMAC_SECRET=${GATEWAY_HMAC_SECRET}"
    )

    # Start app-gateway in background
    env "${env_vars[@]}" \
        node --enable-source-maps ./dist/packages/app-gateway/main.js > "$LOG_FILE" 2>&1 &
    APP_PID=$!
    
    echo "✅ app-gateway started (PID: $APP_PID)"
    echo "📊 Logs: ${LOG_FILE}"
    echo ""

    # Wait for trigger file modification or process death
    if [ -n "$RELOAD_TRIGGER" ]; then
        # Watch trigger file with timeout to check process health
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
            continue
        fi
        else
            # No hot-reload, just wait for process to die
            wait $APP_PID 2>/dev/null || true
        fi

    # Check if app is still running
    if ! kill -0 $APP_PID 2>/dev/null; then
        # Check if process died due to reset-gateway.sh (normal shutdown)
        # Check immediately to avoid race condition with marker file removal
        if [ -f /tmp/gateway-resetting ]; then
            echo "✅ app-gateway stopped (reset-gateway in progress)"
            echo "   Exiting to let reset-gateway.sh start new process"
            exit 0
        fi
        
        # Process died unexpectedly (crash/error)
        echo "⚠️  app-gateway process died unexpectedly!"
        echo "   Restarting in 3 seconds..."
        sleep 3
        continue
    fi
done
