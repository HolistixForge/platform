#!/bin/bash
# Setup CoreDNS for DNS management with zone files
# Serves zone files for local domains, forwards everything else to upstream DNS

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/coredns-common.sh"

echo "🌐 Setting up CoreDNS..."
echo ""

# Check if CoreDNS is installed
if ! command -v coredns &> /dev/null; then
    echo "📦 Installing CoreDNS..."
    
    # Download latest CoreDNS
    COREDNS_VERSION="1.11.1"

    # Detect the CPU architecture (x86_64 servers and arm64 VMs are both used)
    case "$(uname -m)" in
      x86_64 | amd64) ARCH="amd64" ;;
      aarch64 | arm64) ARCH="arm64" ;;
      *)
        echo "   ❌ Unsupported architecture: $(uname -m)"
        exit 1
        ;;
    esac
    echo "   Architecture: ${ARCH}"

    cd /tmp
    wget -q "https://github.com/coredns/coredns/releases/download/v${COREDNS_VERSION}/coredns_${COREDNS_VERSION}_linux_${ARCH}.tgz" || {
        echo "   ⚠️  Failed to download CoreDNS, trying apt install..."
        sudo apt update
        sudo apt install -y coredns || {
            echo "   ❌ CoreDNS not available in apt. Please install manually:"
            echo "      wget https://github.com/coredns/coredns/releases/download/v${COREDNS_VERSION}/coredns_${COREDNS_VERSION}_linux_${ARCH}.tgz"
            echo "      tar -xzf coredns_${COREDNS_VERSION}_linux_${ARCH}.tgz"
            echo "      sudo mv coredns /usr/local/bin/"
            exit 1
        }
    }
    
    if [ -f "coredns_${COREDNS_VERSION}_linux_${ARCH}.tgz" ]; then
        tar -xzf "coredns_${COREDNS_VERSION}_linux_${ARCH}.tgz"
        sudo mv coredns /usr/local/bin/
        rm -f "coredns_${COREDNS_VERSION}_linux_${ARCH}.tgz"
        echo "   ✅ CoreDNS installed"
    fi
else
    echo "   ✅ CoreDNS already installed"
fi

echo ""

# Create CoreDNS config directory
sudo mkdir -p /etc/coredns

# Configure CoreDNS
echo "⚙️  Configuring CoreDNS..."

# Collect domains from existing environments
domains=($(collect_domains))
echo "   Found ${#domains[@]} domain(s): ${domains[*]}"

# Generate Corefile
generate_corefile "${domains[@]}"

echo "✅ CoreDNS configuration written to /etc/coredns/Corefile"
echo "   Note: Configuration will be updated automatically when environments are created/deleted"
echo ""

# Start CoreDNS
echo "🚀 Starting CoreDNS..."

if ! restart_coredns; then
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ CoreDNS setup complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 CoreDNS Information:"
echo "   DNS Server: 0.0.0.0:53 (UDP/TCP) - External access"
echo "   Serves zone files from /etc/coredns/zones/"
echo "   Forwards other queries → 8.8.8.8, 8.8.4.4"
echo ""
echo "   Note: CoreDNS config is auto-updated when environments are created/deleted"
echo ""
echo "📝 Next steps:"
echo "   1. Configure host OS DNS (see doc/guides/DNS_COMPLETE_GUIDE.md)"
echo "      - Windows: Primary DNS: 127.0.0.1, Secondary: 8.8.8.8"
echo "      - macOS/Linux: See DNS_COMPLETE_GUIDE.md for instructions"
echo "   2. Test DNS resolution:"
echo "      dig @127.0.0.1 ganymede.{domain}"
echo "      dig @127.0.0.1 github.com"
echo ""
echo "📊 View logs:"
echo "   ps aux | grep coredns"
echo "   (CoreDNS logs to stdout/stderr)"
echo ""
