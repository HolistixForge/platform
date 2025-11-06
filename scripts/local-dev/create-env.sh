#!/bin/bash
# Create a new local development environment
# Usage: ./create-env.sh dev-001 [workspace-path] [database-path]
# Usage: ./create-env.sh dev-002
# Usage: ./create-env.sh feat-my-feature /root/workspace-feat /root/database-feat

set -e

ENV_NAME=$1
WORKSPACE_PATH=${2:-"/root/workspace/monorepo"}
DATABASE_PATH=${3:-"/root/workspace/database"}

if [ -z "$ENV_NAME" ]; then
  echo "Usage: $0 <env-name> [workspace-path] [database-path]"
  echo "Example: $0 dev-001"
  echo "Example: $0 feat-xyz /root/workspace-feat /root/database-feat"
  exit 1
fi

# Validate paths exist
if [ ! -d "$WORKSPACE_PATH" ]; then
  echo "❌ Workspace path not found: $WORKSPACE_PATH"
  exit 1
fi

if [ ! -d "$DATABASE_PATH" ]; then
  echo "❌ Database path not found: $DATABASE_PATH"
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
echo "   Workspace: ${WORKSPACE_PATH}"
echo "   Database repo: ${DATABASE_PATH}"
echo "   Database: ${DB_NAME}"
echo "   Ganymede port: ${GANYMEDE_PORT}"
echo "   Gateway port: ${GATEWAY_PORT}"
echo ""

# 1. Create directory structure
mkdir -p "${ENV_DIR}"
mkdir -p "${DATA_DIR}"
mkdir -p "${LOGS_DIR}"

# 2. Create database
echo "🐘 Creating database..."
PGPASSWORD=devpassword psql -U postgres -h localhost -c "CREATE DATABASE ${DB_NAME};" 2>/dev/null || echo "   Database already exists"

# 3. Deploy database schema
echo "📊 Deploying database schema..."
cd "${DATABASE_PATH}"
PGPASSWORD=devpassword ./run.sh schema "${DB_NAME}"
PGPASSWORD=devpassword ./run.sh procedures "${DB_NAME}"
PGPASSWORD=devpassword ./run.sh triggers "${DB_NAME}"

# 4. Generate SSL certificates
echo "🔐 Generating SSL certificates..."
cd "${ENV_DIR}"
mkcert \
  "${ENV_NAME}.local" \
  "ganymede.${ENV_NAME}.local" \
  "gateway.${ENV_NAME}.local" \
  "*.gateway.${ENV_NAME}.local"

# Rename for clarity
mv "${ENV_NAME}.local+3.pem" ssl-cert.pem
mv "${ENV_NAME}.local+3-key.pem" ssl-key.pem

# 5. Generate JWT keys
echo "🔑 Generating JWT keys..."
ssh-keygen -t rsa -b 4096 -m PEM -f "${ENV_DIR}/jwt-key" -N ""
ssh-keygen -f "${ENV_DIR}/jwt-key.pub" -e -m PEM > "${ENV_DIR}/jwt-key-public.pem"

# 6. Create Ganymede .env file
echo "📝 Creating Ganymede config..."
cat > "${ENV_DIR}/.env.ganymede" <<EOF
# Environment: ${ENV_NAME}
NODE_ENV=development
PORT=${GANYMEDE_PORT}

# Database
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=devpassword
PG_DATABASE=${DB_NAME}

# JWT
JWT_PRIVATE_KEY_FILE=${ENV_DIR}/jwt-key
JWT_PUBLIC_KEY_FILE=${ENV_DIR}/jwt-key-public.pem

# OAuth Providers (configure your own)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITLAB_CLIENT_ID=
GITLAB_CLIENT_SECRET=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=

# URLs (no GATEWAY_FQDN - gateways register themselves dynamically!)
APP_GANYMEDE_URL=https://ganymede.${ENV_NAME}.local
FRONTEND_URL=https://${ENV_NAME}.local

# Workspace location
WORKSPACE=${WORKSPACE_PATH}

# Server binding
SERVER_BIND='[{"host":"127.0.0.1","port":${GANYMEDE_PORT}}]'

# Magic link email (optional)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=

# Session secret
SESSION_SECRET=$(openssl rand -hex 32)

# Jaeger (optional)
# JAEGER_FQDN=
EOF

# 7. Register gateway with Ganymede (using app-ganymede-cmd)
echo "🔧 Registering gateway with Ganymede..."
cd "${WORKSPACE_PATH}"

# Build app-ganymede-cmds if needed
if [ ! -f "${WORKSPACE_PATH}/dist/packages/app-ganymede-cmds/main.js" ]; then
  npx nx run app-ganymede-cmds:build > /dev/null 2>&1
fi

# Load Ganymede env to get database connection
source "${ENV_DIR}/.env.ganymede"

# Register gateway and capture output
GATEWAY_HOSTNAME="gateway.${ENV_NAME}.local"
GATEWAY_VERSION="0.0.1"

