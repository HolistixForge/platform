#!/bin/bash
# Restart all development services
# Use this if services need to be restarted manually

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/coredns-common.sh"

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
# restart_coredns() prefers the systemd unit when one exists (VM / bare-metal
# installs provisioned by infra/ansible) and falls back to a bare background
# process in dev containers, which have no systemd.
echo "🌐 Restarting CoreDNS..."
if command -v coredns &> /dev/null && [ -f /etc/coredns/Corefile ]; then
    restart_coredns true && echo "   ✅ CoreDNS restarted" || echo "   ⚠️  CoreDNS failed to start"
else
    echo "   ⚠️  CoreDNS not installed or not configured"
fi

# Restart the gateway build server
BUILD_SERVER_PORT=8090
echo "🔧 Restarting build server..."
if command -v systemctl >/dev/null 2>&1 \
   && systemctl list-unit-files holistix-buildserver.service >/dev/null 2>&1 \
   && systemctl cat holistix-buildserver.service >/dev/null 2>&1; then
    sudo systemctl restart holistix-buildserver
    sleep 1
    if sudo systemctl is-active --quiet holistix-buildserver; then
        echo "   ✅ Build server restarted (systemd)"
    else
        echo "   ⚠️  Build server failed to start (journalctl -u holistix-buildserver)"
    fi
elif lsof -i :$BUILD_SERVER_PORT >/dev/null 2>&1; then
    BUILD_PID=$(lsof -t -i :$BUILD_SERVER_PORT)
    kill $BUILD_PID 2>/dev/null || true
    sleep 1

    if [ -d "/root/.local-dev-builds" ]; then
        (cd "${SCRIPT_DIR}" && nohup ./serve-builds.sh > /tmp/build-server.log 2>&1 &)
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

