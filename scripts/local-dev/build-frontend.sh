#!/bin/bash
# Build frontend for a specific environment
# Usage: ./build-frontend.sh dev-001 [workspace-path]

set -e

ENV_NAME=$1
# The Linux default first, and only fall back to this checkout when it is not
# there — a dev container has both, and picking the wrong one would build the
# frontend from a different tree than the one being served.
DEFAULT_WORKSPACE="/root/workspace/monorepo"
[ -d "$DEFAULT_WORKSPACE" ] || \
  DEFAULT_WORKSPACE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKSPACE_PATH=${2:-"$DEFAULT_WORKSPACE"}

if [ -z "$ENV_NAME" ]; then
  echo "Usage: $0 <env-name> [workspace-path]"
  echo "Example: $0 dev-001"
  echo "Example: $0 feat-xyz /root/workspace-feat"
  exit 1
fi

# Two layouts, because there are two ways to stand an environment up and both
# are current: create-env.sh writes .env.ganymede under /root/.local-dev, the
# macOS harness writes ganymede.env under ~/.holistix-macos. The Linux pair is
# tried first, so nothing changes there.
ENV_FILE=""
for candidate in \
  "/root/.local-dev/${ENV_NAME}/.env.ganymede" \
  "${HOME}/.holistix-macos/${ENV_NAME}/ganymede.env"; do
  [ -f "$candidate" ] && { ENV_FILE="$candidate"; break; }
done

if [ -z "$ENV_FILE" ]; then
  echo "❌ Environment '${ENV_NAME}' not found"
  echo "   Looked for:"
  echo "     /root/.local-dev/${ENV_NAME}/.env.ganymede   (Linux)"
  echo "     ${HOME}/.holistix-macos/${ENV_NAME}/ganymede.env   (macOS)"
  echo "   Create it first: ./create-env.sh ${ENV_NAME}"
  echo "                or: ./macos/ganymede-apple.sh up"
  exit 1
fi
ENV_DIR="$(dirname "$ENV_FILE")"

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

# Build frontend
echo "🔨 Building frontend..."
npx nx run app-frontend:build

echo ""
echo "✅ Frontend built for ${ENV_NAME}"
echo "   Output: packages/app-frontend/dist/"
echo "   Served by Nginx at: https://${DOMAIN}"
echo ""
echo "💡 Reload nginx to pick up changes:"
echo "   sudo service nginx reload    # Linux"
echo "   nginx -s reload              # macOS, Homebrew, no sudo"
echo ""

