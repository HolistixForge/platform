#!/bin/bash
# Common functions for CoreDNS management
# Sourced by setup-coredns.sh and update-coredns.sh

LOCAL_DEV_DIR="/root/.local-dev"

# Collect domains from all existing environments
collect_domains() {
    local domains=()
    
    if [ -d "$LOCAL_DEV_DIR" ]; then
        for env_dir in "${LOCAL_DEV_DIR}"/*/; do
            if [ -d "$env_dir" ]; then
                local env_file="${env_dir}/.env.ganymede"
                if [ -f "$env_file" ]; then
                    local domain=$(grep "^DOMAIN=" "$env_file" | cut -d= -f2 | tr -d '"' || echo "")
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
        domains=("domain.local")
    fi
    
    # Return as space-separated string
    echo "${domains[@]}"
}

# Generate Corefile configuration
generate_corefile() {
    local domains=($@)
    
    # Build file plugin blocks for each domain
    local FILE_BLOCKS=""
    for domain in "${domains[@]}"; do
        # Check if zone file exists
        if [ -f "/etc/coredns/zones/${domain}.zone" ]; then
            FILE_BLOCKS="${FILE_BLOCKS}${domain}. {
    file /etc/coredns/zones/${domain}.zone
    log
    errors
}

"
        fi
    done
    
    # Create zones directory if it doesn't exist
    sudo mkdir -p /etc/coredns/zones
    
    # Write Corefile
    sudo tee /etc/coredns/Corefile > /dev/null <<EOF
# Serve zone files for each environment domain
${FILE_BLOCKS}
# Forward everything else to upstream DNS
. {
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
}

# True when CoreDNS is managed by a systemd unit (VM / bare-metal install via
# infra/ansible). Dev containers have no systemd, so this is false there.
coredns_is_systemd_managed() {
    command -v systemctl >/dev/null 2>&1 \
        && systemctl list-unit-files coredns.service >/dev/null 2>&1 \
        && systemctl cat coredns.service >/dev/null 2>&1
}

# Restart CoreDNS service
restart_coredns() {
    local quiet=${1:-false}

    if [ "$quiet" != "true" ]; then
        echo "🔄 Restarting CoreDNS..."
    fi

    # Prefer systemd when a unit exists — starting a second bare process would
    # fight the managed one for port 53.
    if coredns_is_systemd_managed; then
        if [ "$quiet" != "true" ]; then
            echo "   Using systemd unit coredns.service..."
        fi
        sudo systemctl restart coredns
        sleep 1
        if sudo systemctl is-active --quiet coredns; then
            if [ "$quiet" != "true" ]; then
                echo "   ✅ CoreDNS restarted"
            fi
            return 0
        fi
        if [ "$quiet" != "true" ]; then
            echo "   ❌ CoreDNS failed to start"
            echo "   Check status: sudo systemctl status coredns"
            echo "   Check logs:   sudo journalctl -u coredns -n 50"
        fi
        return 1
    fi

    # Stop CoreDNS if running
    if pgrep -x coredns >/dev/null 2>&1; then
        if [ "$quiet" != "true" ]; then
            echo "   Stopping existing CoreDNS process..."
        fi
        sudo killall coredns 2>/dev/null || true
        sleep 1
    fi
    
    # Start CoreDNS as daemon
    if [ "$quiet" != "true" ]; then
        echo "   Starting CoreDNS daemon..."
    fi
    sudo coredns -conf /etc/coredns/Corefile &
    sleep 2
    
    # Verify CoreDNS started
    if pgrep -x coredns >/dev/null 2>&1; then
        if [ "$quiet" != "true" ]; then
            echo "   ✅ CoreDNS started successfully"
        fi
        return 0
    else
        if [ "$quiet" != "true" ]; then
            echo "   ❌ CoreDNS failed to start"
            echo "   Check configuration: sudo coredns -conf /etc/coredns/Corefile"
            echo "   Check port 53: sudo ss -tulnp | grep :53"
        fi
        return 1
    fi
}

