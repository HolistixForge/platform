#!/bin/bash
# Start required services for local development
# Run this when the dev container starts

set -e

echo "🚀 Starting development services..."
echo ""

# Start PostgreSQL
echo "📦 Starting PostgreSQL..."
if service postgresql status | grep -q "down"; then
    service postgresql start
    echo "   ✅ PostgreSQL started"
else
    echo "   ✅ PostgreSQL already running"
fi

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
for i in {1..10}; do
    if PGPASSWORD=devpassword psql -U postgres -h localhost -c "SELECT 1" > /dev/null 2>&1; then
        echo "   ✅ PostgreSQL is ready"
        break
    fi
    if [ $i -eq 10 ]; then
        echo "   ❌ PostgreSQL failed to start"
        exit 1
    fi
    sleep 1
done

# Start PowerDNS
echo "🌐 Starting PowerDNS..."
if pgrep -x pdns_server >/dev/null 2>&1; then
    echo "   ✅ PowerDNS already running"
else
    sudo pdns_server --daemon=yes --guardian=yes --config-dir=/etc/powerdns
    echo "   ✅ PowerDNS started"
fi

# Wait for PowerDNS to be ready
echo "⏳ Waiting for PowerDNS API to be ready..."
for i in {1..10}; do
    if curl -s -f "http://localhost:8081/api/v1/servers" -H "X-API-Key: local-dev-api-key" > /dev/null 2>&1; then
        echo "   ✅ PowerDNS API is ready"
        break
    fi
    if [ $i -eq 10 ]; then
        echo "   ❌ PowerDNS API failed to start"
        exit 1
    fi
    sleep 1
done

echo ""
echo "✅ All services started successfully!"
echo ""
echo "📋 Service Status:"
echo "   PostgreSQL: $(service postgresql status | grep -o 'online\|down')"
echo "   PowerDNS:   $(pgrep -x pdns_server > /dev/null && echo 'running' || echo 'stopped')"
echo ""
echo "💡 Optional: Start build server for gateway hot-reload:"
echo "   cd /root/workspace/monorepo/scripts/local-dev"
echo "   ./serve-builds.sh &"
echo ""