REGISTER_OUTPUT=$(JWT_PRIVATE_KEY_FILE="${JWT_PRIVATE_KEY_FILE}" \
  JWT_PUBLIC_KEY_FILE="${JWT_PUBLIC_KEY_FILE}" \
  PG_HOST="${PG_HOST}" \
  PG_PORT="${PG_PORT}" \
  PG_USER="${PG_USER}" \
  PG_PASSWORD="${PG_PASSWORD}" \
  PG_DATABASE="${PG_DATABASE}" \
  LOG_LEVEL=6 \
  node "${WORKSPACE_PATH}/dist/packages/app-ganymede-cmds/main.js" add-gateway \
    -h "${GATEWAY_HOSTNAME}" \
    -gv "${GATEWAY_VERSION}" 2>&1)

# Extract gateway_id and token from output
GATEWAY_ID=$(echo "$REGISTER_OUTPUT" | grep -oP 'gateway_id.*:\s*\K[a-f0-9-]+' | head -1)
GATEWAY_TOKEN=$(echo "$REGISTER_OUTPUT" | grep -oP 'token:\s*\K[^\s]+' | head -1)

if [ -z "$GATEWAY_ID" ] || [ -z "$GATEWAY_TOKEN" ]; then
  echo "❌ Failed to register gateway. Output:"
  echo "$REGISTER_OUTPUT"
  exit 1
fi

echo "   Gateway ID: ${GATEWAY_ID}"
echo "   Token saved to .env.gateway"

# 8. Create Gateway .env file
echo "📝 Creating Gateway config..."
cat > "${ENV_DIR}/.env.gateway" <<EOF
# Environment: ${ENV_NAME}
NODE_ENV=development
PORT=${GATEWAY_PORT}

# Gateway identification (registered via app-ganymede-cmd)
GATEWAY_ID=${GATEWAY_ID}
GATEWAY_HOSTNAME=${GATEWAY_HOSTNAME}
GATEWAY_TOKEN=${GATEWAY_TOKEN}
GATEWAY_HMAC_SECRET=$(openssl rand -hex 32)

# Ganymede connection
GANYMEDE_FQDN=ganymede.${ENV_NAME}.local

# Server binding
SERVER_BIND='[{"host":"127.0.0.1","port":${GATEWAY_PORT}}]'

# Data storage
DATA_DIR=${DATA_DIR}

# Workspace location
WORKSPACE=${WORKSPACE_PATH}

# Jaeger (optional)
# JAEGER_FQDN=
EOF

# 9. Create Nginx server blocks
echo "🌐 Creating Nginx configuration..."
sudo tee "/etc/nginx/sites-available/${ENV_NAME}" > /dev/null <<EOF
# Frontend
server {
    listen 443 ssl;
    server_name ${ENV_NAME}.local;

    ssl_certificate ${ENV_DIR}/ssl-cert.pem;
    ssl_certificate_key ${ENV_DIR}/ssl-key.pem;

    root ${WORKSPACE_PATH}/dist/packages/app-frontend;
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
    server_name ganymede.${ENV_NAME}.local;

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
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    access_log ${LOGS_DIR}/ganymede-access.log;
    error_log ${LOGS_DIR}/ganymede-error.log;
}

