#!/bin/bash
# Install and configure PowerDNS with existing PostgreSQL backend
# Usage: ./setup-powerdns.sh

set -e

echo "🌐 Setting up PowerDNS..."
echo ""

# Get PostgreSQL connection info from environment or defaults
PG_HOST=${PG_HOST:-localhost}
PG_PORT=${PG_PORT:-5432}
PG_USER=${PG_USER:-postgres}
PG_PASSWORD=${PG_PASSWORD:-devpassword}

# Install PowerDNS and PostgreSQL backend
echo "📦 Installing PowerDNS packages..."
sudo apt-get update
sudo apt-get install -y pdns-server pdns-backend-pgsql curl

if [ $? -ne 0 ]; then
    echo "❌ Failed to install PowerDNS"
    exit 1
fi

echo "✅ PowerDNS packages installed"
echo ""

# Create PowerDNS database
echo "🗄️  Creating PowerDNS database..."

PGPASSWORD=${PG_PASSWORD} psql -U ${PG_USER} -h ${PG_HOST} -p ${PG_PORT} <<'EOF' || echo "   Database may already exist"
-- Create pdns database
CREATE DATABASE pdns;
EOF

echo "   ✅ Database 'pdns' created (or already exists)"
echo ""

# Apply official PowerDNS schema (idempotent)
echo "📜 Applying official PowerDNS PostgreSQL schema (if needed)..."

# First, check if the schema appears to be applied already (check for 'domains' table)
SCHEMA_APPLIED=$(
  PGPASSWORD=${PG_PASSWORD} psql -U ${PG_USER} -h ${PG_HOST} -p ${PG_PORT} -d pdns -tAc \
    "SELECT 1 FROM information_schema.tables WHERE table_name = 'domains' LIMIT 1;" 2>/dev/null || echo ""
)

if [ "$SCHEMA_APPLIED" = "1" ]; then
    echo "   ✅ PowerDNS schema already applied (found 'domains' table), skipping."
else
    echo "   Schema not detected, applying official PowerDNS schema..."

    # The schema file comes with pdns-backend-pgsql package
    SCHEMA_FILE="/usr/share/doc/pdns-backend-pgsql/schema.pgsql.sql"

    if [ ! -f "$SCHEMA_FILE" ]; then
        # Try alternate location (some distros compress it)
        if [ -f "${SCHEMA_FILE}.gz" ]; then
            echo "   Found compressed schema, decompressing..."
            sudo gunzip -k "${SCHEMA_FILE}.gz" 2>/dev/null || true
        fi
    fi

    if [ -f "$SCHEMA_FILE" ]; then
        echo "   Using official schema: $SCHEMA_FILE"
        PGPASSWORD=${PG_PASSWORD} psql -U ${PG_USER} -h ${PG_HOST} -p ${PG_PORT} -d pdns < "$SCHEMA_FILE"
        
        if [ $? -ne 0 ]; then
            echo "❌ Failed to apply PowerDNS schema"
            exit 1
        fi
        
        echo "   ✅ Official PowerDNS schema applied successfully"
    else
        echo "❌ PowerDNS schema file not found at: $SCHEMA_FILE"
        echo "   This usually means pdns-backend-pgsql was not installed correctly."
        exit 1
    fi
fi

echo ""

# Configure PowerDNS
echo "⚙️  Configuring PowerDNS..."

sudo tee /etc/powerdns/pdns.conf > /dev/null <<EOF
# PowerDNS Configuration for Demiurge Local Development

# Database backend
launch=gpgsql
gpgsql-host=${PG_HOST}
gpgsql-port=${PG_PORT}
gpgsql-dbname=pdns
gpgsql-user=${PG_USER}
gpgsql-password=${PG_PASSWORD}
gpgsql-dnssec=no

# API configuration
api=yes
api-key=local-dev-api-key
webserver=yes
webserver-address=0.0.0.0
webserver-port=8081
webserver-allow-from=0.0.0.0/0

# Listening
local-address=0.0.0.0
local-port=53

# Logging
loglevel=4
log-dns-details=no
log-dns-queries=no

# Other
daemon=yes
guardian=yes
setuid=pdns
setgid=pdns
EOF

echo "✅ PowerDNS configuration written to /etc/powerdns/pdns.conf"
echo ""

# Start or restart PowerDNS safely
echo "🚀 Starting PowerDNS..."

# Start daemon only if not already running
if pgrep -x pdns_server >/dev/null 2>&1; then
    echo "   PowerDNS already running (pdns_server process found), not starting a second instance."
else
    sudo pdns_server --daemon=yes --guardian=yes --config-dir=/etc/powerdns
fi

# Wait for PowerDNS to be ready
echo "⏳ Waiting for PowerDNS to start..."
sleep 5

# Test PowerDNS API
if ! curl -s -f "http://localhost:8081/api/v1/servers" -H "X-API-Key: local-dev-api-key" > /dev/null 2>&1; then
    echo "❌ PowerDNS API not responding. Check logs: sudo tail -f /var/log/pdns.log"
    exit 1
fi

echo "✅ PowerDNS service started and API responding"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ PowerDNS setup complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 PowerDNS Information:"
echo "   DNS Server: 0.0.0.0:53 (UDP/TCP)"
echo "   API URL: http://localhost:8081"
echo "   API Key: local-dev-api-key"
echo "   Database: ${PG_HOST}:${PG_PORT}/pdns"
echo ""
echo "📝 Next steps:"
echo "   DNS zones will be created automatically by create-env.sh"
echo "   for each environment you create."
echo ""
echo "🧪 Test PowerDNS API:"
echo "   curl http://localhost:8081/api/v1/servers/localhost/zones \\"
echo "     -H 'X-API-Key: local-dev-api-key'"
echo ""
echo "📊 View logs:"
echo "   sudo tail -f /var/log/pdns.log"
echo ""


