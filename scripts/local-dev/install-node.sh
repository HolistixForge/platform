#!/bin/bash
# Install Node.js from NodeSource repository
# Run this once in the development container

set -e

echo "📦 Installing Node.js..."

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

