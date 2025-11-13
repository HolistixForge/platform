#!/bin/bash
# Gateway pool management
# Usage: ./gateway-pool.sh <count> <workspace-path>
# Example: ./gateway-pool.sh 3 /root/workspace/monorepo

set -e

COUNT=$1
WORKSPACE_PATH=${2:-"/root/workspace/monorepo"}

# Configuration (can be overridden by environment variables)
ENV_NAME=${ENV_NAME:-"dev-001"}
DOMAIN=${DOMAIN:-"domain.local"}
WORKSPACE_VOLUME=${WORKSPACE_VOLUME:-"demiurge-workspace"}

# Directories
ENV_DIR="/root/.local-dev/${ENV_NAME}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Validate Docker is available
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker not found. Is Docker socket mounted?${NC}"
        echo "   Run: apt-get install -y docker.io"
        exit 1
    fi
}

# Create gateway pool
if [ -z "$COUNT" ] || ! [[ "$COUNT" =~ ^[0-9]+$ ]]; then
  echo -e "${RED}Usage: $0 <count> [workspace-path]${NC}"
  echo "   count: Number of gateways to create (e.g., 3)"
  echo "   workspace-path: Path to monorepo (default: /root/workspace/monorepo)"
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
echo "   Workspace volume: ${WORKSPACE_VOLUME}"
echo ""

for i in $(seq 1 $COUNT); do
  # Calculate ports based on existing gateway count
  GATEWAY_COUNT=$(docker ps -a --filter "name=gw-pool-" --filter "label=environment=${ENV_NAME}" --format "{{.Names}}" | wc -l)
  GW_HTTP_PORT=$((7100 + GATEWAY_COUNT))
  GW_VPN_PORT=$((49100 + GATEWAY_COUNT))
  
  GATEWAY_NAME="gw-pool-${GATEWAY_COUNT}"
  GATEWAY_HOSTNAME="gw-pool-${GATEWAY_COUNT}.${DOMAIN}"
  GATEWAY_VERSION="0.0.1"
  
  echo -e "${BLUE}  Creating ${GATEWAY_NAME}...${NC}"
  
  # Register gateway in database and get token
  echo "     Registering in database..."
  set +e
  REGISTER_OUTPUT=$(LOG_LEVEL=6 \
    node "${WORKSPACE_PATH}/dist/packages/app-ganymede-cmds/main.js" add-gateway \
      -h "${GATEWAY_HOSTNAME}" \
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
  
  # Start gateway container
  # State is managed in PostgreSQL (gateways.ready, organizations_gateways)
  # No SSL - all SSL termination in stage 1 nginx
  # No org-specific data - data stored in Ganymede
  docker run -d \
    --name "${GATEWAY_NAME}" \
    --label "environment=${ENV_NAME}" \
    --label "gateway_id=${GATEWAY_ID}" \
    --network bridge \
    -v ${WORKSPACE_VOLUME}:/home/dev/workspace \
    -p ${GW_HTTP_PORT}:${GW_HTTP_PORT} \
    -p ${GW_VPN_PORT}:${GW_VPN_PORT}/udp \
    --cap-add=NET_ADMIN \
    --device /dev/net/tun \
    -e ENVIRONMENT_NAME="${ENV_NAME}" \
    -e GATEWAY_ID="${GATEWAY_ID}" \
    -e GATEWAY_HOSTNAME="${GATEWAY_HOSTNAME}" \
    -e GATEWAY_TOKEN="${GATEWAY_TOKEN}" \
    -e GATEWAY_HTTP_PORT="${GW_HTTP_PORT}" \
    -e GATEWAY_VPN_PORT="${GW_VPN_PORT}" \
    -e GANYMEDE_FQDN="ganymede.${DOMAIN}" \
    -e DOMAIN="${DOMAIN}" \
    -e WORKSPACE="/home/dev/workspace" \
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
TOTAL=$(docker ps -a --filter "name=gw-pool-" --filter "label=environment=${ENV_NAME}" --format "{{.Names}}" | wc -l)
RUNNING=$(docker ps --filter "name=gw-pool-" --filter "label=environment=${ENV_NAME}" --format "{{.Names}}" | wc -l)

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


