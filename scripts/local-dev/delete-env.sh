#!/bin/bash
# Delete a local development environment
# Usage: ./delete-env.sh dev-001

set -e

ENV_NAME=$1

if [ -z "$ENV_NAME" ]; then
  echo "Usage: $0 <env-name>"
  echo ""
  echo "Available environments:"
  ./list-envs.sh
  exit 1
fi

ENV_DIR="/root/.local-dev/${ENV_NAME}"

if [ ! -d "$ENV_DIR" ]; then
  echo "❌ Environment '${ENV_NAME}' not found"
  echo ""
  echo "Available environments:"
  ./list-envs.sh
  exit 1
fi

echo "⚠️  This will DELETE environment '${ENV_NAME}' and its database!"
echo "   Location: ${ENV_DIR}"
echo ""
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Cancelled."
  exit 0
fi

# Stop if running
if [ -f "${ENV_DIR}/stop.sh" ]; then
  echo "🛑 Stopping environment..."
  "${ENV_DIR}/stop.sh" 2>/dev/null || true
fi

# Remove Nginx config
echo "🌐 Removing Nginx configuration..."
sudo rm -f "/etc/nginx/sites-enabled/${ENV_NAME}"
sudo rm -f "/etc/nginx/sites-available/${ENV_NAME}"
sudo nginx -t && sudo service nginx reload

# Drop database and user
DB_NAME="ganymede_${ENV_NAME//-/_}"
APP_DB_USER="ganymede_app_${ENV_NAME//-/_}"

echo "🐘 Dropping database and user..."

# Check if PostgreSQL is running
if ! service postgresql status 2>/dev/null | grep -q "online"; then
  echo "   ⚠️  PostgreSQL is not running. Starting it..."
  service postgresql start
  sleep 2
fi

# Drop database (must be separate command, cannot be in transaction block)
if PGPASSWORD=devpassword psql -U postgres -h localhost -c "DROP DATABASE IF EXISTS ${DB_NAME};" 2>&1 | grep -q "DROP DATABASE"; then
  echo "   ✅ Database dropped: ${DB_NAME}"
else
  echo "   ℹ️  Database ${DB_NAME} did not exist or already dropped"
fi

# Drop user
if PGPASSWORD=devpassword psql -U postgres -h localhost -c "DROP USER IF EXISTS ${APP_DB_USER};" 2>&1 | grep -q "DROP ROLE"; then
  echo "   ✅ User dropped: ${APP_DB_USER}"
else
  echo "   ℹ️  User ${APP_DB_USER} did not exist or already dropped"
fi

# Remove directory
echo "🗑️  Removing directory..."
rm -rf "${ENV_DIR}"

echo ""
echo "✅ Environment '${ENV_NAME}' deleted"
echo ""
echo "ℹ️  DNS records are managed by PowerDNS. No manual cleanup needed."
echo ""

