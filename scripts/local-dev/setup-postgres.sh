#!/bin/bash
# Setup PostgreSQL for local development
# Run this once in the development container

set -e

echo "🐘 Setting up PostgreSQL..."

# Start PostgreSQL service (needed for checks and configuration)
sudo service postgresql start

# Check if PostgreSQL is already configured for local dev
if PGPASSWORD=devpassword psql -h localhost -U postgres -d postgres -c '\q' >/dev/null 2>&1; then
  echo "✅ PostgreSQL already configured for local development. Nothing to do."
  echo ""
  echo "   Host: localhost"
  echo "   Port: 5432"
  echo "   User: postgres"
  echo "   Password: devpassword"
  echo ""
  echo "   ⚠️  This is a development password. Change it in production!"
  echo ""
  exit 0
fi

# Create postgres password (idempotent: will just reset if already set)
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'devpassword';" 2>/dev/null || true

# Allow local connections with password (sed is safe to run multiple times)
sudo sed -i 's/local   all             postgres                                peer/local   all             postgres                                md5/' /etc/postgresql/*/main/pg_hba.conf
sudo sed -i 's/local   all             all                                     peer/local   all             all                                     md5/' /etc/postgresql/*/main/pg_hba.conf

# Restart PostgreSQL to apply any config changes
sudo service postgresql restart

echo "✅ PostgreSQL configured for local development"
echo ""
echo "   Host: localhost"
echo "   Port: 5432"
echo "   User: postgres"
echo "   Password: devpassword"
echo ""
echo "   ⚠️  This is a development password. Change it in production!"
echo ""
echo "📋 Next step: Create your first environment"
echo "   $ ./create-env.sh dev-001"

