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
echo "  - Node.js 24.x"
echo "  - PostgreSQL server"
echo "  - Nginx web server"
echo "  - mkcert (SSL certificates)"
echo "  - PowerDNS (DNS server - authoritative)"
echo "  - CoreDNS (DNS forwarder)"
echo "  - Observability stack (OTLP Collector, Loki, Tempo, Grafana)"
echo "  - Docker images (gateway)"
echo "  - Other dependencies"
echo ""
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Cancelled."
  exit 0
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1/8: Installing Node.js..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
"${SCRIPT_DIR}/install-node.sh"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2/8: Installing system dependencies..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
"${SCRIPT_DIR}/install-system-deps.sh"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3/8: Installing mkcert..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
"${SCRIPT_DIR}/install-mkcert.sh"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 4/8: Setting up PostgreSQL..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
"${SCRIPT_DIR}/setup-postgres.sh"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 5/8: Setting up PowerDNS..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
"${SCRIPT_DIR}/setup-powerdns.sh"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 6/8: Setting up CoreDNS (DNS forwarder)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
"${SCRIPT_DIR}/setup-coredns.sh"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 7/8: Setting up Observability Infrastructure..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
"${SCRIPT_DIR}/setup-observability.sh"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 8/8: Building Docker images..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
"${SCRIPT_DIR}/build-images.sh"

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
echo "2. 🌐 Configure DNS on your host OS (ONE-TIME SETUP)"
echo ""
echo "   The development environment uses CoreDNS (port 53) and PowerDNS (port 5300)."
echo "   Complete setup instructions: doc/guides/DNS_COMPLETE_GUIDE.md"
echo ""
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Next: Create your first environment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "   ./create-env.sh dev-001 domain.local"
echo ""
echo "   Or with custom domain:"
echo "   ./create-env.sh dev-001 mycompany.local"
echo ""

