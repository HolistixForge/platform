#!/bin/bash
# Infrastructure Diagnostic Tool for Local Development
# Comprehensive health check for all services, containers, and infrastructure

# Don't exit on errors - we want to continue checking even if some checks fail
set +e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration
LOCAL_DEV_DIR="/root/.local-dev"
DEV_CONTAINER_IP=$(hostname -I | awk '{print $1}')

# Counters for summary
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Helper function to check service status
check_service() {
    local service_name=$1
    local check_command=$2
    local description=$3
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    echo -n "  ${description}... "
    
    if eval "$check_command" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Running${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        echo -e "${RED}❌ Not running${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        return 1
    fi
}

# Helper function to check port
check_port() {
    local port=$1
    local description=$2
    local test_connectivity=${3:-false}  # Optional: test connectivity instead of just checking if port appears in ss/netstat
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    echo -n "  ${description}... "
    
    # For Docker containers or when connectivity test is requested, test actual connectivity
    if [ "$test_connectivity" = "true" ]; then
        if timeout 1 bash -c "echo > /dev/tcp/localhost/${port}" 2>/dev/null || nc -z localhost "${port}" 2>/dev/null; then
            echo -e "${GREEN}✅ Accessible${NC}"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
            return 0
        else
            echo -e "${RED}❌ Not accessible${NC}"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            return 1
        fi
    fi
    
    # For regular services, check if port appears in ss/netstat
    if ss -tulnp 2>/dev/null | grep -q ":${port} " || netstat -tlnp 2>/dev/null | grep -q ":${port} "; then
        echo -e "${GREEN}✅ Listening${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        # Fallback: test connectivity if ss/netstat don't show the port (e.g., Docker containers)
        if timeout 1 bash -c "echo > /dev/tcp/localhost/${port}" 2>/dev/null || nc -z localhost "${port}" 2>/dev/null; then
            echo -e "${GREEN}✅ Accessible${NC}"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
            return 0
        else
            echo -e "${RED}❌ Not listening${NC}"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            return 1
        fi
    fi
}

# Helper function to check HTTP endpoint
check_http() {
    local url=$1
    local description=$2
    local expected_status=${3:-200}  # Optional: expected HTTP status code (default: 200)
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    echo -n "  ${description}... "
    
    # Capture both HTTP code and curl exit code
    http_code=$(curl -k -s -o /dev/null -w "%{http_code}" --max-time 3 "${url}" 2>/dev/null)
    curl_exit=$?
    
    # If curl failed completely (exit code != 0), http_code might be empty or "000"
    if [ $curl_exit -ne 0 ] || [ -z "$http_code" ] || [ "$http_code" = "000" ]; then
        echo -e "${RED}❌ Not accessible (connection failed)${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        return 1
    fi
    
    if [ "$http_code" = "$expected_status" ] || [ "$http_code" = "200" ] || [ "$http_code" = "301" ] || [ "$http_code" = "302" ]; then
        echo -e "${GREEN}✅ Accessible (${http_code})${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        # Got a response but wrong status code
        echo -e "${YELLOW}⚠️  Responding but status ${http_code}${NC}"
        WARNING_CHECKS=$((WARNING_CHECKS + 1))
        return 1
    fi
}

# Helper function for warnings
check_warning() {
    local condition=$1
    local description=$2
    local message=$3
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    echo -n "  ${description}... "
    
    if eval "$condition" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ OK${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        echo -e "${YELLOW}⚠️  ${message}${NC}"
        WARNING_CHECKS=$((WARNING_CHECKS + 1))
        return 1
    fi
}

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  🔍 Infrastructure Diagnostic Tool                           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Dev Container IP: ${DEV_CONTAINER_IP}"
echo "Timestamp: $(date)"
echo ""

# Check if dig is available (required for DNS tests)
# dig queries specific DNS servers, unlike getent which uses system resolver
if ! command -v dig >/dev/null 2>&1; then
    echo -e "  ${YELLOW}⚠️  dig not found. DNS tests will be skipped.${NC}"
    echo "    Install with: sudo apt install -y dnsutils"
    echo "    Or run: ./install-system-deps.sh"
    echo ""
fi

# ============================================================================
# Build list of valid environments (exclude observability)
# ============================================================================
VALID_ENVIRONMENTS=()
if [ -d "$LOCAL_DEV_DIR" ]; then
    for env_dir in "${LOCAL_DEV_DIR}"/*/; do
        if [ -d "$env_dir" ]; then
            env_name=$(basename "$env_dir")
            # Skip observability directory (it's for config storage, not an environment)
            if [ "$env_name" != "observability" ]; then
                VALID_ENVIRONMENTS+=("$env_name")
            fi
        fi
    done
fi

# ============================================================================
# Step 1: Environment Information
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📍 Step 1: Environment Information"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ${#VALID_ENVIRONMENTS[@]} -eq 0 ]; then
    echo -e "  ${YELLOW}⚠️  No environments found${NC}"
    echo "    Run: ./create-env.sh <env-name> <domain>"
else
    ENV_COUNT=0
    for env_name in "${VALID_ENVIRONMENTS[@]}"; do
        env_dir="${LOCAL_DEV_DIR}/${env_name}"
        ENV_COUNT=$((ENV_COUNT + 1))
        
        # Get domain
        domain="unknown"
        if [ -f "${env_dir}/.env.ganymede" ]; then
            domain=$(grep "^DOMAIN=" "${env_dir}/.env.ganymede" | cut -d= -f2 | tr -d '"' || echo "unknown")
        fi
        
        # Get workspace
        workspace="unknown"
        if [ -f "${env_dir}/.env.ganymede" ]; then
            workspace=$(grep "^WORKSPACE=" "${env_dir}/.env.ganymede" | cut -d= -f2 | tr -d '"' || echo "unknown")
        fi
        
        echo -e "  Environment: ${CYAN}${env_name}${NC}"
        echo "    Domain: ${domain}"
        echo "    Workspace: ${workspace}"
        
        # Check if services are running
        ganymede_pid=""
        if [ -f "${env_dir}/pids/ganymede.pid" ]; then
            ganymede_pid=$(cat "${env_dir}/pids/ganymede.pid" 2>/dev/null || echo "")
        fi
        
        if [ -n "$ganymede_pid" ] && kill -0 "$ganymede_pid" 2>/dev/null; then
            echo -e "    Ganymede: ${GREEN}✅ Running (PID: ${ganymede_pid})${NC}"
        else
            echo -e "    Ganymede: ${RED}❌ Not running${NC}"
        fi
        echo ""
    done
    echo "  Total environments: ${ENV_COUNT}"
fi

# ============================================================================
# Step 2: Core Services Status
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📍 Step 2: Core Services Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# PostgreSQL
check_service "postgresql" "service postgresql status | grep -q 'online\|running' 2>/dev/null || pgrep -x postgres >/dev/null" "PostgreSQL"
if [ $? -eq 0 ]; then
    # Test database connectivity
    echo -n "    Database connectivity... "
    if PGPASSWORD=devpassword psql -U postgres -h localhost -c "SELECT 1" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Connected${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        echo -e "${RED}❌ Connection failed${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    # Check PowerDNS database
    echo -n "    PowerDNS database... "
    if PGPASSWORD=devpassword psql -U postgres -h localhost -d pdns -c "SELECT 1" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Accessible${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        echo -e "${YELLOW}⚠️  Not accessible${NC}"
        WARNING_CHECKS=$((WARNING_CHECKS + 1))
    fi
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
fi

# Nginx
check_service "nginx" "service nginx status >/dev/null 2>&1 || pgrep -x nginx >/dev/null" "Nginx"
check_port 443 "Port 443 (HTTPS)"

# CoreDNS
check_service "coredns" "pgrep -x coredns >/dev/null" "CoreDNS"
check_port 53 "Port 53 (DNS)"

# PowerDNS
check_service "powerdns" "pgrep -x pdns_server >/dev/null" "PowerDNS"
check_port 5300 "Port 5300 (PowerDNS)"
echo -n "  PowerDNS API... "
if curl -s -f "http://localhost:8081/api/v1/servers" -H "X-API-Key: local-dev-api-key" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Responding${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    echo -e "${RED}❌ Not responding${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

# Build Server (for gateway builds)
echo -n "  Build Server (port 8090)... "
BUILD_SERVER_RUNNING=$(pgrep -f "python3.*http.server.*8090" >/dev/null 2>&1 && echo "yes" || echo "no")
if [ "$BUILD_SERVER_RUNNING" = "yes" ]; then
    echo -e "${GREEN}✅ Running${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    
    # Check if port 8090 is listening
    echo -n "    Port 8090... "
    if ss -tulnp 2>/dev/null | grep -q ":8090 " || netstat -tlnp 2>/dev/null | grep -q ":8090 "; then
        echo -e "${GREEN}✅ Listening${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        
        # Check HTTP connectivity
        echo -n "    HTTP connectivity... "
        if curl -s -f --max-time 2 "http://localhost:8090/" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Accessible${NC}"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
        else
            echo -e "${RED}❌ Not accessible${NC}"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
        fi
        TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
        
        # Check available builds for each environment
        if [ ${#VALID_ENVIRONMENTS[@]} -gt 0 ]; then
            for env_name in "${VALID_ENVIRONMENTS[@]}"; do
                build_file="/root/.local-dev-builds/gateway-${env_name}.tar.gz"
                echo -n "    Build for ${env_name}... "
                if [ -f "$build_file" ]; then
                    build_size=$(du -h "$build_file" | awk '{print $1}')
                    echo -e "${GREEN}✅ Available (${build_size})${NC}"
                    PASSED_CHECKS=$((PASSED_CHECKS + 1))
                    
                    # Test HTTP access to build file
                    build_url="http://${DEV_CONTAINER_IP}:8090/gateway-${env_name}.tar.gz"
                    echo -n "      HTTP access (${build_url})... "
                    if curl -s -f --max-time 2 -I "$build_url" >/dev/null 2>&1; then
                        echo -e "${GREEN}✅ Accessible${NC}"
                        PASSED_CHECKS=$((PASSED_CHECKS + 1))
                    else
                        echo -e "${RED}❌ Not accessible${NC}"
                        FAILED_CHECKS=$((FAILED_CHECKS + 1))
                    fi
                    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
                else
                    echo -e "${YELLOW}⚠️  Not found${NC}"
                    echo "        Run: ./pack-gateway-build.sh ${env_name}"
                    WARNING_CHECKS=$((WARNING_CHECKS + 1))
                fi
                TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
            done
        fi
    else
        echo -e "${RED}❌ Not listening${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
else
    echo -e "${YELLOW}⚠️  Not running${NC}"
    echo "    Run: ./serve-builds.sh &"
    WARNING_CHECKS=$((WARNING_CHECKS + 1))
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

# Check PowerDNS zones for each environment
if [ ${#VALID_ENVIRONMENTS[@]} -gt 0 ]; then
    for env_name in "${VALID_ENVIRONMENTS[@]}"; do
        env_dir="${LOCAL_DEV_DIR}/${env_name}"
        if [ -f "${env_dir}/.env.ganymede" ]; then
            domain=$(grep "^DOMAIN=" "${env_dir}/.env.ganymede" | cut -d= -f2 | tr -d '"' || echo "")
            if [ -n "$domain" ] && [ "$domain" != "unknown" ]; then
                echo -n "  PowerDNS zone '${domain}'... "
                ZONE_RESPONSE=$(curl -s "http://localhost:8081/api/v1/servers/localhost/zones/${domain}." \
                    -H "X-API-Key: local-dev-api-key" 2>/dev/null || echo "")
                if echo "$ZONE_RESPONSE" | grep -q "\"name\"" 2>/dev/null; then
                    echo -e "${GREEN}✅ Exists${NC}"
                    PASSED_CHECKS=$((PASSED_CHECKS + 1))
                    
                    # Try to extract ganymede record from zone
                    ganymede_fqdn="ganymede.${domain}"
                    ZONE_DATA="$ZONE_RESPONSE"
                    POWERDNS_IP=$(echo "$ZONE_DATA" | python3 -c "import sys, json; data=json.load(sys.stdin); \
                        records=[r for r in data.get('rrsets', []) if 'ganymede' in r.get('name', '').lower()]; \
                        print(records[0]['records'][0]['content'] if records and records[0].get('records') else '')" 2>/dev/null || echo "")
                    if [ -z "$POWERDNS_IP" ]; then
                        # Fallback: try sed extraction
                        POWERDNS_IP=$(echo "$ZONE_DATA" | sed -n "s/.*\"name\":\"ganymede\.${domain}\.\".*\"content\":\"\([^\"]*\)\".*/\1/p" | head -1)
                    fi
                    if [ -n "$POWERDNS_IP" ]; then
                        echo -n "    ${ganymede_fqdn} record... "
                        echo -e "${GREEN}✅ ${POWERDNS_IP}${NC}"
                        PASSED_CHECKS=$((PASSED_CHECKS + 1))
                    else
                        echo -n "    ${ganymede_fqdn} record... "
                        echo -e "${YELLOW}⚠️  Not found in zone${NC}"
                        WARNING_CHECKS=$((WARNING_CHECKS + 1))
                    fi
                    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
                else
                    echo -e "${RED}❌ Not found${NC}"
                    FAILED_CHECKS=$((FAILED_CHECKS + 1))
                fi
                TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
            fi
        fi
    done
fi

# ============================================================================
# Step 3: Observability Stack
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📍 Step 3: Observability Stack"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ${GRAY}Note: Observability containers are sibling containers.${NC}"
echo -e "  ${GRAY}Ports are mapped to host and accessible from host OS, not from dev container.${NC}"
echo ""

# Helper function to check observability container
check_observability_container() {
    local container_name=$1
    local service_name=$2
    local http_port=$3
    local health_endpoint=${4:-""}
    
    echo -n "  ${service_name} container... "
    if docker ps --filter "name=${container_name}" --format "{{.Names}}" | grep -q "${container_name}"; then
        echo -e "${GREEN}✅ Running${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
        
        # Check if port is mapped (check Docker port mapping, not connectivity)
        echo -n "    Port ${http_port} mapping... "
        if docker port "${container_name}" 2>/dev/null | grep -q ":${http_port}"; then
            mapped_port=$(docker port "${container_name}" 2>/dev/null | grep ":${http_port}" | head -1 | cut -d: -f2 | cut -d- -f1 || echo "")
            echo -e "${GREEN}✅ Mapped to host${NC}"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
        else
            echo -e "${RED}❌ Not mapped${NC}"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
        fi
        TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
        
        # Check health endpoint if provided (from host perspective, not dev container)
        if [ -n "$health_endpoint" ]; then
            echo -n "    Health check... "
            # Note: This will fail from inside dev container, but we check container status instead
            container_status=$(docker inspect "${container_name}" --format '{{.State.Status}}' 2>/dev/null || echo "unknown")
            if [ "$container_status" = "running" ]; then
                echo -e "${GREEN}✅ Container healthy${NC}"
                PASSED_CHECKS=$((PASSED_CHECKS + 1))
            else
                echo -e "${YELLOW}⚠️  Container status: ${container_status}${NC}"
                WARNING_CHECKS=$((WARNING_CHECKS + 1))
            fi
            TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
        fi
        return 0
    else
        echo -e "${RED}❌ Not running${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
        return 1
    fi
}

# OTLP Collector
check_observability_container "observability-otlp-collector" "OTLP Collector" "4317"
check_observability_container "observability-otlp-collector" "OTLP Collector" "4318"
echo "    Access from host: http://localhost:4318 (HTTP), http://localhost:4317 (gRPC)"

# Loki
check_observability_container "observability-loki" "Loki" "3100" "/ready"
echo "    Access from host: http://localhost:3100"

# Tempo
check_observability_container "observability-tempo" "Tempo" "3200" "/ready"
echo "    Access from host: http://localhost:3200"

# Grafana
check_observability_container "observability-grafana" "Grafana" "3000" "/api/health"
echo "    Access from host: http://localhost:3000 (admin/admin)"

# ============================================================================
# Step 4: Gateway Containers
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📍 Step 4: Gateway Containers"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Get both running and stopped gateway containers
GATEWAY_CONTAINERS=$(docker ps -a --filter "label=environment" --format "{{.Names}}" 2>/dev/null || echo "")

if [ -z "$GATEWAY_CONTAINERS" ]; then
    echo -e "  ${YELLOW}⚠️  No gateway containers found${NC}"
    echo "    Gateways are created automatically when organizations connect"
else
    GATEWAY_COUNT=0
    RUNNING_COUNT=0
    STOPPED_COUNT=0
    
    for container in $GATEWAY_CONTAINERS; do
        GATEWAY_COUNT=$((GATEWAY_COUNT + 1))
        env_name=$(docker inspect "$container" --format '{{index .Config.Labels "environment"}}' 2>/dev/null || echo "unknown")
        gateway_id=$(docker inspect "$container" --format '{{index .Config.Labels "gateway_id"}}' 2>/dev/null || echo "unknown")
        
        echo -e "  Container: ${CYAN}${container}${NC}"
        echo "    Environment: ${env_name}"
        echo "    Gateway ID: ${gateway_id}"
        
        # Check container status
        status=$(docker inspect "$container" --format '{{.State.Status}}' 2>/dev/null || echo "unknown")
        exit_code=$(docker inspect "$container" --format '{{.State.ExitCode}}' 2>/dev/null || echo "")
        
        if [ "$status" = "running" ]; then
            echo -e "    Status: ${GREEN}✅ Running${NC}"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
            RUNNING_COUNT=$((RUNNING_COUNT + 1))
        else
            # Show stopped status with exit code if available
            if [ -n "$exit_code" ] && [ "$exit_code" != "0" ]; then
                echo -e "    Status: ${RED}❌ ${status} (exit code: ${exit_code})${NC}"
            else
                echo -e "    Status: ${YELLOW}⚠️  ${status}${NC}"
            fi
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            STOPPED_COUNT=$((STOPPED_COUNT + 1))
        fi
        TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
        
        # Only show DNS and port info for running containers
        if [ "$status" = "running" ]; then
            # Check DNS config
            dns_server=$(docker inspect "$container" --format '{{range .HostConfig.Dns}}{{.}} {{end}}' 2>/dev/null | awk '{print $1}' || echo "")
            if [ -n "$dns_server" ]; then
                echo "    DNS: ${dns_server}"
            fi
            
            # Check /etc/hosts override (if any environment domain exists)
            if [ ${#VALID_ENVIRONMENTS[@]} -gt 0 ]; then
                first_env="${VALID_ENVIRONMENTS[0]}"
                if [ -f "${LOCAL_DEV_DIR}/${first_env}/.env.ganymede" ]; then
                    domain=$(grep "^DOMAIN=" "${LOCAL_DEV_DIR}/${first_env}/.env.ganymede" | cut -d= -f2 | tr -d '"' || echo "")
                    if [ -n "$domain" ] && [ "$domain" != "unknown" ]; then
                        ganymede_fqdn="ganymede.${domain}"
                        HOSTS_OVERRIDE=$(docker exec "$container" grep "${ganymede_fqdn}" /etc/hosts 2>/dev/null | awk '{print $1}' || echo "")
                        if [ -n "$HOSTS_OVERRIDE" ]; then
                            echo "    /etc/hosts override: ${ganymede_fqdn} → ${HOSTS_OVERRIDE}"
                        fi
                    fi
                fi
            fi
            
            # Check ports
            http_port=$(docker inspect "$container" --format '{{range $p, $conf := .NetworkSettings.Ports}}{{$p}} {{end}}' 2>/dev/null | grep -o '[0-9]*/tcp' | head -1 | cut -d/ -f1 || echo "")
            if [ -n "$http_port" ]; then
                echo "    HTTP Port: ${http_port}"
            fi
        fi
        echo ""
    done
    
    echo -e "  Total gateway containers: ${GATEWAY_COUNT} (${GREEN}${RUNNING_COUNT} running${NC}, ${YELLOW}${STOPPED_COUNT} stopped${NC})"
fi

# ============================================================================
# Step 5: DNS Resolution Tests
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📍 Step 5: DNS Resolution Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Display current resolver configuration
echo "  Current DNS Resolver Configuration:"
if [ -f /etc/resolv.conf ]; then
    echo "    /etc/resolv.conf:"
    # Show non-comment lines with indentation
    grep -v "^#" /etc/resolv.conf | grep -v "^$" | sed 's/^/      /' || echo "      (empty or comments only)"
    
    # Check if it's managed by Docker
    if grep -q "Generated by Docker" /etc/resolv.conf 2>/dev/null; then
        echo -e "    ${GRAY}Note: Managed by Docker Engine${NC}"
    fi
else
    echo "    /etc/resolv.conf: ${RED}❌ Not found${NC}"
fi

# Check systemd-resolved if available
if command -v resolvectl >/dev/null 2>&1; then
    echo "    systemd-resolved status:"
    resolvectl status 2>/dev/null | head -10 | sed 's/^/      /' || echo "      (not available)"
elif [ -d /run/systemd/resolve ]; then
    echo -e "    ${GRAY}systemd-resolved: Configured but resolvectl not available${NC}"
fi

# Note: We don't test container system DNS resolution (getent hosts) because:
# - getent hosts uses /etc/resolv.conf which points to Docker's DNS (192.168.65.7)
# - Docker's DNS doesn't know about local domains (expected behavior)
# - We already test CoreDNS directly with dig @127.0.0.1 (more accurate)
# - We test gateway container DNS separately (which uses CoreDNS via --dns flag)
# - Host OS DNS configuration cannot be tested from inside the container

# Check CoreDNS configuration
if [ -f /etc/coredns/Corefile ]; then
    echo "    CoreDNS configuration:"
    # Show key configuration lines
    grep -E "^(forward|cache|log)" /etc/coredns/Corefile 2>/dev/null | sed 's/^/      /' || echo "      (no key config found)"
fi

echo ""

# Test CoreDNS resolution (using dig to query CoreDNS directly at 127.0.0.1:53)
# Note: dig queries the specified DNS server, unlike getent which uses system resolver
echo -n "  CoreDNS (127.0.0.1:53)... "
if ! command -v dig >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Skipped (dig not available)${NC}"
    WARNING_CHECKS=$((WARNING_CHECKS + 1))
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
else
    # Check if CoreDNS is actually running and bound to port 53
    coredns_running=$(pgrep -x coredns >/dev/null 2>&1 && echo "yes" || echo "no")
    port_listening=$(ss -tulnp 2>/dev/null | grep -q ":53 " && echo "yes" || echo "no")
    
    if [ "$coredns_running" = "no" ]; then
        echo -e "${RED}❌ Failed (CoreDNS not running)${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    elif [ "$port_listening" = "no" ]; then
        echo -e "${RED}❌ Failed (port 53 not listening)${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    else
        result=$(dig @127.0.0.1 -p 53 github.com +short +timeout=2 2>/dev/null | head -1)
        # Check if result is a valid IP address (IPv4)
        if [ -n "$result" ] && [[ "$result" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            echo -e "${GREEN}✅ Resolving external domains (${result})${NC}"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
        else
            # Check if it's a timeout/connection error vs other error
            dig_error=$(dig @127.0.0.1 -p 53 github.com +short +timeout=2 2>&1 | grep -i "communications error\|timeout\|no servers" || echo "")
            if [ -n "$dig_error" ]; then
                echo -e "${RED}❌ Failed (CoreDNS not responding - may need restart)${NC}"
                echo "    Run: sudo killall coredns && sudo coredns -conf /etc/coredns/Corefile &"
            else
                echo -e "${RED}❌ Failed${NC}"
            fi
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
        fi
        TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    fi
fi

# Test PowerDNS resolution (via CoreDNS)
if [ ${#VALID_ENVIRONMENTS[@]} -gt 0 ]; then
    for env_name in "${VALID_ENVIRONMENTS[@]}"; do
        env_dir="${LOCAL_DEV_DIR}/${env_name}"
        if [ -f "${env_dir}/.env.ganymede" ]; then
            domain=$(grep "^DOMAIN=" "${env_dir}/.env.ganymede" | cut -d= -f2 | tr -d '"' || echo "")
            if [ -n "$domain" ] && [ "$domain" != "unknown" ]; then
                ganymede_fqdn="ganymede.${domain}"
                echo -n "  ${ganymede_fqdn}... "
                if ! command -v dig >/dev/null 2>&1; then
                    echo -e "${YELLOW}⚠️  Skipped (dig not available)${NC}"
                    WARNING_CHECKS=$((WARNING_CHECKS + 1))
                    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
                else
                    result=$(dig @127.0.0.1 -p 53 "${ganymede_fqdn}" +short +timeout=2 2>/dev/null | head -1)
                    # Check if result is a valid IP address (IPv4 or IPv6)
                    if [ -n "$result" ] && ([[ "$result" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || [[ "$result" =~ ^[0-9a-fA-F:]+$ ]]); then
                        echo -e "${GREEN}✅ ${result}${NC}"
                        PASSED_CHECKS=$((PASSED_CHECKS + 1))
                    else
                        echo -e "${RED}❌ Failed${NC}"
                        FAILED_CHECKS=$((FAILED_CHECKS + 1))
                    fi
                    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
                fi
            fi
        fi
    done
fi

# Test gateway container DNS (if any)
if [ -n "$GATEWAY_CONTAINERS" ]; then
    FIRST_GATEWAY=$(echo "$GATEWAY_CONTAINERS" | head -1)
    if [ -n "$FIRST_GATEWAY" ]; then
        # Get domain from first environment
        domain="domain.local"
        if [ ${#VALID_ENVIRONMENTS[@]} -gt 0 ]; then
            first_env="${VALID_ENVIRONMENTS[0]}"
            if [ -f "${LOCAL_DEV_DIR}/${first_env}/.env.ganymede" ]; then
                domain=$(grep "^DOMAIN=" "${LOCAL_DEV_DIR}/${first_env}/.env.ganymede" | cut -d= -f2 | tr -d '"' || echo "domain.local")
            fi
        fi
        ganymede_fqdn="ganymede.${domain}"
        echo -n "  Gateway container DNS (${ganymede_fqdn})... "
        result=$(docker exec "$FIRST_GATEWAY" getent hosts "${ganymede_fqdn}" 2>/dev/null | awk '{print $1}' || echo "")
        if [ -n "$result" ]; then
            echo -e "${GREEN}✅ ${result}${NC}"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
        else
            echo -e "${RED}❌ Failed${NC}"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
        fi
        TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
        
        # Test HTTPS connectivity from gateway container
        # Note: DNS resolves ganymede.domain.local → 127.0.0.1 (correct for dev container)
        # But in gateway containers, 127.0.0.1 = gateway container itself, not dev container
        # Solution: Use dev container IP with Host header (how gateway containers actually connect)
        # Use /oauth/public-key endpoint (no auth required, always available)
        echo -n "  Gateway container HTTPS (${ganymede_fqdn})... "
        DEV_CONTAINER_IP=$(hostname -I | awk '{print $1}')
        if docker exec "$FIRST_GATEWAY" curl -k -s -f --max-time 3 -H "Host: ${ganymede_fqdn}" "https://${DEV_CONTAINER_IP}/oauth/public-key" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Connected${NC}"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
        else
            echo -e "${RED}❌ Failed${NC}"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
        fi
        TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    fi
fi

# ============================================================================
# Step 6: HTTPS Connectivity
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📍 Step 6: HTTPS Connectivity"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test Nginx health endpoint (may not exist, so check for any response)
echo -n "  Nginx health endpoint... "
http_code=$(curl -k -s -o /dev/null -w "%{http_code}" --max-time 3 "https://127.0.0.1/health" 2>/dev/null || echo "000")
if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✅ Accessible (${http_code})${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
elif [ "$http_code" != "000" ]; then
    echo -e "${YELLOW}⚠️  Endpoint exists but returns ${http_code} (may not be configured)${NC}"
    WARNING_CHECKS=$((WARNING_CHECKS + 1))
else
    echo -e "${RED}❌ Not accessible${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

# Test environment endpoints
# Note: Dev container's /etc/resolv.conf points to Docker DNS (192.168.65.7), not CoreDNS
# Docker DNS doesn't know about local domains, so DNS resolution fails
# Solution: Use 127.0.0.1 with Host header to bypass DNS (tests actual HTTPS connectivity)
if [ ${#VALID_ENVIRONMENTS[@]} -gt 0 ]; then
    for env_name in "${VALID_ENVIRONMENTS[@]}"; do
        env_dir="${LOCAL_DEV_DIR}/${env_name}"
        if [ -f "${env_dir}/.env.ganymede" ]; then
            domain=$(grep "^DOMAIN=" "${env_dir}/.env.ganymede" | cut -d= -f2 | tr -d '"' || echo "")
            if [ -n "$domain" ] && [ "$domain" != "unknown" ]; then
                # Test frontend (use 127.0.0.1 with Host header to bypass DNS)
                # Note: Frontend is a static site (React SPA), so test root path / instead of /health
                echo -n "  Frontend (${domain})... "
                http_code=$(curl -k -s -o /dev/null -w "%{http_code}" --max-time 3 -H "Host: ${domain}" "https://127.0.0.1/" 2>/dev/null || echo "000")
                if [ "$http_code" = "200" ]; then
                    echo -e "${GREEN}✅ Accessible (${http_code})${NC}"
                    PASSED_CHECKS=$((PASSED_CHECKS + 1))
                elif [ "$http_code" = "403" ]; then
                    # 403 usually means permission denied or frontend not built
                    # Check if frontend directory exists
                    env_dir="${LOCAL_DEV_DIR}/${env_name}"
                    if [ -f "${env_dir}/.env.ganymede" ]; then
                        workspace=$(grep "^WORKSPACE=" "${env_dir}/.env.ganymede" | cut -d= -f2 | tr -d '"' || echo "/root/workspace/monorepo")
                        frontend_dir="${workspace}/packages/app-frontend/dist"
                        if [ ! -d "$frontend_dir" ]; then
                            echo -e "${YELLOW}⚠️  Frontend not built (directory missing: $frontend_dir)${NC}"
                            echo "      Run: ./build-frontend.sh ${env_name}"
                        else
                            echo -e "${YELLOW}⚠️  Permission denied (${http_code}) - check Nginx permissions${NC}"
                        fi
                    else
                        echo -e "${YELLOW}⚠️  Permission denied (${http_code})${NC}"
                    fi
                    WARNING_CHECKS=$((WARNING_CHECKS + 1))
                elif [ "$http_code" != "000" ]; then
                    echo -e "${YELLOW}⚠️  Responding but status ${http_code}${NC}"
                    WARNING_CHECKS=$((WARNING_CHECKS + 1))
                else
                    echo -e "${RED}❌ Not accessible (connection failed)${NC}"
                    FAILED_CHECKS=$((FAILED_CHECKS + 1))
                fi
                TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
                
                # Test Ganymede API (use /oauth/public-key endpoint, no auth required)
                echo -n "  Ganymede API (ganymede.${domain})... "
                http_code=$(curl -k -s -o /dev/null -w "%{http_code}" --max-time 3 -H "Host: ganymede.${domain}" "https://127.0.0.1/oauth/public-key" 2>/dev/null || echo "000")
                if [ "$http_code" = "200" ]; then
                    echo -e "${GREEN}✅ Accessible (${http_code})${NC}"
                    PASSED_CHECKS=$((PASSED_CHECKS + 1))
                elif [ "$http_code" != "000" ]; then
                    echo -e "${YELLOW}⚠️  Responding but status ${http_code}${NC}"
                    WARNING_CHECKS=$((WARNING_CHECKS + 1))
                else
                    echo -e "${RED}❌ Not accessible (connection failed)${NC}"
                    FAILED_CHECKS=$((FAILED_CHECKS + 1))
                fi
                TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
            fi
        fi
    done
fi

# ============================================================================
# Step 7: Network Information
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📍 Step 7: Network Information"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "  Dev Container IP: ${DEV_CONTAINER_IP}"
echo "  Docker bridge gateway: $(ip route show | grep default | awk '{print $3}' || echo 'unknown')"
echo "  Hostname: $(hostname)"

# Get Windows host IP (from WSL2/Docker perspective)
WINDOWS_HOST_IP=$(ip route show | grep default | awk '{print $3}' || echo "")
if [ -n "$WINDOWS_HOST_IP" ] && [ "$WINDOWS_HOST_IP" != "unknown" ]; then
    echo "  Windows Host IP (from container): ${WINDOWS_HOST_IP}"
fi

# Check Docker socket
echo -n "  Docker socket... "
if [ -S /var/run/docker.sock ]; then
    echo -e "${GREEN}✅ Accessible${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    echo -e "${RED}❌ Not accessible${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

# Check Docker daemon
echo -n "  Docker daemon... "
if docker info >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Running${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    echo -e "${RED}❌ Not responding${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

# ============================================================================
# Summary
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

SUCCESS_RATE=0
if [ $TOTAL_CHECKS -gt 0 ]; then
    SUCCESS_RATE=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))
fi

echo "  Total checks: ${TOTAL_CHECKS}"
echo -e "  ${GREEN}✅ Passed: ${PASSED_CHECKS}${NC}"
echo -e "  ${RED}❌ Failed: ${FAILED_CHECKS}${NC}"
echo -e "  ${YELLOW}⚠️  Warnings: ${WARNING_CHECKS}${NC}"
echo "  Success rate: ${SUCCESS_RATE}%"
echo ""

if [ $FAILED_CHECKS -eq 0 ] && [ $WARNING_CHECKS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
elif [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Some warnings, but no critical failures${NC}"
else
    echo -e "${RED}❌ Some checks failed. Review the output above.${NC}"
    echo ""
    echo "Common fixes:"
    echo "  - Start services: ./start-services.sh"
    echo "  - Setup observability: ./setup-observability.sh"
    echo "  - Check service logs: sudo journalctl -u <service>"
    echo "  - Check container logs: docker logs <container-name>"
fi

echo ""