# Gateway (Collab)
server {
    listen 443 ssl;
    server_name gateway.${ENV_NAME}.local *.gateway.${ENV_NAME}.local;

    ssl_certificate ${ENV_DIR}/ssl-cert.pem;
    ssl_certificate_key ${ENV_DIR}/ssl-key.pem;

    location / {
        proxy_pass http://127.0.0.1:${GATEWAY_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # WebSocket support
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    access_log ${LOGS_DIR}/gateway-access.log;
    error_log ${LOGS_DIR}/gateway-error.log;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name ${ENV_NAME}.local ganymede.${ENV_NAME}.local gateway.${ENV_NAME}.local *.gateway.${ENV_NAME}.local;
    return 301 https://\$server_name\$request_uri;
}
EOF

# Enable site
sudo ln -sf "/etc/nginx/sites-available/${ENV_NAME}" "/etc/nginx/sites-enabled/${ENV_NAME}"

# 10. Test and reload Nginx
sudo nginx -t
sudo service nginx reload

# 11. Create helper scripts
cat > "${ENV_DIR}/start.sh" <<SCRIPT_EOF
#!/bin/bash
set -e

ENV_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Starting environment: \$(basename \${ENV_DIR})..."

# Load environment to get WORKSPACE path
source "\${ENV_DIR}/.env.ganymede"

# Build apps (if needed)
cd "\${WORKSPACE}"
echo "🔨 Building apps..."
npx nx run app-ganymede:build
npx nx run app-collab:build

# Load Ganymede environment
source "${ENV_DIR}/.env.ganymede"

# Start Ganymede
echo "▶️  Starting Ganymede on port ${PORT}..."
cd "${WORKSPACE}"
NODE_ENV=development \
  node "${WORKSPACE}/dist/packages/app-ganymede/main.js" \
  > "${ENV_DIR}/logs/ganymede.log" 2>&1 &
echo $! > "${ENV_DIR}/ganymede.pid"

# Wait for Ganymede to start
sleep 3

# Load Gateway environment
source "${ENV_DIR}/.env.gateway"

# Start Gateway
echo "▶️  Starting Gateway on port ${PORT}..."
cd "${WORKSPACE}"
NODE_ENV=development \
  node "${WORKSPACE}/dist/packages/app-collab/main.js" \
  > "${ENV_DIR}/logs/gateway.log" 2>&1 &
echo $! > "${ENV_DIR}/gateway.pid"

# Get environment name from directory
ENV_NAME=$(basename "${ENV_DIR}")

echo ""
echo "✅ Environment started!"
echo "   Frontend:  https://${ENV_NAME}.local"
echo "   Ganymede:  https://ganymede.${ENV_NAME}.local"
echo "   Gateway:   https://gateway.${ENV_NAME}.local"
echo ""
echo "📋 Logs:"
echo "   ${ENV_DIR}/logs.sh ganymede"
echo "   ${ENV_DIR}/logs.sh gateway"
echo ""
echo "🛑 Stop: ${ENV_DIR}/stop.sh"
SCRIPT_EOF

chmod +x "${ENV_DIR}/start.sh"

cat > "${ENV_DIR}/stop.sh" <<SCRIPT_EOF
#!/bin/bash
set -e

ENV_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
ENV_NAME=\$(basename "\${ENV_DIR}")

echo "🛑 Stopping environment: \${ENV_NAME}..."

if [ -f "\${ENV_DIR}/ganymede.pid" ]; then
  PID=\$(cat "\${ENV_DIR}/ganymede.pid")
  if kill -0 \$PID 2>/dev/null; then
    kill \$PID 2>/dev/null || true
    echo "   Stopped Ganymede (PID: \$PID)"
  fi
  rm "\${ENV_DIR}/ganymede.pid"
fi

if [ -f "\${ENV_DIR}/gateway.pid" ]; then
  PID=\$(cat "\${ENV_DIR}/gateway.pid")
  if kill -0 \$PID 2>/dev/null; then
    kill \$PID 2>/dev/null || true
    echo "   Stopped Gateway (PID: \$PID)"
  fi
  rm "\${ENV_DIR}/gateway.pid"
fi

echo "✅ Environment stopped"
SCRIPT_EOF

chmod +x "${ENV_DIR}/stop.sh"

cat > "${ENV_DIR}/logs.sh" <<SCRIPT_EOF
#!/bin/bash
ENV_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"

case "\$1" in
  ganymede)
    tail -f "\${ENV_DIR}/logs/ganymede.log"
    ;;
  gateway)
    tail -f "\${ENV_DIR}/logs/gateway.log"
    ;;
  *)
    echo "Usage: \$0 {ganymede|gateway}"
    echo ""
    echo "Or directly:"
    echo "  tail -f \${ENV_DIR}/logs/ganymede.log"
    echo "  tail -f \${ENV_DIR}/logs/gateway.log"
    ;;
esac
SCRIPT_EOF

chmod +x "${ENV_DIR}/logs.sh"

# 12. Update /etc/hosts in dev container
echo "📝 Updating /etc/hosts..."
sudo sed -i "/# local-dev-${ENV_NAME}/d" /etc/hosts
sudo tee -a /etc/hosts > /dev/null <<EOF
# local-dev-${ENV_NAME}
127.0.0.1  ${ENV_NAME}.local ganymede.${ENV_NAME}.local gateway.${ENV_NAME}.local
EOF

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  ✅ Environment '${ENV_NAME}' created successfully!            "
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📂 Location: ${ENV_DIR}"
echo ""
echo "📋 Next steps:"
echo ""
echo "1. 🖥️  Add to host OS hosts file:"
echo ""
echo "   Windows (C:\\Windows\\System32\\drivers\\etc\\hosts as Admin):"
echo "   macOS/Linux (/etc/hosts with sudo):"
echo ""
echo "      <dev-container-ip>  ${ENV_NAME}.local"
echo "      <dev-container-ip>  ganymede.${ENV_NAME}.local"
echo "      <dev-container-ip>  gateway.${ENV_NAME}.local"
echo ""
echo "   Get dev container IP: hostname -I"
echo "   Or use helper: ./windows-add-hosts.ps1 <ip> ${ENV_NAME}"
echo ""
echo "2. ⚙️  Configure OAuth providers (optional):"
echo "      nano ${ENV_DIR}/.env.ganymede"
echo ""
echo "3. 🏗️  Build frontend:"
echo "      ./build-frontend.sh ${ENV_NAME} ${WORKSPACE_PATH}"
echo ""
echo "4. 🚀 Start the environment:"
echo "      ${ENV_DIR}/start.sh"
echo ""
echo "5. 🌐 Access from host OS browser:"
echo "      https://${ENV_NAME}.local"
echo ""
echo "6. 📊 View logs:"
echo "      ${ENV_DIR}/logs.sh ganymede"
echo "      ${ENV_DIR}/logs.sh gateway"
echo ""
echo "7. 🛑 Stop:"
echo "      ${ENV_DIR}/stop.sh"
echo ""

