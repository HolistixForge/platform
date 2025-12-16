#!/bin/bash
# Create a new local development environment with multi-gateway support
# Usage: ./create-env.sh <env-name> [domain] [workspace-path]
# Usage: ./create-env.sh dev-001
# Usage: ./create-env.sh dev-001 domain.local
# Usage: ./create-env.sh dev-001 mycompany.local /root/workspace-feat/monorepo

set -e

ENV_NAME=$1
DOMAIN=${2:-"domain.local"}
WORKSPACE_PATH=${3:-"/root/workspace/monorepo"}
GATEWAY_POOL_SIZE=${GATEWAY_POOL_SIZE:-3}  # Default: 3 gateways in pool

if [ -z "$ENV_NAME" ]; then
  echo "Usage: $0 <env-name> [domain] [workspace-path]"
  echo "Example: $0 dev-001"
  echo "Example: $0 dev-001 domain.local"
  echo "Example: $0 dev-001 mycompany.local /root/workspace-feat/monorepo"
  echo ""
  echo "Gateway pool size can be set via environment variable:"
  echo "  GATEWAY_POOL_SIZE=5 $0 dev-001"
  exit 1
fi

# Validate paths exist
if [ ! -d "$WORKSPACE_PATH" ]; then
  echo "❌ Workspace path not found: $WORKSPACE_PATH"
  exit 1
fi


# Validate environment name (alphanumeric + dash only)
if ! [[ "$ENV_NAME" =~ ^[a-z0-9-]+$ ]]; then
  echo "❌ Environment name must be lowercase alphanumeric with dashes only"
  exit 1
fi

