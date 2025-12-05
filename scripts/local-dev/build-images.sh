#!/bin/bash
# Build required Docker images for local development
# Usage: ./build-images.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DOCKER_IMAGES_DIR="${REPO_ROOT}/docker-images/backend-images"

echo "🏗️  Building Docker images for local development..."
echo ""

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first."
    echo "   See: https://docs.docker.com/get-docker/"
    exit 1
fi

# Build gateway
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Building gateway..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cd "${DOCKER_IMAGES_DIR}/gateway"
docker build -t gateway:latest .

if [ $? -ne 0 ]; then
    echo "❌ Failed to build gateway image"
    exit 1
fi

echo "✅ gateway:latest built successfully"
echo ""

# Show built images
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All Docker images built successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
docker images | grep -E "REPOSITORY|gateway"
echo ""
echo "🎉 Ready for gateway pool deployment!"


