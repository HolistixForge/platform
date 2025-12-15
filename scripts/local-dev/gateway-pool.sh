#!/bin/bash
# Gateway pool management - unified script for creating and managing gateway containers
# Usage:
#   ./gateway-pool.sh create <count> <workspace-path>
#   ./gateway-pool.sh replace <env-name> [VAR=value] [VAR2=value2] ...
#   ./gateway-pool.sh list <env-name>
#   ./gateway-pool.sh stop <env-name>
#   ./gateway-pool.sh remove <env-name>

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
GRAY='\033[0;90m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration (can be overridden by environment variables)
ENV_NAME=${ENV_NAME:-"dev-001"}
DOMAIN=${DOMAIN:-"domain.local"}

# ============================================================================
# Common Functions
# ============================================================================

# Check if Docker is available
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker not found. Is Docker socket mounted?${NC}"
        echo "   Run: apt-get install -y docker.io"
        exit 1
    fi
}

# Find gateway containers for an environment
find_containers() {
    local env_name=$1
    docker ps -q --filter "label=environment=${env_name}" --filter "name=gw-pool-"
}

# Find all gateway containers (including stopped)
find_all_containers() {
    local env_name=$1
    docker ps -a -q --filter "label=environment=${env_name}" --filter "name=gw-pool-"
}

# Extract container configuration (environment variables and ports)
extract_container_config() {
    local container_id=$1
    local -n env_ref=$2  # Reference to associative array
    
    # Extract all environment variables
    while IFS='=' read -r key value; do
        if [ -n "$key" ]; then
            env_ref["$key"]="$value"
        fi
    done < <(docker inspect "$container_id" --format='{{range .Config.Env}}{{println .}}{{end}}' | grep -E '^[A-Z_]+=')
}

# Get port mappings from container
get_port_mappings() {
    local container_id=$1
    local http_port=$2
    local vpn_port=$3
    
    local http_map=$(docker port "$container_id" | grep "${http_port}/tcp" | awk '{print $3}' | cut -d':' -f1 || echo "")
    local vpn_map=$(docker port "$container_id" | grep "${vpn_port}/udp" | awk '{print $3}' | cut -d':' -f1 || echo "")
    
    echo "$http_map $vpn_map"
}

# Validate required environment variables
validate_required_env() {
    local -n env_ref=$1
    
    if [ -z "${env_ref[GATEWAY_ID]}" ] || \
       [ -z "${env_ref[GATEWAY_TOKEN]}" ] || \
       [ -z "${env_ref[GATEWAY_HTTP_PORT]}" ] || \
       [ -z "${env_ref[GATEWAY_VPN_PORT]}" ]; then
        return 1
    fi
    return 0
}

# Start a gateway container with given configuration
start_gateway_container() {
    local container_name=$1
    local gateway_id=$2
    local env_name=$3
    local http_port_map=$4
    local http_port=$5
    local vpn_port_map=$6
    local vpn_port=$7
    local -n env_ref=$8  # Reference to associative array with all env vars
    
    # Build docker run command with all environment variables
    local docker_env_args=()
    for var in "${!env_ref[@]}"; do
        docker_env_args+=(-e "${var}=${env_ref[$var]}")
    done
    
    # Get dev container IP for DNS resolution (PowerDNS on port 5300)
    local dev_container_ip=$(hostname -I | awk '{print $1}')
    
    # Start container with DNS pointing to dev container's PowerDNS
    docker run -d \
        --name "${container_name}" \
        --label "environment=${env_name}" \
        --label "gateway_id=${gateway_id}" \
        --network bridge \
        -p "${http_port_map}:${http_port}" \
        -p "${vpn_port_map}:${vpn_port}/udp" \
        --cap-add=NET_ADMIN \
        --device /dev/net/tun \
        --dns "${dev_container_ip}" \
        "${docker_env_args[@]}" \
        gateway:latest > /dev/null 2>&1
}

