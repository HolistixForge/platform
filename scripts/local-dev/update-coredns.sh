#!/bin/bash
# Update CoreDNS configuration based on all existing environments
# This script scans all environments and updates CoreDNS to serve zone files

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/coredns-common.sh"

echo "🌐 Updating CoreDNS configuration..."

# Check if CoreDNS is installed
if ! command -v coredns &> /dev/null; then
    echo "   ⚠️  CoreDNS is not installed. Run ./setup-coredns.sh first."
    exit 1
fi

# Collect domains from existing environments
domains=($(collect_domains))
echo "   Found ${#domains[@]} domain(s): ${domains[*]}"

# Check for missing zone files
missing_zones=()
for domain in "${domains[@]}"; do
    if [ ! -f "/etc/coredns/zones/${domain}.zone" ]; then
        missing_zones+=("$domain")
        echo "   ⚠️  Zone file not found for ${domain}"
    fi
done

# Generate Corefile
generate_corefile "${domains[@]}"

echo "   ✅ CoreDNS configuration updated"

# Restart CoreDNS to apply changes
if ! restart_coredns; then
    exit 1
fi

echo "   ✅ CoreDNS update complete"

# Warn about missing zone files
if [ ${#missing_zones[@]} -gt 0 ]; then
    echo ""
    echo "⚠️  Warning: Zone files missing for: ${missing_zones[*]}"
    echo "   These domains were skipped in the Corefile."
    echo "   Run create-env.sh to create zone files for these environments."
fi
