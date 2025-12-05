#!/bin/bash
# Install Node.js from NodeSource repository
# Run this once in the development container

set -e

echo "📦 Installing Node.js..."

# Check if Node.js is already installed with the desired major version (24.x)
if command -v node >/dev/null 2>&1; then
  CURRENT_NODE_VERSION=$(node --version 2>/dev/null || echo "")
  if echo "$CURRENT_NODE_VERSION" | grep -qE '^v24\.'; then
    echo "✅ Node.js already installed with desired version (${CURRENT_NODE_VERSION}). Nothing to do."
    echo ""
    echo "📊 Versions:"
    echo "   Node.js: ${CURRENT_NODE_VERSION}"
    echo "   npm:     $(npm --version 2>/dev/null || echo 'unknown')"
    echo ""
    exit 0
  fi
fi

# Install prerequisites
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

# Add NodeSource repository key
echo "🔑 Adding NodeSource GPG key..."
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg

# Add NodeSource repository (Node.js 24.x)
echo "📋 Adding NodeSource repository (Node.js 24.x)..."
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list

# Install Node.js
echo "⬇️  Downloading and installing Node.js..."
sudo apt-get update
sudo apt-get install -y nodejs

# Verify installation
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)

echo "✅ Node.js installed successfully"
echo ""
echo "📊 Versions:"
echo "   Node.js: ${NODE_VERSION}"
echo "   npm:     ${NPM_VERSION}"
echo ""

