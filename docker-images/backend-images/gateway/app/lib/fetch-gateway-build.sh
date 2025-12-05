#!/bin/bash
# Fetch gateway build from dev container's HTTP server
# Extracts to /opt/gateway (standard app location)

set -e

# Configuration
BUILD_SERVER_IP=${BUILD_SERVER_IP:-$(ip route | grep default | awk '{print $3}')}
BUILD_SERVER="http://${BUILD_SERVER_IP}:8090"
BUILD_URL="${BUILD_SERVER}/gateway-${ENV_NAME}.tar.gz"
EXTRACT_DIR="/opt"  # Extract to /opt (creates /opt/gateway/)

echo "📥 Fetching gateway build..."
echo "   Environment: ${ENV_NAME}"
echo "   URL: ${BUILD_URL}"
echo "   Extract to: ${EXTRACT_DIR}"
echo ""

# Create extraction directory
mkdir -p "$EXTRACT_DIR"
cd "$EXTRACT_DIR"

# Remove old build if exists
rm -rf "$EXTRACT_DIR/gateway"

# Fetch and extract
echo "   Downloading and extracting..."
if curl -f -sS "$BUILD_URL" | tar xz; then
    echo "✅ Build fetched and extracted to /opt/gateway"
    echo ""
    echo "📦 Package contents:"
    ls -lh /opt/gateway/ | grep -v "^total"
    echo ""
else
    echo "❌ Failed to fetch build from ${BUILD_URL}"
    echo ""
    echo "💡 Make sure:"
    echo "   1. Build server is running in dev container:"
    echo "      ./scripts/local-dev/serve-builds.sh &"
    echo ""
    echo "   2. Build is packed:"
    echo "      ./scripts/local-dev/pack-gateway-build.sh ${ENV_NAME}"
    echo ""
    echo "   3. Build server is accessible:"
    echo "      curl -I ${BUILD_URL}"
    exit 1
fi