# Show container status for an environment
show_status() {
    local env_name=$1
    
    local total=$(docker ps -a --filter "name=gw-pool-${env_name}-" --filter "label=environment=${env_name}" --format "{{.Names}}" | wc -l)
    local running=$(docker ps --filter "name=gw-pool-${env_name}-" --filter "label=environment=${env_name}" --format "{{.Names}}" | wc -l)
    
    echo -e "${BLUE}Gateway Pool Status:${NC}"
    echo "  Environment: ${env_name}"
    echo "  Total: ${total}"
    echo "  Running: ${GREEN}${running}${NC}"
    
    if [ "$running" -ne "$total" ] && [ "$total" -gt 0 ]; then
        echo ""
        echo -e "${YELLOW}⚠️  Warning: Some gateway containers are not running!${NC}"
        echo "   Expected: ${total}, Running: ${running}"
    fi
}

# Load environment configuration
load_env_config() {
    local env_name=$1
    local env_dir="/root/.local-dev/${env_name}"
    
    if [ ! -f "${env_dir}/.env.ganymede" ]; then
        echo -e "${RED}❌ Ganymede .env file not found: ${env_dir}/.env.ganymede${NC}"
        return 1
    fi
    
    set -a
    source "${env_dir}/.env.ganymede"
    set +a
    
    # Export WORKSPACE for use in commands
    export WORKSPACE="${WORKSPACE:-/root/workspace/monorepo}"
    
    return 0
}

# Get gateway ID from container name using app-ganymede-cmds
get_gateway_id_from_container() {
    local container_name=$1
    local workspace_path=$2
    
    # Build app-ganymede-cmds if needed
    if [ ! -f "${workspace_path}/dist/packages/app-ganymede-cmds/main.js" ]; then
        echo -e "${RED}❌ app-ganymede-cmds not built${NC}"
        return 1
    fi
    
    # Use node to get gateway_id (we'll need to add this functionality)
    # For now, extract from container label
    docker ps -a --filter "name=${container_name}" --format "{{.Label \"gateway_id\"}}" 2>/dev/null || echo ""
}

# ============================================================================
# Command Handlers
# ============================================================================

