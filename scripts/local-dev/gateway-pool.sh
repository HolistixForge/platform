#!/bin/bash
# Gateway pool management
# Usage: ./gateway-pool.sh [create] <count> <workspace-path>
# Example: ./gateway-pool.sh 3 /root/workspace/monorepo
# Example: ./gateway-pool.sh create 3 /root/workspace-feat/monorepo
# 
# Always uses bind mount to mount the repository directory.
# The workspace-path must point to the monorepo root directory.

set -e

# Parse arguments - support both "create <count> <path>" and "<count> <path>" formats
if [ "$1" = "create" ]; then
  COUNT=$2
  WORKSPACE_PATH=$3
else
  COUNT=$1
  WORKSPACE_PATH=$2
fi

# Configuration (can be overridden by environment variables)
ENV_NAME=${ENV_NAME:-"dev-001"}
DOMAIN=${DOMAIN:-"domain.local"}
WORKSPACE_MOUNT=${WORKSPACE_MOUNT:-"/home/dev/workspace"}

# Colors for output (define early for error messages)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Validate WORKSPACE_PATH is provided
if [ -z "$WORKSPACE_PATH" ]; then
  echo -e "${RED}❌ WORKSPACE_PATH is required${NC}"
  echo ""
  echo "Usage: $0 [create] <count> <workspace-path>"
  echo "   create: Optional command (for compatibility)"
  echo "   count: Number of gateways to create (e.g., 3)"
  echo "   workspace-path: Path to monorepo root directory (required)"
  echo ""
  echo "Examples:"
  echo "   $0 3 /root/workspace/monorepo"
  echo "   $0 create 3 /root/workspace-feat/monorepo"
  exit 1
fi

# Validate WORKSPACE_PATH exists
if [ ! -d "$WORKSPACE_PATH" ]; then
  echo -e "${RED}❌ Workspace path not found: ${WORKSPACE_PATH}${NC}"
  exit 1
fi

# Get parent directory of monorepo (e.g., /root/workspace-feat from /root/workspace-feat/monorepo)
# Mount parent directory so gateway can access: ${WORKSPACE_MOUNT}/monorepo
WORKSPACE_PARENT=$(dirname "$WORKSPACE_PATH")
if [ ! -d "$WORKSPACE_PARENT" ]; then
  echo -e "${RED}❌ Workspace parent directory not found: ${WORKSPACE_PARENT}${NC}"
  exit 1
fi

BIND_MOUNT_SOURCE="$WORKSPACE_PARENT"

# Directories
ENV_DIR="/root/.local-dev/${ENV_NAME}"

# Validate Docker is available
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker not found. Is Docker socket mounted?${NC}"
        echo "   Run: apt-get install -y docker.io"
        exit 1
    fi
}

# Validate count
if [ -z "$COUNT" ] || ! [[ "$COUNT" =~ ^[0-9]+$ ]]; then
  echo -e "${RED}❌ Invalid count: ${COUNT}${NC}"
  echo ""
  echo "Usage: $0 [create] <count> <workspace-path>"
  echo "   count: Number of gateways to create (e.g., 3)"
  echo "   workspace-path: Path to monorepo root directory (required)"
  exit 1
fi

check_docker

# Load Ganymede env to get database connection for app-ganymede-cmd
if [ ! -f "${ENV_DIR}/.env.ganymede" ]; then
    echo -e "${RED}❌ Ganymede .env file not found: ${ENV_DIR}/.env.ganymede${NC}"
    echo "   Run create-env.sh first"
    exit 1
fi

set -a
source "${ENV_DIR}/.env.ganymede"
set +a

# Build app-ganymede-cmds if not already built
if [ ! -f "${WORKSPACE_PATH}/dist/packages/app-ganymede-cmds/main.js" ]; then
    echo "📦 Building app-ganymede-cmds..."
    cd "${WORKSPACE_PATH}"
    npx nx run app-ganymede-cmds:build > /dev/null 2>&1
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to build app-ganymede-cmds${NC}"
        exit 1
    fi
fi

echo -e "${BLUE}📦 Creating $COUNT gateways in pool...${NC}"
echo "   Environment: ${ENV_NAME}"
echo "   Domain: ${DOMAIN}"
echo "   Workspace: ${WORKSPACE_PATH} (bind mount: ${BIND_MOUNT_SOURCE})"
echo ""

