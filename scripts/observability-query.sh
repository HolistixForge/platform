#!/bin/bash
# Query observability data from Loki and Tempo
# Usage: ./observability-query.sh [command] [options]
#
# This script automatically detects whether it's running:
# - INSIDE a Docker container: Uses dynamic container IPs (resolved at runtime)
# - OUTSIDE Docker (on host): Uses localhost with mapped ports
#
# Why Dynamic IPs Instead of Hardcoded?
# --------------------------------------
# Container IPs on the Docker bridge network (e.g., 172.17.0.2, 172.17.0.3)
# are NOT static and change when containers restart. This script dynamically
# resolves them using `docker inspect` each time it runs.
#
# Note: 172.17.0.1 (the bridge gateway) IS static, which is why it's safe to
# hardcode in .env files for reaching the Docker host from containers.

# Dynamically resolve container IPs or use localhost
# This works whether you're inside or outside the Docker network
function get_container_ip() {
    local container_name=$1
    local fallback_host=$2
    # Use docker inspect to get the CURRENT IP address of the container
    # These IPs are allocated from the Docker bridge network (172.17.0.0/16)
    # and can change on container restart
    local ip=$(docker inspect "$container_name" --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null)
    if [ -n "$ip" ]; then
        echo "$ip"
    else
        echo "$fallback_host"
    fi
}

# Try to detect if we're inside a Docker container
if [ -f /.dockerenv ] || grep -q docker /proc/1/cgroup 2>/dev/null; then
    # Inside Docker: use container IPs or DNS names
    # These IPs are on the Docker bridge network (typically 172.17.0.x)
    GRAFANA_HOST=$(get_container_ip "observability-grafana" "observability-grafana")
    LOKI_HOST=$(get_container_ip "observability-loki" "observability-loki")
    TEMPO_HOST=$(get_container_ip "observability-tempo" "observability-tempo")
else
    # Outside Docker: use localhost (ports are mapped 0.0.0.0:<port> on host)
    GRAFANA_HOST="localhost"
    LOKI_HOST="localhost"
    TEMPO_HOST="localhost"
fi

GRAFANA_URL="http://${GRAFANA_HOST}:3000"
LOKI_URL="http://${LOKI_HOST}:3100"
TEMPO_URL="http://${TEMPO_HOST}:3200"
GRAFANA_USER="admin"
GRAFANA_PASS="admin"

function print_usage() {
    echo "Observability Query Tool"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  logs <service>           Query recent logs for a service"
    echo "  logs-all                 Query all recent logs"
    echo "  traces <service>         Query recent traces for a service"
    echo "  traces-all               Query all recent traces"
    echo "  labels                   List all available log labels"
    echo "  services                 List all services sending telemetry"
    echo "  health                   Check observability stack health"
    echo ""
    echo "Examples:"
    echo "  $0 logs ganymede-dev-001"
    echo "  $0 traces ganymede-dev-001"
    echo "  $0 services"
    echo ""
}

function check_health() {
    echo "🔍 Checking observability stack health..."
    echo ""
    
    echo "Grafana:"
    if curl -s -u "$GRAFANA_USER:$GRAFANA_PASS" "$GRAFANA_URL/api/health" | jq . 2>/dev/null; then
        echo "  ✅ Grafana is healthy"
    else
        echo "  ❌ Grafana is not responding"
    fi
    echo ""
    
    echo "Loki:"
    if curl -s "$LOKI_URL/ready" | grep -q "ready"; then
        echo "  ✅ Loki is ready"
    else
        echo "  ⚠️  Loki status: $(curl -s $LOKI_URL/ready)"
    fi
    echo ""
    
    echo "Tempo:"
    if curl -s "$TEMPO_URL/ready" | grep -q "ready"; then
        echo "  ✅ Tempo is ready"
    else
        echo "  ⚠️  Tempo status: $(curl -s $TEMPO_URL/ready)"
    fi
    echo ""
}

function query_labels() {
    echo "📋 Querying available log labels..."
    echo ""
    curl -s "$LOKI_URL/loki/api/v1/labels" | jq -r '.data[]' 2>/dev/null || echo "No labels found"
    echo ""
}

function query_services() {
    echo "🔍 Querying services..."
    echo ""
    
    echo "From Loki (logs):"
    curl -s "$LOKI_URL/loki/api/v1/label/service_name/values" | jq -r '.data[]' 2>/dev/null || echo "  No services found"
    echo ""
    
    echo "From Tempo (traces):"
    curl -s "$TEMPO_URL/api/v2/search/tag/service.name/values" | jq -r '.tagValues[]' 2>/dev/null || echo "  No services found"
    echo ""
}

function query_logs() {
    local service=$1
    local query="{service_name=\"$service\"}"
    
    if [ -z "$service" ] || [ "$service" = "all" ]; then
        query='{service_name=~".+"}'
    fi
    
    echo "📜 Querying logs: $query"
    echo ""
    
    # Query last 5 minutes
    local now=$(date +%s)000000000
    local start=$(( $(date +%s) - 300 ))000000000
    
    curl -s "$LOKI_URL/loki/api/v1/query_range" \
        -G \
        --data-urlencode "query=$query" \
        --data-urlencode "start=$start" \
        --data-urlencode "end=$now" \
        --data-urlencode "limit=50" \
        | jq -r '.data.result[] | .stream as $stream | .values[] | "\(.[0] | tonumber / 1000000000 | strftime("%Y-%m-%d %H:%M:%S")) [\($stream.service_name // "unknown")] \(.[1])"' 2>/dev/null \
        || echo "No logs found"
    echo ""
}

function query_traces() {
    local service=$1
    local query=""
    
    if [ -n "$service" ] && [ "$service" != "all" ]; then
        query="service.name=$service"
    fi
    
    echo "🔍 Querying traces: $service"
    echo ""
    
    # Query recent traces
    local start=$(( $(date +%s) - 3600 ))  # Last hour
    local end=$(date +%s)
    
    local url="$TEMPO_URL/api/search?start=$start&end=$end&limit=20"
    if [ -n "$query" ]; then
        url="$url&tags=$(echo $query | sed 's/ /%20/g')"
    fi
    
    curl -s "$url" | jq -r '
        if .traces and (.traces | length) > 0 then
            "Found \(.traces | length) traces:\n",
            (.traces[] | "  TraceID: \(.traceID)\n  Root: \(.rootServiceName)\n  Duration: \(.durationMs)ms\n  Spans: \(.spanSet.spans | length)\n")
        else
            "No traces found"
        end
    ' 2>/dev/null || echo "Error querying traces"
    echo ""
}

# Main command router
case "${1:-}" in
    logs)
        query_logs "${2:-all}"
        ;;
    logs-all)
        query_logs "all"
        ;;
    traces)
        query_traces "${2:-all}"
        ;;
    traces-all)
        query_traces "all"
        ;;
    labels)
        query_labels
        ;;
    services)
        query_services
        ;;
    health)
        check_health
        ;;
    ""|--help|-h|help)
        print_usage
        ;;
    *)
        echo "Unknown command: $1"
        echo ""
        print_usage
        exit 1
        ;;
esac

