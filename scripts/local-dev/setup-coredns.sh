#!/bin/bash
# Setup CoreDNS for DNS forwarding
# Forwards *.domain.local to PowerDNS, everything else to upstream DNS
# DNS forwarder that works well in Docker containers

set -e

echo "🌐 Setting up CoreDNS for DNS forwarding..."
echo ""

# Check if CoreDNS is installed
if ! command -v coredns &> /dev/null; then
    echo "📦 Installing CoreDNS..."
    
    # Download latest CoreDNS
    COREDNS_VERSION="1.11.1"
    ARCH="amd64"
    
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

# Get list of domains from existing environments
DOMAINS="domain.local"
LOCAL_DEV_DIR="/root/.local-dev"
if [ -d "$LOCAL_DEV_DIR" ]; then
    domains_list=()
    for env_dir in "${LOCAL_DEV_DIR}"/*/; do
        if [ -d "$env_dir" ]; then
            env_file="${env_dir}/.env.ganymede"
            if [ -f "$env_file" ]; then
                domain=$(grep "^DOMAIN=" "$env_file" | cut -d= -f2 | tr -d '"' || echo "")
                if [ -n "$domain" ]; then
                    # Check if domain is already in the list (avoid duplicates)
                    if [[ ! " ${domains_list[@]} " =~ " ${domain} " ]]; then
                        domains_list+=("$domain")
                    fi
                fi
            fi
        fi
    done
    if [ ${#domains_list[@]} -gt 0 ]; then
        DOMAINS="${domains_list[*]}"
    fi
fi

# Build forward zones for each domain
FORWARD_ZONES=""
for domain in $DOMAINS; do
    FORWARD_ZONES="${FORWARD_ZONES}    forward ${domain} 127.0.0.1:5300\n"
done

sudo tee /etc/coredns/Corefile > /dev/null <<EOF
.:53 {
    # Forward environment domains to PowerDNS
${FORWARD_ZONES}
    # Forward everything else to upstream DNS
    forward . 8.8.8.8 8.8.4.4 {
        max_concurrent 1000
    }
    
    # Cache responses
    cache {
        success 9984 30
        denial 9984 5
    }
    
    # Logging
    log
    errors
}
EOF

echo "✅ CoreDNS configuration written to /etc/coredns/Corefile"
echo "   Note: Configuration will be updated automatically when environments are created/deleted"
echo ""

# Start or restart CoreDNS
echo "🚀 Starting CoreDNS..."

if pgrep -x coredns >/dev/null 2>&1; then
    echo "   CoreDNS already running, restarting..."
    sudo killall coredns 2>/dev/null || true
    sleep 1
fi

# Start CoreDNS as daemon (containers don't have systemd)
echo "   Starting CoreDNS daemon..."
sudo coredns -conf /etc/coredns/Corefile &
sleep 2

# Test CoreDNS
if pgrep -x coredns >/dev/null 2>&1; then
    echo "   ✅ CoreDNS started successfully"
else
    echo "   ❌ CoreDNS failed to start. Check configuration:"
    echo "      sudo coredns -conf /etc/coredns/Corefile"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ CoreDNS setup complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 CoreDNS Information:"
echo "   DNS Server: 0.0.0.0:53 (UDP/TCP) - External access"
echo "   Forwards environment domains → PowerDNS (127.0.0.1:5300)"
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

