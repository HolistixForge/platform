#!/bin/bash
# Restart all development services
# Use this if services need to be restarted manually

set -e

echo "🔄 Restarting all development services..."
echo ""

# Restart PostgreSQL
echo "📦 Restarting PostgreSQL..."
if service postgresql status 2>/dev/null | grep -q "online"; then
    sudo service postgresql restart
else
    sudo service postgresql start
fi
echo "   ✅ PostgreSQL restarted"

# Restart Nginx
echo "🌐 Restarting Nginx..."
sudo service nginx restart
echo "   ✅ Nginx restarted"

# Restart CoreDNS
echo "🌐 Restarting CoreDNS..."
if pgrep -x coredns >/dev/null 2>&1; then
    sudo killall coredns 2>/dev/null || true
    sleep 1
fi
if command -v coredns &> /dev/null && [ -f /etc/coredns/Corefile ]; then
    sudo coredns -conf /etc/coredns/Corefile &
    sleep 2
    if pgrep -x coredns >/dev/null 2>&1; then
        echo "   ✅ CoreDNS restarted"
    else
        echo "   ⚠️  CoreDNS failed to start"
    fi
else
    echo "   ⚠️  CoreDNS not installed or not configured"
fi

# Optionally restart build server
BUILD_SERVER_PORT=8090
if lsof -i :$BUILD_SERVER_PORT >/dev/null 2>&1; then
    echo "🔧 Restarting build server..."
    BUILD_PID=$(lsof -t -i :$BUILD_SERVER_PORT)
    kill $BUILD_PID 2>/dev/null || true
    sleep 1
    
    if [ -d "/root/.local-dev-builds" ]; then
        (cd /root/workspace/monorepo/scripts/local-dev && nohup ./serve-builds.sh > /tmp/build-server.log 2>&1 &)
        sleep 2
        if lsof -i :$BUILD_SERVER_PORT >/dev/null 2>&1; then
            echo "   ✅ Build server restarted"
        else
            echo "   ⚠️  Build server failed to start"
        fi
    fi
else
    echo "   ℹ️  Build server not running (optional)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All services restarted successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Service Status:"
echo "   PostgreSQL: $(service postgresql status 2>/dev/null | grep -o 'online\|down' || echo 'unknown')"
echo "   Nginx:      $(pgrep -x nginx > /dev/null && echo 'running' || echo 'stopped')"
echo "   CoreDNS:    $(pgrep -x coredns > /dev/null && echo 'running' || echo 'stopped')"
echo "   Build Srv:  $(lsof -i :$BUILD_SERVER_PORT >/dev/null 2>&1 && echo 'running' || echo 'stopped')"
echo ""