# Find available environment number (port allocation)
# Check which numbers are already in use
used_numbers=()
for env_dir in /root/.local-dev/*/; do
  if [ -d "$env_dir" ]; then
    # Extract port from .env.ganymede if it exists
    env_file="${env_dir}/.env.ganymede"
    if [ -f "$env_file" ]; then
      port=$(grep "^PORT=" "$env_file" | cut -d= -f2)
      if [ ! -z "$port" ]; then
        # Calculate number from port: (port - 6000) / 10
        num=$(( (port - 6000) / 10 ))
        used_numbers+=($num)
      fi
    fi
  fi
done

# Find available number (random selection with collision check)
max_attempts=100
attempt=0
while [ $attempt -lt $max_attempts ]; do
  # Generate random number between 1 and 99
  ENV_NUMBER=$((RANDOM % 99 + 1))
  
  # Check if not in use
  if [[ ! " ${used_numbers[@]} " =~ " ${ENV_NUMBER} " ]]; then
    break
  fi
  
  attempt=$((attempt + 1))
done

if [ $attempt -eq $max_attempts ]; then
  echo "❌ Could not find available environment number after ${max_attempts} attempts"
  echo "   You may have too many environments. Consider deleting unused ones."
  exit 1
fi

# Safe database name (replace dashes with underscores)
DB_NAME="ganymede_${ENV_NAME//-/_}"

# Ports
GANYMEDE_PORT=$((6000 + ENV_NUMBER * 10))
GATEWAY_PORT=$((7000 + ENV_NUMBER * 10))

# Directories
ENV_DIR="/root/.local-dev/${ENV_NAME}"
DATA_DIR="${ENV_DIR}/data"
LOGS_DIR="${ENV_DIR}/logs"

echo "📦 Creating environment: ${ENV_NAME}"
echo "   Domain: ${DOMAIN}"
echo "   Workspace: ${WORKSPACE_PATH}"
echo "   Database: ${DB_NAME}"
echo "   Ganymede port: ${GANYMEDE_PORT}"
echo "   Gateway pool size: ${GATEWAY_POOL_SIZE}"
echo ""

# 1. Create directory structure
mkdir -p "${ENV_DIR}"
mkdir -p "${ENV_DIR}/pids"  # Store PID files
mkdir -p "${DATA_DIR}"
mkdir -p "${LOGS_DIR}"

# 2. Create database and app user
echo "🐘 Creating database and application user..."

# Create database
PGPASSWORD=devpassword psql -U postgres -h localhost -c "CREATE DATABASE ${DB_NAME};" 2>/dev/null || echo "   Database already exists"

# Generate random password for application user (32 chars, alphanumeric)
APP_DB_USER="ganymede_app_${ENV_NAME//-/_}"
APP_DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)

# Create application user with limited privileges (or update password if exists)
PGPASSWORD=devpassword psql -U postgres -h localhost -d "${DB_NAME}" << EOF
-- Create user if not exists, otherwise update password
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${APP_DB_USER}') THEN
    CREATE USER ${APP_DB_USER} WITH PASSWORD '${APP_DB_PASSWORD}';
  ELSE
    ALTER USER ${APP_DB_USER} WITH PASSWORD '${APP_DB_PASSWORD}';
  END IF;
END
\$\$;

-- Grant connection privilege
GRANT CONNECT ON DATABASE ${DB_NAME} TO ${APP_DB_USER};
EOF

echo "   ✅ Database created: ${DB_NAME}"
echo "   ✅ Application user created: ${APP_DB_USER}"

# 3. Deploy database schema (using postgres superuser)
echo "📊 Deploying database schema..."
cd "${WORKSPACE_PATH}/packages/app-ganymede/database"
# Set locale to avoid warnings
export LANGUAGE=en_US.UTF-8
export LC_ALL=en_US.UTF-8
export LANG=en_US.UTF-8
PGPASSWORD=devpassword ./run.sh schema "${DB_NAME}"
PGPASSWORD=devpassword ./run.sh procedures "${DB_NAME}"
PGPASSWORD=devpassword ./run.sh triggers "${DB_NAME}"

# 4. Grant privileges to application user (after schema is deployed)
echo "🔐 Granting privileges to application user..."
PGPASSWORD=devpassword psql -U postgres -h localhost -d "${DB_NAME}" << EOF
-- CRITICAL: Grant usage on schema (must be first!)
GRANT USAGE, CREATE ON SCHEMA public TO ${APP_DB_USER};

-- Grant table privileges (SELECT, INSERT, UPDATE, DELETE)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${APP_DB_USER};

-- Grant sequence privileges (for serial columns)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${APP_DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${APP_DB_USER};

-- Grant execution on functions AND procedures (PostgreSQL 11+ distinguishes these)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${APP_DB_USER};
GRANT EXECUTE ON ALL PROCEDURES IN SCHEMA public TO ${APP_DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO ${APP_DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON PROCEDURES TO ${APP_DB_USER};

-- Set search_path to include public schema (usually default, but make explicit)
ALTER USER ${APP_DB_USER} SET search_path TO public;
EOF

echo "   ✅ Application user granted: SELECT, INSERT, UPDATE, DELETE on tables"
echo "   ✅ Application user granted: USAGE on sequences"
echo "   ✅ Application user granted: EXECUTE on functions and procedures"
echo "   ✅ Application user search_path set to public"
echo "   ⚠️  Application user CANNOT: CREATE/DROP tables, CREATE users"

# 5. Generate SSL certificates (wildcard for all subdomains)
echo "🔐 Generating SSL certificates..."
cd "${ENV_DIR}"
mkcert \
  "${DOMAIN}" \
  "*.${DOMAIN}"

# Rename for clarity
mv "${DOMAIN}+1.pem" ssl-cert.pem 2>/dev/null || mv "*.${DOMAIN}+1.pem" ssl-cert.pem
mv "${DOMAIN}+1-key.pem" ssl-key.pem 2>/dev/null || mv "*.${DOMAIN}+1-key.pem" ssl-key.pem

# 6. Generate JWT keys
echo "🔑 Generating JWT keys..."
rm -f "${ENV_DIR}/jwt-key" "${ENV_DIR}/jwt-key-public.pem"
ssh-keygen -t rsa -b 4096 -m PEM -f "${ENV_DIR}/jwt-key" -N ""
ssh-keygen -f "${ENV_DIR}/jwt-key.pub" -e -m PEM > "${ENV_DIR}/jwt-key-public.pem"

# 7. Create Ganymede .env file
echo "📝 Creating Ganymede config..."
cat > "${ENV_DIR}/.env.ganymede" <<EOF
# Environment: ${ENV_NAME}
NODE_ENV=development

WORKSPACE=${WORKSPACE_PATH}

# Database (application user with limited privileges)
PG_HOST=localhost
PG_PORT=5432
PG_USER=${APP_DB_USER}
PG_PASSWORD=${APP_DB_PASSWORD}
PG_DATABASE=${DB_NAME}

# JWT
JWT_PRIVATE_KEY="$(cat ${ENV_DIR}/jwt-key)"
JWT_PUBLIC_KEY="$(cat ${ENV_DIR}/jwt-key-public.pem)"

# OAuth Providers (configure your own)
GITHUB_CLIENT_ID=xxxxx
GITHUB_CLIENT_SECRET=xxxxx
GITLAB_CLIENT_ID=xxxxx
GITLAB_CLIENT_SECRET=xxxxx
DISCORD_CLIENT_ID=xxxxx
DISCORD_CLIENT_SECRET=xxxxx
LINKEDIN_CLIENT_ID=xxxxx
LINKEDIN_CLIENT_SECRET=xxxxx

# URLs
GANYMEDE_FQDN=ganymede.${DOMAIN}
FRONTEND_FQDN=${DOMAIN}

# Domain configuration
DOMAIN=${DOMAIN}
ENV_NAME=${ENV_NAME}

# Server binding (HTTP - nginx handles SSL termination)
# Nginx terminates SSL and proxies to Ganymede over HTTP
# X-Forwarded-Proto header indicates HTTPS to enable secure cookies
GANYMEDE_SERVER_BIND='[{"host":"127.0.0.1","port":${GANYMEDE_PORT}}]'
ALLOWED_ORIGINS='["https://${DOMAIN}"]'

# PowerDNS configuration
POWERDNS_API_URL=http://localhost:8081
POWERDNS_API_KEY=local-dev-api-key

# Magic link email (optional)
MAILING_HOST=xxxxx
MAILING_PORT=xxxxx
MAILING_USER=xxxxx
MAILING_PASSWORD=xxxxx
MAILING_FROM=xxxxx

# Session secret
SESSION_COOKIE_KEY=$(openssl rand -hex 32)

# OpenTelemetry / Observability (OTLP Collector)
# These endpoints are shared across all environments
#
# Why 172.17.0.1 instead of localhost?
# ------------------------------------
# Ganymede runs inside a dev container. The OTLP Collector runs on the Docker host
# and exposes ports 4317 (gRPC) and 4318 (HTTP) to the host via 0.0.0.0:<port>.
#
# From inside the dev container:
#   - localhost = the container itself (OTLP is NOT inside the dev container) ❌
#   - 172.17.0.1 = Docker bridge gateway (reaches the Docker host) ✅
#
# 172.17.0.1 is the standard Docker bridge network gateway IP. It allows containers
# to reach services exposed on the Docker host. This IP is consistent across Docker
# installations and won't change unless you manually reconfigure Docker's bridge network.
#
# Verified by: docker network inspect bridge | jq '.[0].IPAM.Config[0].Gateway'
OTLP_ENDPOINT_HTTP=http://172.17.0.1:4318
OTLP_ENDPOINT_GRPC=http://172.17.0.1:4317
# Service name for this environment (used in traces/logs)
OTEL_SERVICE_NAME=ganymede-${ENV_NAME}
# Deployment environment (used for filtering in Grafana)
OTEL_DEPLOYMENT_ENVIRONMENT=${ENV_NAME}
EOF

# 8. Create Nginx server blocks (Stage 1 - Main nginx with SSL termination)
echo "🌐 Creating Nginx configuration (Stage 1)..."
echo "   NOTE: Gateway-specific configs will be added dynamically by Ganymede"
sudo tee "/etc/nginx/sites-available/${ENV_NAME}" > /dev/null <<EOF
# Frontend
server {
    listen 443 ssl;
    server_name ${DOMAIN};

    ssl_certificate ${ENV_DIR}/ssl-cert.pem;
    ssl_certificate_key ${ENV_DIR}/ssl-key.pem;

    root ${WORKSPACE_PATH}/packages/app-frontend/dist;
    index index.html;

    location / {
        try_files \$uri /index.html;
    }

    location ~* \.(js|css|html|svg|ttf|woff|woff2)$ {
        expires max;
        add_header Cache-Control public;
    }

    access_log ${LOGS_DIR}/frontend-access.log;
    error_log ${LOGS_DIR}/frontend-error.log;
}

# Ganymede API
server {
    listen 443 ssl;
    server_name ganymede.${DOMAIN};

    ssl_certificate ${ENV_DIR}/ssl-cert.pem;
    ssl_certificate_key ${ENV_DIR}/ssl-key.pem;

    location / {
        proxy_pass http://127.0.0.1:${GANYMEDE_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    access_log ${LOGS_DIR}/ganymede-access.log;
    error_log ${LOGS_DIR}/ganymede-error.log;
}

# Dynamic gateway configs will be included here
include ${ENV_DIR}/nginx-gateways.d/*.conf;

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name ${DOMAIN} *.${DOMAIN};
    return 301 https://\$server_name\$request_uri;
}
EOF

# Create directory for dynamic gateway nginx configs
mkdir -p "${ENV_DIR}/nginx-gateways.d"
sudo chmod 755 "${ENV_DIR}/nginx-gateways.d"

# Enable site
sudo ln -sf "/etc/nginx/sites-available/${ENV_NAME}" "/etc/nginx/sites-enabled/${ENV_NAME}"

# 9. Test and reload Nginx
sudo nginx -t
sudo service nginx reload

# 10. Register services in PowerDNS
echo "🌐 Setting up DNS zone and registering services..."

# Get container IP
DEV_CONTAINER_IP="127.0.0.1"

# Check if PowerDNS is running
if ! curl -s -f "http://localhost:8081/api/v1/servers" -H "X-API-Key: local-dev-api-key" > /dev/null 2>&1; then
    echo "❌ PowerDNS API not responding. Did you run setup-powerdns.sh?"
    exit 1
fi

# Create DNS zone for this domain (if it doesn't exist)
echo "   Creating DNS zone: ${DOMAIN}"
ZONE_EXISTS=$(curl -s "http://localhost:8081/api/v1/servers/localhost/zones/${DOMAIN}." \
    -H "X-API-Key: local-dev-api-key" 2>/dev/null | grep -c "\"name\":\"${DOMAIN}\"" || true)

if [ "$ZONE_EXISTS" -eq 0 ]; then
    curl -X POST "http://localhost:8081/api/v1/servers/localhost/zones" \
      -H "X-API-Key: local-dev-api-key" \
      -H "Content-Type: application/json" \
      -d "{
        \"name\": \"${DOMAIN}.\",
        \"kind\": \"Native\",
        \"nameservers\": [\"ns1.${DOMAIN}.\"]
      }" > /dev/null 2>&1

    if [ $? -ne 0 ]; then
        echo "❌ Failed to create DNS zone"
        exit 1
    fi
    
    echo "   ✅ DNS zone '${DOMAIN}' created"
else
    echo "   ✅ DNS zone '${DOMAIN}' already exists"
fi

# Register main domain (frontend)
echo "   Registering ${DOMAIN} → ${DEV_CONTAINER_IP}"
curl -X PATCH "http://localhost:8081/api/v1/servers/localhost/zones/${DOMAIN}." \
  -H "X-API-Key: local-dev-api-key" \
  -H "Content-Type: application/json" \
  -d "{
    \"rrsets\": [{
      \"name\": \"${DOMAIN}.\",
      \"type\": \"A\",
      \"changetype\": \"REPLACE\",
      \"ttl\": 60,
      \"records\": [{\"content\": \"${DEV_CONTAINER_IP}\", \"disabled\": false}]
    }]
  }" > /dev/null 2>&1

# Register Ganymede
echo "   Registering ganymede.${DOMAIN} → ${DEV_CONTAINER_IP}"
curl -X PATCH "http://localhost:8081/api/v1/servers/localhost/zones/${DOMAIN}." \
  -H "X-API-Key: local-dev-api-key" \
  -H "Content-Type: application/json" \
  -d "{
    \"rrsets\": [{
      \"name\": \"ganymede.${DOMAIN}.\",
      \"type\": \"A\",
      \"changetype\": \"REPLACE\",
      \"ttl\": 60,
      \"records\": [{\"content\": \"${DEV_CONTAINER_IP}\", \"disabled\": false}]
    }]
  }" > /dev/null 2>&1

# Register wildcard for all subdomains (will handle org-{uuid}.domain.com)
echo "   Registering *.${DOMAIN} → ${DEV_CONTAINER_IP}"
curl -X PATCH "http://localhost:8081/api/v1/servers/localhost/zones/${DOMAIN}." \
  -H "X-API-Key: local-dev-api-key" \
  -H "Content-Type: application/json" \
  -d "{
    \"rrsets\": [{
      \"name\": \"*.${DOMAIN}.\",
      \"type\": \"A\",
      \"changetype\": \"REPLACE\",
      \"ttl\": 60,
      \"records\": [{\"content\": \"${DEV_CONTAINER_IP}\", \"disabled\": false}]
    }]
  }" > /dev/null 2>&1

echo "   ✅ DNS records registered in PowerDNS"

# 11. Update CoreDNS configuration to include this domain
echo "🌐 Updating CoreDNS configuration..."
"${WORKSPACE_PATH}/scripts/local-dev/update-coredns.sh" || {
    echo "   ⚠️  Failed to update CoreDNS. You may need to run ./update-coredns.sh manually."
}

# 12. Create gateway pool
echo "📦 Creating gateway pool (${GATEWAY_POOL_SIZE} gateways)..."

# Create org-data directory for centralized data storage
mkdir -p "${ENV_DIR}/org-data"
chmod 755 "${ENV_DIR}/org-data"

# Run gateway-pool.sh script with environment variables
# Gateways fetch their build via HTTP (no workspace mount needed)
ENV_NAME="${ENV_NAME}" DOMAIN="${DOMAIN}" \
  "${WORKSPACE_PATH}/scripts/local-dev/gateway-pool.sh" create ${GATEWAY_POOL_SIZE} "${WORKSPACE_PATH}"

# 13. Environment ready!
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ✅ Environment ${ENV_NAME} ready!                           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "📂 Location: ${ENV_DIR}"
echo "🗄️  Database: ${DB_NAME}"
echo "👤 App User: ${APP_DB_USER} (credentials in .env.ganymede)"
echo "🌐 Domain: ${DOMAIN}"
echo "📦 Gateway Pool: ${GATEWAY_POOL_SIZE} gateways ready"
echo ""
echo "🔑 Database Admin Credentials (for manual operations):"
echo "   User: postgres"
echo "   Password: devpassword"
echo "   Connect: PGPASSWORD=devpassword psql -U postgres -h localhost -d ${DB_NAME}"
echo ""
echo "📋 Next steps:"
echo ""
echo "1. 🌐 Start build server (if not running):"
echo "      ./serve-builds.sh &"
echo ""
echo "2. 🔨 Build all applications:"
echo "      ./envctl.sh build ${ENV_NAME} all"
echo "      (This builds ganymede, gateway, frontend + validates & packs)"
echo ""
echo "3. 🚀 Start the environment:"
echo "      ./envctl.sh start ${ENV_NAME}"
echo ""
echo "4. 🌐 Access from host OS browser (after DNS setup):"
echo "      https://${DOMAIN}"
echo "      https://ganymede.${DOMAIN}"
echo ""
echo "   ⚠️  ONE-TIME: Configure host OS DNS"
echo "   See: doc/guides/DNS_COMPLETE_GUIDE.md"
echo ""
echo "5. 🔄 After code changes:"
echo "      ./envctl.sh build ${ENV_NAME} gateway  (or 'all' for everything)"
echo "      ./envctl.sh restart ${ENV_NAME} gateway"
echo ""
echo "📊 Management:"
echo "   Logs: ./envctl.sh logs ${ENV_NAME} ganymede"
echo "   Stop: ./envctl.sh stop ${ENV_NAME}"
echo ""