# Command: create - Create new gateway containers
cmd_create() {
    local count=$1
    local workspace_path=$2
    
    # Validate arguments
    if [ -z "$count" ] || ! [[ "$count" =~ ^[0-9]+$ ]]; then
        echo -e "${RED}❌ Invalid count: ${count}${NC}"
        echo ""
        echo "Usage: $0 create <count> <workspace-path>"
        exit 1
    fi
    
    if [ -z "$workspace_path" ]; then
        echo -e "${RED}❌ WORKSPACE_PATH is required${NC}"
        echo ""
        echo "Usage: $0 create <count> <workspace-path>"
        exit 1
    fi
    
    if [ ! -d "$workspace_path" ]; then
        echo -e "${RED}❌ Workspace path not found: ${workspace_path}${NC}"
        exit 1
    fi
    
    check_docker
    
    # Load Ganymede env
    local env_dir="/root/.local-dev/${ENV_NAME}"
    if [ ! -f "${env_dir}/.env.ganymede" ]; then
        echo -e "${RED}❌ Ganymede .env file not found: ${env_dir}/.env.ganymede${NC}"
        echo "   Run create-env.sh first"
        exit 1
    fi
    
    set -a
    source "${env_dir}/.env.ganymede"
    set +a
    
    # Build app-ganymede-cmds if needed
    if [ ! -f "${workspace_path}/dist/packages/app-ganymede-cmds/main.js" ]; then
        echo "📦 Building app-ganymede-cmds..."
        cd "${workspace_path}"
        npx nx run app-ganymede-cmds:build > /dev/null 2>&1
        if [ $? -ne 0 ]; then
            echo -e "${RED}❌ Failed to build app-ganymede-cmds${NC}"
            exit 1
        fi
    fi
    
    echo -e "${BLUE}📦 Creating $count gateways in pool...${NC}"
    echo "   Environment: ${ENV_NAME}"
    echo "   Domain: ${DOMAIN}"
    echo "   Workspace: ${workspace_path}"
    echo ""
    
    # Get build server IP
    local build_server_ip=$(hostname -I | awk '{print $1}')
    
    for i in $(seq 1 $count); do
        # Calculate ports based on ALL existing gateway containers
        local gateway_count=$(docker ps -a --filter "name=gw-pool-" --format "{{.Names}}" | wc -l)
        local gw_http_port=$((7100 + gateway_count))
        local gw_vpn_port=$((49100 + gateway_count))
        
        local gateway_name="gw-pool-${ENV_NAME}-${gateway_count}"
        local gateway_version="0.0.1"
        
        echo -e "${BLUE}  Creating ${gateway_name}...${NC}"
        
        # Register gateway in database
        echo "     Registering in database..."
        echo "     Gateway: ${gateway_name}, HTTP: ${gw_http_port}, VPN: ${gw_vpn_port}"
        set +e
        local register_output=$(LOG_LEVEL=6 \
            node "${workspace_path}/dist/packages/app-ganymede-cmds/main.js" add-gateway \
            -gv "${gateway_version}" \
            -c "${gateway_name}" \
            -hp "${gw_http_port}" \
            -vp "${gw_vpn_port}" 2>&1)
        local register_exit_code=$?
        set -e
        
        if [ $register_exit_code -ne 0 ]; then
            echo -e "${RED}  ❌ Failed to register gateway in database${NC}"
            echo "$register_output"
            exit 1
        fi
        
        # Extract gateway_id and token
        local gateway_id=$(echo "$register_output" | grep 'gateway_id:' | grep -oP '[a-f0-9-]{36}' | head -1)
        local gateway_token=$(echo "$register_output" | grep '^token:' | awk '{print $2}')
        
        if [ -z "$gateway_id" ] || [ -z "$gateway_token" ]; then
            echo -e "${RED}  ❌ Failed to extract gateway credentials${NC}"
            echo "$register_output"
            exit 1
        fi
        
        echo "     Gateway ID: ${gateway_id}"
        echo -e "${GREEN}   ✓ Gateway will fetch build from HTTP server${NC}"
        
        # Prepare environment variables
        declare -A container_env
        container_env[ENV_NAME]="${ENV_NAME}"
        container_env[GATEWAY_ID]="${gateway_id}"
        container_env[GATEWAY_TOKEN]="${gateway_token}"
        container_env[GATEWAY_HTTP_PORT]="${gw_http_port}"
        container_env[GATEWAY_VPN_PORT]="${gw_vpn_port}"
        container_env[GANYMEDE_FQDN]="ganymede.${DOMAIN}"
        # GANYMEDE_API_URL: Use dev container IP with HTTPS (always add Host header)
        container_env[GANYMEDE_API_URL]="https://${build_server_ip}"
        container_env[DOMAIN]="${DOMAIN}"
        container_env[BUILD_SERVER_IP]="${build_server_ip}"
        
        # OpenTelemetry configuration
        # Gateway containers need to reach OTLP Collector on the Docker host.
        # 172.17.0.1 is the Docker bridge gateway IP - it allows containers
        # to reach services exposed on the host (OTLP ports 4317/4318).
        # This is necessary because 'localhost' inside a container refers to
        # the container itself, not the Docker host.
        container_env[OTEL_SERVICE_NAME]="gateway-${gateway_name}"
        container_env[OTEL_DEPLOYMENT_ENVIRONMENT]="${ENV_NAME}"
        container_env[OTLP_ENDPOINT_HTTP]="http://172.17.0.1:4318"
        container_env[OTLP_ENDPOINT_GRPC]="http://172.17.0.1:4317"
        
        # Start container (ports map to themselves for new containers)
        if start_gateway_container \
            "$gateway_name" \
            "$gateway_id" \
            "$ENV_NAME" \
            "$gw_http_port" \
            "$gw_http_port" \
            "$gw_vpn_port" \
            "$gw_vpn_port" \
            container_env; then
            echo -e "${GREEN}  ✅ Created ${gateway_name} (HTTP: ${gw_http_port}, VPN: ${gw_vpn_port})${NC}"
        else
            echo -e "${RED}  ❌ Failed to create ${gateway_name}${NC}"
            exit 1
        fi
    done
    
    echo ""
    echo -e "${GREEN}🎉 Gateway pool created successfully!${NC}"
    echo ""
    show_status "$ENV_NAME"
    echo ""
    echo "📊 View gateways:"
    echo "   docker ps --filter label=environment=${ENV_NAME}"
    echo ""
    echo "📋 Gateway allocation managed in PostgreSQL:"
    echo "   SELECT * FROM gateways;"
    echo "   SELECT * FROM organizations_gateways;"
}