for i in $(seq 1 $COUNT); do
  # Calculate ports based on ALL existing gateway containers (across all environments)
  # to avoid port conflicts between different environments
  GATEWAY_COUNT=$(docker ps -a --filter "name=gw-pool-" --format "{{.Names}}" | wc -l)
  GW_HTTP_PORT=$((7100 + GATEWAY_COUNT))
  GW_VPN_PORT=$((49100 + GATEWAY_COUNT))
  
  GATEWAY_NAME="gw-pool-${ENV_NAME}-${GATEWAY_COUNT}"
  GATEWAY_VERSION="0.0.1"
  
  echo -e "${BLUE}  Creating ${GATEWAY_NAME}...${NC}"
  
  # Register gateway in database and get token
  echo "     Registering in database..."
  echo "     Gateway: ${GATEWAY_NAME}, HTTP: ${GW_HTTP_PORT}, VPN: ${GW_VPN_PORT}"
  set +e
  REGISTER_OUTPUT=$(LOG_LEVEL=6 \
    node "${WORKSPACE_PATH}/dist/packages/app-ganymede-cmds/main.js" add-gateway \
      -gv "${GATEWAY_VERSION}" \
      -c "${GATEWAY_NAME}" \
      -hp "${GW_HTTP_PORT}" \
      -vp "${GW_VPN_PORT}" 2>&1)
  REGISTER_EXIT_CODE=$?
  set -e
  
  if [ $REGISTER_EXIT_CODE -ne 0 ]; then
    echo -e "${RED}  ❌ Failed to register gateway in database${NC}"
    echo "$REGISTER_OUTPUT"
    exit 1
  fi
  
  # Extract gateway_id and token from output
  GATEWAY_ID=$(echo "$REGISTER_OUTPUT" | grep 'gateway_id:' | grep -oP '[a-f0-9-]{36}' | head -1)
  GATEWAY_TOKEN=$(echo "$REGISTER_OUTPUT" | grep '^token:' | awk '{print $2}')
  
  if [ -z "$GATEWAY_ID" ] || [ -z "$GATEWAY_TOKEN" ]; then
    echo -e "${RED}  ❌ Failed to extract gateway credentials${NC}"
    echo "$REGISTER_OUTPUT"
    exit 1
  fi
  
  echo "     Gateway ID: ${GATEWAY_ID}"
  
  # No workspace mount needed!
  # Gateway fetches its build from HTTP server on startup
  echo -e "${GREEN}   ✓ Gateway will fetch build from HTTP server${NC}"
  
  # Get build server IP (dev container IP on bridge network)
  BUILD_SERVER_IP=$(hostname -I | awk '{print $1}')
  
  # Start gateway container
  # Gateway fetches its build from HTTP server on dev container
  # No workspace mount needed - production-like deployment
  # State is managed in PostgreSQL (gateways.ready, organizations_gateways)
  # No SSL - all SSL termination in stage 1 nginx  
  # No org-specific data - data stored in Ganymede
  docker run -d \
    --name "${GATEWAY_NAME}" \
    --label "environment=${ENV_NAME}" \
    --label "gateway_id=${GATEWAY_ID}" \
    --network bridge \
    -p ${GW_HTTP_PORT}:${GW_HTTP_PORT} \
    -p ${GW_VPN_PORT}:${GW_VPN_PORT}/udp \
    --cap-add=NET_ADMIN \
    --device /dev/net/tun \
    -e ENV_NAME="${ENV_NAME}" \
    -e GATEWAY_ID="${GATEWAY_ID}" \
    -e GATEWAY_TOKEN="${GATEWAY_TOKEN}" \
    -e GATEWAY_HTTP_PORT="${GW_HTTP_PORT}" \
    -e GATEWAY_VPN_PORT="${GW_VPN_PORT}" \
    -e GANYMEDE_FQDN="ganymede.${DOMAIN}" \
    -e DOMAIN="${DOMAIN}" \
    -e BUILD_SERVER_IP="${BUILD_SERVER_IP}" \
    gateway:latest > /dev/null
  
  if [ $? -ne 0 ]; then
    echo -e "${RED}  ❌ Failed to create ${GATEWAY_NAME}${NC}"
    exit 1
  fi
  
  echo -e "${GREEN}  ✅ Created ${GATEWAY_NAME} (HTTP: ${GW_HTTP_PORT}, VPN: ${GW_VPN_PORT})${NC}"
done

echo ""
echo -e "${GREEN}🎉 Gateway pool created successfully!${NC}"
echo ""

# Show status
TOTAL=$(docker ps -a --filter "name=gw-pool-${ENV_NAME}-" --filter "label=environment=${ENV_NAME}" --format "{{.Names}}" | wc -l)
RUNNING=$(docker ps --filter "name=gw-pool-${ENV_NAME}-" --filter "label=environment=${ENV_NAME}" --format "{{.Names}}" | wc -l)

echo -e "${BLUE}Gateway Pool Status:${NC}"
echo "  Environment: ${ENV_NAME}"
echo "  Total: ${TOTAL}"
echo "  Running: ${GREEN}${RUNNING}${NC}"

if [ $RUNNING -ne $TOTAL ] && [ $TOTAL -gt 0 ]; then
  echo ""
  echo -e "${YELLOW}⚠️  Warning: Some gateway containers are not running!${NC}"
  echo "   Expected: ${TOTAL}, Running: ${RUNNING}"
fi

echo ""
echo "📊 View gateways:"
echo "   docker ps --filter label=environment=${ENV_NAME}"
echo ""
echo "📋 Gateway allocation managed in PostgreSQL:"
echo "   SELECT * FROM gateways;"
echo "   SELECT * FROM organizations_gateways;"


