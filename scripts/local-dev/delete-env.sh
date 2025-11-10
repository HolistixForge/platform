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
PGPASSWORD=devpassword psql -U postgres -h localhost << EOF 2>/dev/null || true
DROP DATABASE IF EXISTS ${DB_NAME};
DROP USER IF EXISTS ${APP_DB_USER};
EOF
echo "   ✅ Database dropped: ${DB_NAME}"
echo "   ✅ User dropped: ${APP_DB_USER}"

# Remove /etc/hosts entries
echo "📝 Removing /etc/hosts entries..."
TMP_HOSTS=$(mktemp)
sudo grep -v "local-dev-${ENV_NAME}" /etc/hosts | sudo grep -v "${ENV_NAME}.local" > "$TMP_HOSTS"
sudo cp "$TMP_HOSTS" /etc/hosts
rm "$TMP_HOSTS"

# Remove directory
echo "🗑️  Removing directory..."
rm -rf "${ENV_DIR}"

echo ""
echo "✅ Environment '${ENV_NAME}' deleted"
echo ""
echo "⚠️  Don't forget to remove entries from your host OS hosts file:"
echo "   - Windows: C:\\Windows\\System32\\drivers\\etc\\hosts"
echo "   - macOS/Linux: /etc/hosts"
echo ""
echo "   Remove lines containing: ${ENV_NAME}.local"
echo ""