# Command: replace - Remove all gateways and recreate them
cmd_replace() {
    local env_name=$1
    shift  # Remove env-name from arguments
    
    if [ -z "$env_name" ]; then
        echo -e "${RED}❌ Environment name is required${NC}"
        echo ""
        echo "Usage: $0 replace <env-name> [VAR=value]"
        echo ""
        echo "Examples:"
        echo "  $0 replace dev-001"
        echo "  BUILD_SERVER_IP=172.17.0.3 $0 replace dev-001"
        echo ""
        echo "Note: All gateways will be removed and recreated"
        echo "      Environment variables can be set before the command"
        exit 1
    fi
    
    check_docker
    
    # Load environment config
    if ! load_env_config "$env_name"; then
        exit 1
    fi
    
    # Collect environment variable overrides (export them for create command)
    for arg in "$@"; do
        if [[ "$arg" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
            local var_name="${BASH_REMATCH[1]}"
            local var_value="${BASH_REMATCH[2]}"
            export "${var_name}=${var_value}"
            echo -e "${CYAN}   Setting ${var_name}=${var_value}${NC}"
        else
            echo -e "${YELLOW}⚠️  Ignoring invalid argument: ${arg}${NC}"
            echo "   Expected format: VAR=value"
        fi
    done
    
    # Count existing gateways
    local all_containers=$(find_all_containers "$env_name")
    local gateway_count=0
    
    if [ -n "$all_containers" ]; then
        gateway_count=$(echo "$all_containers" | wc -l)
    fi
    
    if [ "$gateway_count" -eq 0 ]; then
        echo -e "${YELLOW}⚠️  No gateway containers found for environment: ${env_name}${NC}"
        echo "   Use 'create' command to create new gateways"
        exit 0
    fi
    
    echo -e "${BLUE}🔄 Replacing gateway containers...${NC}"
    echo "   Environment: ${env_name}"
    echo "   Found ${gateway_count} gateway(s) to replace"
    echo ""
    
    # Step 1: Remove all gateways (handles DB cleanup automatically)
    echo -e "${BLUE}Step 1: Removing existing gateways...${NC}"
    local containers=$(find_all_containers "$env_name")
    
    if [ -n "$containers" ]; then
        # Build app-ganymede-cmds if needed
        if [ ! -f "${WORKSPACE}/dist/packages/app-ganymede-cmds/main.js" ]; then
            echo "📦 Building app-ganymede-cmds..."
            cd "${WORKSPACE}"
            npx nx run app-ganymede-cmds:build > /dev/null 2>&1
            if [ $? -ne 0 ]; then
                echo -e "${RED}❌ Failed to build app-ganymede-cmds${NC}"
                exit 1
            fi
        fi
        
        local count=0
        local db_removed=0
        
        for container_id in $containers; do
            local container_name=$(docker inspect --format='{{.Name}}' "$container_id" | sed 's/\///')
            local gateway_id=$(docker inspect --format='{{index .Config.Labels "gateway_id"}}' "$container_id")
            
            echo -e "${GRAY}   Removing ${container_name}...${NC}"
            
            # Remove from database first (ends allocations, then deletes gateway)
            if [ -n "$gateway_id" ]; then
                if LOG_LEVEL=6 node "${WORKSPACE}/dist/packages/app-ganymede-cmds/main.js" remove-gateway \
                    -g "$gateway_id" 2>&1 | grep -q "removed from database"; then
                    db_removed=$((db_removed + 1))
                else
                    # Try by container name as fallback
                    if LOG_LEVEL=6 node "${WORKSPACE}/dist/packages/app-ganymede-cmds/main.js" remove-gateway \
                        -c "$container_name" 2>&1 | grep -q "removed from database"; then
                        db_removed=$((db_removed + 1))
                    else
                        echo -e "${YELLOW}      ⚠️  Could not remove from database (will clean up manually)${NC}"
                    fi
                fi
            else
                # No gateway_id label, try by container name
                if LOG_LEVEL=6 node "${WORKSPACE}/dist/packages/app-ganymede-cmds/main.js" remove-gateway \
                    -c "$container_name" 2>&1 | grep -q "removed from database"; then
                    db_removed=$((db_removed + 1))
                fi
            fi
            
            # Remove container
            docker rm -f "$container_id" > /dev/null 2>&1 && count=$((count + 1))
            echo -e "${GREEN}   ✅ ${container_name} removed${NC}"
        done
        
        echo -e "${GREEN}✅ Removed ${count} container(s)${NC}"
        if [ $db_removed -gt 0 ]; then
            echo -e "${GREEN}   Database cleaned: ${db_removed} gateway(s) removed${NC}"
        fi
        
        # Clean up any remaining database entries for this environment
        if [ $db_removed -lt $count ]; then
            echo -e "${GRAY}   Cleaning up remaining database entries...${NC}"
            source /root/.local-dev/${env_name}/.env.ganymede 2>/dev/null
            DB_NAME="ganymede_${env_name//-/_}"
            PGPASSWORD=devpassword psql -U postgres -h localhost -d "$DB_NAME" -c \
                "DELETE FROM gateways WHERE container_name LIKE 'gw-pool-${env_name}-%';" > /dev/null 2>&1
            echo -e "${GREEN}   ✅ Database cleanup complete${NC}"
        fi
    fi
    echo ""
    
    # Step 2: Recreate gateways with same count
    echo -e "${BLUE}Step 2: Creating ${gateway_count} new gateway(s)...${NC}"
    cmd_create "$gateway_count" "$WORKSPACE"
}

# Command: list - List gateway containers
cmd_list() {
    local env_name=$1
    
    if [ -z "$env_name" ]; then
        echo -e "${RED}❌ Environment name is required${NC}"
        echo ""
        echo "Usage: $0 list <env-name>"
        exit 1
    fi
    
    check_docker
    
    echo -e "${BLUE}📊 Gateway containers for ${env_name}:${NC}"
    echo ""
    
    docker ps -a --filter "label=environment=${env_name}" --filter "name=gw-pool-" \
        --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" || true
    
    echo ""
    show_status "$env_name"
}

# Command: stop - Stop all gateway containers
cmd_stop() {
    local env_name=$1
    
    if [ -z "$env_name" ]; then
        echo -e "${RED}❌ Environment name is required${NC}"
        echo ""
        echo "Usage: $0 stop <env-name>"
        exit 1
    fi
    
    check_docker
    
    # Load environment config for database operations
    if ! load_env_config "$env_name"; then
        exit 1
    fi
    
    local containers=$(find_containers "$env_name")
    
    if [ -z "$containers" ]; then
        echo -e "${YELLOW}⚠️  No running gateway containers found for environment: ${env_name}${NC}"
        exit 0
    fi
    
    echo -e "${BLUE}🛑 Stopping gateway containers...${NC}"
    echo "   Environment: ${env_name}"
    echo ""
    
    local count=0
    local db_updated=0
    
    for container_id in $containers; do
        local container_name=$(docker inspect --format='{{.Name}}' "$container_id" | sed 's/\///')
        local gateway_id=$(docker inspect --format='{{index .Config.Labels "gateway_id"}}' "$container_id")
        
        echo -e "${GRAY}   Stopping ${container_name}...${NC}"
        docker stop "$container_id" > /dev/null 2>&1 && count=$((count + 1))
        
        # Update database: set ready=false
        if [ -n "$gateway_id" ] && [ -f "${WORKSPACE}/dist/packages/app-ganymede-cmds/main.js" ]; then
            if LOG_LEVEL=6 node "${WORKSPACE}/dist/packages/app-ganymede-cmds/main.js" set-gateway-ready \
                -g "$gateway_id" -r false > /dev/null 2>&1; then
                db_updated=$((db_updated + 1))
            fi
        fi
        
        echo -e "${GREEN}   ✅ ${container_name} stopped${NC}"
    done
    
    echo ""
    echo -e "${GREEN}✅ Stopped ${count} container(s)${NC}"
    if [ $db_updated -gt 0 ]; then
        echo -e "${GREEN}   Database updated: ${db_updated} gateway(s) set to ready=false${NC}"
    fi
}

# Command: remove - Remove all gateway containers
cmd_remove() {
    local env_name=$1
    
    if [ -z "$env_name" ]; then
        echo -e "${RED}❌ Environment name is required${NC}"
        echo ""
        echo "Usage: $0 remove <env-name>"
        exit 1
    fi
    
    check_docker
    
    # Load environment config for database operations
    if ! load_env_config "$env_name"; then
        exit 1
    fi
    
    local containers=$(find_all_containers "$env_name")
    
    if [ -z "$containers" ]; then
        echo -e "${YELLOW}⚠️  No gateway containers found for environment: ${env_name}${NC}"
        exit 0
    fi
    
    echo -e "${YELLOW}⚠️  This will remove ALL gateway containers for ${env_name}${NC}"
    echo -e "${YELLOW}   Containers will be stopped and removed${NC}"
    echo -e "${YELLOW}   Database entries will be deleted${NC}"
    echo ""
    read -p "Continue? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled"
        exit 0
    fi
    
    echo -e "${BLUE}🗑️  Removing gateway containers...${NC}"
    echo "   Environment: ${env_name}"
    echo ""
    
    # Build app-ganymede-cmds if needed
    if [ ! -f "${WORKSPACE}/dist/packages/app-ganymede-cmds/main.js" ]; then
        echo "📦 Building app-ganymede-cmds..."
        cd "${WORKSPACE}"
        npx nx run app-ganymede-cmds:build > /dev/null 2>&1
        if [ $? -ne 0 ]; then
            echo -e "${RED}❌ Failed to build app-ganymede-cmds${NC}"
            exit 1
        fi
    fi
    
    local count=0
    local db_removed=0
    
    for container_id in $containers; do
        local container_name=$(docker inspect --format='{{.Name}}' "$container_id" | sed 's/\///')
        local gateway_id=$(docker inspect --format='{{index .Config.Labels "gateway_id"}}' "$container_id")
        
        echo -e "${GRAY}   Removing ${container_name}...${NC}"
        
        # Remove from database first (ends allocations, then deletes gateway)
        if [ -n "$gateway_id" ] && [ -f "${WORKSPACE}/dist/packages/app-ganymede-cmds/main.js" ]; then
            if LOG_LEVEL=6 node "${WORKSPACE}/dist/packages/app-ganymede-cmds/main.js" remove-gateway \
                -g "$gateway_id" > /dev/null 2>&1; then
                db_removed=$((db_removed + 1))
                echo -e "${GRAY}      Database entry removed${NC}"
            else
                # Try by container name as fallback
                if LOG_LEVEL=6 node "${WORKSPACE}/dist/packages/app-ganymede-cmds/main.js" remove-gateway \
                    -c "$container_name" > /dev/null 2>&1; then
                    db_removed=$((db_removed + 1))
                    echo -e "${GRAY}      Database entry removed${NC}"
                else
                    echo -e "${YELLOW}      ⚠️  Could not remove from database (may not exist)${NC}"
                fi
            fi
        fi
        
        # Remove container
        docker rm -f "$container_id" > /dev/null 2>&1 && count=$((count + 1))
        echo -e "${GREEN}   ✅ ${container_name} removed${NC}"
    done
    
    echo ""
    echo -e "${GREEN}✅ Removed ${count} container(s)${NC}"
    if [ $db_removed -gt 0 ]; then
        echo -e "${GREEN}   Database cleaned: ${db_removed} gateway(s) removed${NC}"
    fi
}

# ============================================================================
# Main Command Dispatcher
# ============================================================================

COMMAND=${1:-""}

case "$COMMAND" in
    create)
        shift
        # Support both "create <count> <path>" and "<count> <path>" formats
        if [ "$1" = "create" ]; then
            shift  # Remove duplicate "create"
        fi
        cmd_create "$@"
        ;;
    replace)
        shift
        cmd_replace "$@"
        ;;
    list)
        shift
        cmd_list "$@"
        ;;
    stop)
        shift
        cmd_stop "$@"
        ;;
    remove)
        shift
        cmd_remove "$@"
        ;;
    "")
        echo -e "${RED}❌ Command is required${NC}"
        echo ""
        echo "Usage: $0 <command> [args...]"
        echo ""
        echo "Commands:"
        echo "  create <count> <workspace-path>  - Create new gateway containers"
        echo "  replace <env-name> [VAR=value]    - Replace all gateways (remove + recreate)"
        echo "  list <env-name>                  - List gateway containers"
        echo "  stop <env-name>                  - Stop all gateways"
        echo "  remove <env-name>                 - Remove all gateways"
        echo ""
        echo "Examples:"
        echo "  $0 create 3 /root/workspace/monorepo"
        echo "  $0 replace dev-001 BUILD_SERVER_IP=172.17.0.3"
        echo "  $0 list dev-001"
        exit 1
        ;;
    *)
        echo -e "${RED}❌ Unknown command: ${COMMAND}${NC}"
        echo ""
        echo "Available commands: create, replace, list, stop, remove"
        exit 1
        ;;
esac
