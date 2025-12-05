#!/bin/bash
# Pack complete gateway build for distribution to containers
# Includes: compiled app + management scripts
# Usage: ./pack-gateway-build.sh <env-name> [workspace-path]

set -e

ENV_NAME=$1
WORKSPACE_PATH=${2:-"/root/workspace/monorepo"}

if [ -z "$ENV_NAME" ]; then
    echo "Usage: $0 <env-name> [workspace-path]"
    echo "Example: $0 dev-001"
    echo "Example: $0 dev-002 /root/workspace-feat-a/monorepo"
    exit 1
fi

# Common builds directory (all environments)
BUILDS_DIR="/root/.local-dev-builds"
OUTPUT_FILE="${BUILDS_DIR}/gateway-${ENV_NAME}.tar.gz"

# Validate workspace
if [ ! -d "${WORKSPACE_PATH}/dist/packages/app-gateway" ]; then
    echo "❌ Gateway build not found: ${WORKSPACE_PATH}/dist/packages/app-gateway"
    echo "   Run: npx nx build app-gateway"
    exit 1
fi

if [ ! -d "${WORKSPACE_PATH}/docker-images/backend-images/gateway/app" ]; then
    echo "❌ Gateway scripts not found: ${WORKSPACE_PATH}/docker-images/backend-images/gateway/app"
    exit 1
fi

# Create builds directory
mkdir -p "$BUILDS_DIR"

echo "📦 Packing gateway build for ${ENV_NAME}..."
echo "   Workspace: ${WORKSPACE_PATH}"
echo "   Output: ${OUTPUT_FILE}"
echo ""

# Create temporary directory for build assembly
TEMP_DIR=$(mktemp -d)
BUILD_ROOT="${TEMP_DIR}/gateway"

mkdir -p "${BUILD_ROOT}"

# Copy compiled application
echo "   Copying app-gateway build..."
cp -r "${WORKSPACE_PATH}/dist/packages/app-gateway" "${BUILD_ROOT}/"

# Copy management scripts
echo "   Copying management scripts..."
cp -r "${WORKSPACE_PATH}/docker-images/backend-images/gateway/app" "${BUILD_ROOT}/"

# Create manifest
cat > "${BUILD_ROOT}/BUILD_INFO.txt" <<EOF
Environment: ${ENV_NAME}
Built: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
Workspace: ${WORKSPACE_PATH}
Node Version: $(node --version)

Contents:
- app-gateway/          Compiled Node.js application
- app/                  VPN, Nginx, hot-reload scripts
- BUILD_INFO.txt        This file

Extraction: Extract to /opt/ (creates /opt/gateway/)
Run: /opt/gateway/app/main.sh -r bin/reset-gateway.sh
EOF

echo "   Creating tarball..."
cd "$TEMP_DIR"
tar czf "$OUTPUT_FILE" gateway/

# Cleanup
rm -rf "$TEMP_DIR"

SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)

echo ""
echo "✅ Build packed: gateway-${ENV_NAME}.tar.gz (${SIZE})"
echo "   Location: ${OUTPUT_FILE}"
echo ""
echo "📦 Package contents:"
echo "   - app-gateway/main.js       (compiled app)"
echo "   - app/bin/                  (reset-gateway, update-nginx-locations)"
echo "   - app/lib/                  (start/stop scripts)"
echo "   - app/main.sh               (script runner)"
echo "   - app/config.conf           (configuration)"
echo ""
echo "📊 Served at:"
echo "   http://172.17.0.2:8090/gateway-${ENV_NAME}.tar.gz"
echo ""
