#!/bin/bash
# Build frontend for a specific environment
# Usage: ./build-frontend.sh dev-001 [workspace-path]

set -e

ENV_NAME=$1
WORKSPACE_PATH=${2:-"/root/workspace/monorepo"}

if [ -z "$ENV_NAME" ]; then
  echo "Usage: $0 <env-name> [workspace-path]"
  echo "Example: $0 dev-001"
  echo "Example: $0 feat-xyz /root/workspace-feat"
  exit 1
fi

ENV_DIR="/root/.local-dev/${ENV_NAME}"

if [ ! -d "$ENV_DIR" ]; then
  echo "❌ Environment '${ENV_NAME}' not found"
  echo "   Create it first: ./create-env.sh ${ENV_NAME}"
  exit 1
fi

# Read domain from environment configuration
ENV_FILE="${ENV_DIR}/.env.ganymede"
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Environment config not found: $ENV_FILE"
  exit 1
fi

DOMAIN=$(grep "^DOMAIN=" "$ENV_FILE" | cut -d= -f2 | tr -d '"' || echo "")
if [ -z "$DOMAIN" ]; then
  echo "❌ DOMAIN not found in $ENV_FILE"
  exit 1
fi

if [ ! -d "$WORKSPACE_PATH" ]; then
  echo "❌ Workspace path not found: $WORKSPACE_PATH"
  exit 1
fi

cd "${WORKSPACE_PATH}"

echo "🏗️  Building frontend for ${ENV_NAME}..."
echo "   Domain: ${DOMAIN}"

# Create .env for frontend build
cat > packages/app-frontend/.env <<EOF
VITE_ENVIRONMENT=${ENV_NAME}
VITE_DOMAIN_NAME=${DOMAIN}
VITE_GANYMEDE_URL=https://ganymede.${DOMAIN}

# OpenTelemetry / Observability
# Browser SDK will use localhost (OTLP collector exposed on host)
VITE_OTLP_ENDPOINT_HTTP=http://localhost:4318
EOF

# Build
npx nx run app-frontend:build

echo ""
echo "✅ Frontend built for ${ENV_NAME}"
echo "   Output: packages/app-frontend/dist/"
echo "   Served by Nginx at: https://${DOMAIN}"
echo ""
echo "💡 Restart Nginx to pick up changes:"
echo "   sudo service nginx reload"
echo ""

