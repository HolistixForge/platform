#!/bin/bash
# Setup PostgreSQL for local development
# Run this once in the development container

set -e

echo "🐘 Setting up PostgreSQL..."

# Start PostgreSQL service
sudo service postgresql start

# Create postgres password (if not exists)
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'devpassword';" 2>/dev/null || true

# Allow local connections with password
sudo sed -i 's/local   all             postgres                                peer/local   all             postgres                                md5/' /etc/postgresql/*/main/pg_hba.conf
sudo sed -i 's/local   all             all                                     peer/local   all             all                                     md5/' /etc/postgresql/*/main/pg_hba.conf

# Restart PostgreSQL
sudo service postgresql restart

echo "✅ PostgreSQL configured"
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

