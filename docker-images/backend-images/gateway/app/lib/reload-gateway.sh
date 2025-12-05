#!/bin/bash
# Reload gateway by fetching new build and restarting Node.js process
# Executed via: docker exec <container> /opt/gateway/app/lib/reload-gateway.sh

set -e

echo ""
echo "🔄 Gateway Reload Triggered"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Set marker to indicate graceful reload (not a crash)
touch /tmp/gateway-reloading

# Fetch new build from HTTP server
echo "📥 Fetching latest gateway build..."
/app/lib/fetch-gateway-build.sh

echo ""
echo "🔄 Restarting Node.js process..."

# Find and gracefully terminate Node.js process
NODE_PID=$(pgrep -f "node.*main.js" || echo "")

if [ -n "$NODE_PID" ]; then
    echo "   Stopping Node.js (PID: $NODE_PID)..."
    kill -TERM "$NODE_PID" 2>/dev/null || true
    
    # Wait for graceful shutdown (max 10s)
    for i in $(seq 1 10); do
        if ! kill -0 "$NODE_PID" 2>/dev/null; then
            echo "   ✅ Node.js stopped gracefully"
            break
        fi
        sleep 1
    done
    
    # Force kill if needed
    if kill -0 "$NODE_PID" 2>/dev/null; then
        echo "   ⚠️  Forcing shutdown..."
        kill -KILL "$NODE_PID" 2>/dev/null || true
    fi
else
    echo "   ⚠️  Node.js not running"
fi

echo ""
echo "✅ Reload complete!"
echo "   start-app-gateway.sh will restart Node.js automatically"
echo ""

