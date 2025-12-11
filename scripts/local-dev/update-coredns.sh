#!/bin/bash
# Update CoreDNS configuration based on all existing environments
# This script scans all environments and updates CoreDNS to forward all domains to PowerDNS

set -e

LOCAL_DEV_DIR="/root/.local-dev"

echo "🌐 Updating CoreDNS configuration..."

# Check if CoreDNS is installed
if ! command -v coredns &> /dev/null; then
    echo "   ⚠️  CoreDNS is not installed. Run ./setup-coredns.sh first."
    exit 1
fi

# Collect all domains from existing environments
domains=()
if [ -d "$LOCAL_DEV_DIR" ]; then
    for env_dir in "${LOCAL_DEV_DIR}"/*/; do
        if [ -d "$env_dir" ]; then
            env_file="${env_dir}/.env.ganymede"
            if [ -f "$env_file" ]; then
                domain=$(grep "^DOMAIN=" "$env_file" | cut -d= -f2 | tr -d '"' || echo "")
                if [ -n "$domain" ]; then
                    # Check if domain is already in the list (avoid duplicates)
                    if [[ ! " ${domains[@]} " =~ " ${domain} " ]]; then
                        domains+=("$domain")
                    fi
                fi
            fi
        fi
    done
fi

# If no domains found, use default
if [ ${#domains[@]} -eq 0 ]; then
    echo "   ℹ️  No environments found. Using default domain.local"
    domains=("domain.local")
fi

# Generate CoreDNS configuration
echo "   Found ${#domains[@]} domain(s): ${domains[*]}"

# Build forward zones for each domain
FORWARD_ZONES=""
for domain in "${domains[@]}"; do
    FORWARD_ZONES="${FORWARD_ZONES}    forward ${domain} 127.0.0.1:5300\n"
done

sudo mkdir -p /etc/coredns
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

echo "   ✅ CoreDNS configuration updated"

# Restart CoreDNS to apply changes
echo "   🔄 Restarting CoreDNS..."
if pgrep -x coredns >/dev/null 2>&1; then
    sudo killall coredns 2>/dev/null || true
    sleep 1
fi

# Start CoreDNS as daemon (containers don't have systemd)
sudo coredns -conf /etc/coredns/Corefile &
sleep 2

if pgrep -x coredns >/dev/null 2>&1; then
    echo "   ✅ CoreDNS restarted"
else
    echo "   ⚠️  Failed to restart CoreDNS. Check if port 53 is available:"
    echo "      sudo ss -tulnp | grep :53"
    echo "      sudo coredns -conf /etc/coredns/Corefile"
    exit 1
fi

echo "   ✅ CoreDNS update complete"

