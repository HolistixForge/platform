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

# Configure Nginx for long server names (org UUIDs create long domain names)
# Increase server_names_hash_bucket_size to handle domains like:
# org-eca5a0f9-9191-48b2-9cfc-f554e3747179.domain.local
sudo sed -i 's/# server_names_hash_bucket_size 64;/server_names_hash_bucket_size 128;/' /etc/nginx/nginx.conf

sudo service nginx start

# Install Docker client (for building/running images from the container)
sudo apt install -y docker.io

# Install other utilities
sudo apt install -y jq curl git dnsutils lsof net-tools psmisc

echo "✅ System dependencies installed"
echo ""
echo "📋 Next steps:"
echo "   1. Install mkcert: ./install-mkcert.sh"
echo "   2. Setup PostgreSQL: ./setup-postgres.sh"

