#!/bin/bash
# Master setup script - runs all one-time setup scripts
# Run this once when setting up local development for the first time

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Local Development - One-Time Setup                          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "This will install:"
echo "  - PostgreSQL server"
echo "  - Nginx web server"
echo "  - mkcert (SSL certificates)"
echo "  - Other dependencies"
echo ""
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Cancelled."
  exit 0
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1/3: Installing system dependencies..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
"${SCRIPT_DIR}/install-system-deps.sh"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2/3: Installing mkcert..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
"${SCRIPT_DIR}/install-mkcert.sh"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3/3: Setting up PostgreSQL..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
"${SCRIPT_DIR}/setup-postgres.sh"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ✅ One-Time Setup Complete!                                 ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "📋 IMPORTANT: Host OS Setup Required"
echo ""
echo "1. 🔐 Install mkcert root CA on your host OS (Windows/macOS/Linux):"
echo ""
CA_ROOT=$(mkcert -CAROOT)
echo "   Copy this file to your host OS: ${CA_ROOT}/rootCA.pem"
echo ""
echo "   Quick copy to workspace:"
echo "   $ cp ${CA_ROOT}/rootCA.pem /root/workspace/monorepo/rootCA.pem"
echo ""
echo "   Then on your host OS:"
echo "   - Windows: Right-click rootCA.pem → Install Certificate"
echo "   - macOS: Double-click → Add to System → Always Trust"
echo "   - Linux: certutil -d sql:\$HOME/.pki/nssdb -A -t C,, -n mkcert-dev -i rootCA.pem"
echo ""
echo "   See doc/LOCAL_DEVELOPMENT.md for detailed instructions."
echo ""
echo "2. 📋 For each environment you create, add hosts entries on your host OS"
echo "   (See instructions after running ./create-env.sh)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Next: Create your first environment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "   ./create-env.sh dev-001"
echo ""

