#!/bin/bash
# Install system dependencies for local development
# Run this once in the development container

set -e

echo "📦 Installing system dependencies..."

# Update package lists
sudo apt update

# Install PostgreSQL server
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
sudo apt install -y nginx
sudo service nginx start

# Install other utilities
sudo apt install -y jq curl git

echo "✅ System dependencies installed"
echo ""
echo "📋 Next steps:"
echo "   1. Install mkcert: ./install-mkcert.sh"
echo "   2. Setup PostgreSQL: ./setup-postgres.sh"

