#!/bin/bash
# Setup observability infrastructure (OTLP Collector, Loki, Tempo, Grafana)
# Run this once in the development container
# Usage: ./setup-observability.sh

set -e

echo "📊 Setting up Observability Infrastructure..."
echo ""
echo "This will deploy:"
echo "  - OTLP Collector (receives logs and traces)"
echo "  - Loki (log storage)"
echo "  - Tempo (trace storage)"
echo "  - Grafana (UI for viewing logs and traces)"
echo ""
echo "All services run as Docker containers and are shared across all environments."
echo ""

# Check Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first."
    echo "   Run: apt-get install -y docker.io"
    exit 1
fi

# Port allocation (avoid conflicts with existing services)
# Existing: 80, 443, 53, 5432, 6000-6999, 7100-7199, 8081, 49100-49199
OTLP_COLLECTOR_HTTP_PORT=4318      # OTLP HTTP receiver (apps send here)
OTLP_COLLECTOR_GRPC_PORT=4317      # OTLP gRPC receiver (apps send here)
LOKI_HTTP_PORT=3100                # Loki API
TEMPO_HTTP_PORT=3200               # Tempo API (for queries)
GRAFANA_PORT=3000                  # Grafana UI

# If all observability containers already exist, assume setup is done and exit
ALL_CONTAINERS_EXIST=true
for c in observability-otlp-collector observability-loki observability-tempo observability-grafana; do
  if ! docker container inspect "$c" >/dev/null 2>&1; then
    ALL_CONTAINERS_EXIST=false
    break
  fi
done

if [ "$ALL_CONTAINERS_EXIST" = true ]; then
  echo "✅ Observability infrastructure already set up (containers exist). Nothing to do."
  echo ""
  echo "📊 Services:"
  echo ""
  echo "   OTLP Collector:"
  echo "     HTTP: http://localhost:${OTLP_COLLECTOR_HTTP_PORT}"
  echo "     gRPC: http://localhost:${OTLP_COLLECTOR_GRPC_PORT}"
  echo ""
  echo "   Loki (Log Storage):"
  echo "     API: http://localhost:${LOKI_HTTP_PORT}"
  echo ""
  echo "   Tempo (Trace Storage):"
  echo "     API: http://localhost:${TEMPO_HTTP_PORT}"
  echo "     (Traces received via OTLP Collector)"
  echo ""
  echo "   Grafana (UI):"
  echo "     URL: http://localhost:${GRAFANA_PORT}"
  echo "     Username: admin"
  echo "     Password: admin"
  echo ""
  exit 0
fi

# Create Docker network for observability services
echo "🌐 Creating Docker network for observability services..."
docker network create observability-network 2>/dev/null || echo "   Network observability-network already exists"

echo "📦 Creating Docker volumes for persistent storage..."
docker volume create observability-loki-data 2>/dev/null || echo "   Volume observability-loki-data already exists"
docker volume create observability-tempo-data 2>/dev/null || echo "   Volume observability-tempo-data already exists"
docker volume create observability-grafana-data 2>/dev/null || echo "   Volume observability-grafana-data already exists"

echo "📦 Creating Docker volumes for configurations..."
docker volume create observability-otel-config 2>/dev/null || echo "   Volume observability-otel-config already exists"
docker volume create observability-tempo-config 2>/dev/null || echo "   Volume observability-tempo-config already exists"
docker volume create observability-grafana-config 2>/dev/null || echo "   Volume observability-grafana-config already exists"

echo "✅ Volumes created"
echo ""

# Stop existing containers if they exist
echo "🛑 Stopping existing observability containers (if any)..."
docker stop observability-otlp-collector observability-loki observability-tempo observability-grafana 2>/dev/null || true
docker rm observability-otlp-collector observability-loki observability-tempo observability-grafana 2>/dev/null || true

echo "✅ Cleaned up existing containers"
echo ""

# Note: We use Docker volumes for configs instead of bind mounts because this dev container
# uses the host's Docker daemon (via socket mount). Bind mounts from the dev container's
# filesystem aren't accessible to the host's Docker daemon. We pipe configs via stdin instead.

# Create OTLP Collector configuration
echo "⚙️  Creating OTLP Collector configuration..."
cat <<'EOF' | docker run --rm -i -v observability-otel-config:/config alpine sh -c "cat > /config/config.yaml"
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 1s
    send_batch_size: 1024

exporters:
  debug:
    verbosity: detailed
  otlp/tempo:
    endpoint: observability-tempo:4317
    tls:
      insecure: true
  otlphttp/loki:
    endpoint: http://observability-loki:3100/otlp

service:
  pipelines:
    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlphttp/loki, debug]
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp/tempo, debug]
EOF

echo "✅ OTLP Collector config created"
echo ""

# Start OTLP Collector (using contrib image for Loki support)
echo "🚀 Starting OTLP Collector..."
docker run -d \
  --name observability-otlp-collector \
  --restart unless-stopped \
  --network observability-network \
  -p ${OTLP_COLLECTOR_HTTP_PORT}:4318 \
  -p ${OTLP_COLLECTOR_GRPC_PORT}:4317 \
  -v observability-otel-config:/config:ro \
  otel/opentelemetry-collector-contrib:latest \
  --config=/config/config.yaml

if [ $? -ne 0 ]; then
    echo "❌ Failed to start OTLP Collector"
    exit 1
fi

echo "✅ OTLP Collector started"
echo "   HTTP endpoint: http://localhost:${OTLP_COLLECTOR_HTTP_PORT}"
echo "   gRPC endpoint: http://localhost:${OTLP_COLLECTOR_GRPC_PORT}"
echo ""

# Start Loki
echo "🚀 Starting Loki..."
docker run -d \
  --name observability-loki \
  --restart unless-stopped \
  --network observability-network \
  -p ${LOKI_HTTP_PORT}:3100 \
  -v observability-loki-data:/loki \
  grafana/loki:latest \
  -config.file=/etc/loki/local-config.yaml

if [ $? -ne 0 ]; then
    echo "❌ Failed to start Loki"
    exit 1
fi

echo "✅ Loki started"
echo "   API endpoint: http://localhost:${LOKI_HTTP_PORT}"
echo ""

# Wait for Loki to be ready
echo "⏳ Waiting for Loki to be ready..."
sleep 5

# Create Tempo configuration
echo "⚙️  Creating Tempo configuration..."
cat <<'EOF' | docker run --rm -i -v observability-tempo-config:/config alpine sh -c "cat > /config/config.yaml"
server:
  http_listen_port: 3200

distributor:
  receivers:
    otlp:
      protocols:
        grpc:
          endpoint: 0.0.0.0:4317
        http:
          endpoint: 0.0.0.0:4318

ingester:
  max_block_duration: 5m

compactor:
  compaction:
    block_retention: 1h

storage:
  trace:
    backend: local
    local:
      path: /var/tempo/traces
    pool:
      max_workers: 100
      queue_depth: 10000
EOF

# Start Tempo (OTLP ports exposed internally via Docker network only)
echo "🚀 Starting Tempo..."
docker run -d \
  --name observability-tempo \
  --restart unless-stopped \
  --network observability-network \
  -p ${TEMPO_HTTP_PORT}:3200 \
  -v observability-tempo-data:/var/tempo \
  -v observability-tempo-config:/config:ro \
  grafana/tempo:latest \
  -config.file=/config/config.yaml

if [ $? -ne 0 ]; then
    echo "❌ Failed to start Tempo"
    exit 1
fi

echo "✅ Tempo started"
echo "   API endpoint: http://localhost:${TEMPO_HTTP_PORT}"
echo "   OTLP gRPC: http://localhost:${TEMPO_OTLP_GRPC_PORT}"
echo "   OTLP HTTP: http://localhost:${TEMPO_OTLP_HTTP_PORT}"
echo ""

# Wait for Tempo to be ready
echo "⏳ Waiting for Tempo to be ready..."
sleep 5

# Create Grafana datasources configuration
echo "⚙️  Creating Grafana datasources configuration..."
docker run --rm -i -v observability-grafana-config:/config alpine sh -c "mkdir -p /config/provisioning/datasources && cat > /config/provisioning/datasources/datasources.yaml" <<'EOF'
apiVersion: 1

datasources:
  - name: Loki
    type: loki
    access: proxy
    url: http://observability-loki:3100
    isDefault: true
    jsonData:
      maxLines: 1000
  - name: Tempo
    type: tempo
    access: proxy
    url: http://observability-tempo:3200
    jsonData:
      httpMethod: GET
      tracesToLogs:
        datasourceUid: Loki
        tags: ['job', 'instance', 'pod', 'namespace']
        mappedTags: [{ key: 'service.name', value: 'service' }]
        mapTagNamesEnabled: false
        spanStartTimeShift: '1h'
        spanEndTimeShift: '1h'
        filterByTraceID: false
        filterBySpanID: false
EOF

echo "✅ Grafana datasources config created"
echo ""

# Start Grafana
echo "🚀 Starting Grafana..."
docker run -d \
  --name observability-grafana \
  --restart unless-stopped \
  --network observability-network \
  -p ${GRAFANA_PORT}:3000 \
  -v observability-grafana-data:/var/lib/grafana \
  -v observability-grafana-config:/config:ro \
  -e GF_PATHS_PROVISIONING=/config/provisioning \
  -e GF_AUTH_ANONYMOUS_ENABLED=true \
  -e GF_AUTH_ANONYMOUS_ORG_ROLE=Admin \
  -e GF_SECURITY_ADMIN_PASSWORD=admin \
  grafana/grafana:latest

if [ $? -ne 0 ]; then
    echo "❌ Failed to start Grafana"
    exit 1
fi

echo "✅ Grafana started"
echo ""

# Wait for Grafana to be ready
echo "⏳ Waiting for Grafana to be ready..."
sleep 10

# Test services
echo "🧪 Testing services..."
echo ""

# Test Loki
if curl -s -f "http://localhost:${LOKI_HTTP_PORT}/ready" > /dev/null 2>&1; then
    echo "✅ Loki is ready"
else
    echo "⚠️  Loki may not be ready yet (this is OK, it may take a moment)"
fi

# Test Tempo
if curl -s -f "http://localhost:${TEMPO_HTTP_PORT}/ready" > /dev/null 2>&1; then
    echo "✅ Tempo is ready"
else
    echo "⚠️  Tempo may not be ready yet (this is OK, it may take a moment)"
fi

# Test Grafana
if curl -s -f "http://localhost:${GRAFANA_PORT}/api/health" > /dev/null 2>&1; then
    echo "✅ Grafana is ready"
else
    echo "⚠️  Grafana may not be ready yet (this is OK, it may take a moment)"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ✅ Observability Infrastructure Setup Complete!             ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Services:"
echo ""
echo "   OTLP Collector:"
echo "     HTTP: http://localhost:${OTLP_COLLECTOR_HTTP_PORT}"
echo "     gRPC: http://localhost:${OTLP_COLLECTOR_GRPC_PORT}"
echo ""
echo "   Loki (Log Storage):"
echo "     API: http://localhost:${LOKI_HTTP_PORT}"
echo ""
echo "   Tempo (Trace Storage):"
echo "     API: http://localhost:${TEMPO_HTTP_PORT}"
echo "     (Traces received via OTLP Collector)"
echo ""
echo "   Grafana (UI):"
echo "     URL: http://localhost:${GRAFANA_PORT}"
echo "     Username: admin"
echo "     Password: admin"
echo ""
echo "📋 Configuration:"
echo ""
echo "   All environments will use these endpoints automatically."
echo "   OTLP endpoints will be added to .env.ganymede when you create environments."
echo ""
echo "   Note: Configs are stored in Docker volumes (not bind mounts) due to"
echo "   Docker-in-Docker architecture. Use 'docker run' commands to inspect configs."
echo ""
echo "📝 Next steps:"
echo ""
echo "   1. Access Grafana: http://localhost:${GRAFANA_PORT}"
echo "      (Login with admin/admin, then change password)"
echo ""
echo "   2. Create your first environment:"
echo "      ./create-env.sh dev-001 domain.local"
echo ""
echo "   3. The environment will automatically be configured to send logs/traces"
echo "      to the OTLP Collector."
echo ""
echo "🔧 Management commands:"
echo ""
echo "   View logs:"
echo "     docker logs observability-otlp-collector"
echo "     docker logs observability-loki"
echo "     docker logs observability-tempo"
echo "     docker logs observability-grafana"
echo ""
echo "   Stop services:"
echo "     docker stop observability-otlp-collector observability-loki observability-tempo observability-grafana"
echo ""
echo "   Start services:"
echo "     docker start observability-otlp-collector observability-loki observability-tempo observability-grafana"
echo ""
echo "   Remove services (data preserved in volumes):"
echo "     docker stop observability-otlp-collector observability-loki observability-tempo observability-grafana"
echo "     docker rm observability-otlp-collector observability-loki observability-tempo observability-grafana"
echo ""
echo "   Remove everything (including data and configs):"
echo "     docker stop observability-otlp-collector observability-loki observability-tempo observability-grafana"
echo "     docker rm observability-otlp-collector observability-loki observability-tempo observability-grafana"
echo "     docker volume rm observability-loki-data observability-tempo-data observability-grafana-data"
echo "     docker volume rm observability-otel-config observability-tempo-config observability-grafana-config"
echo "     docker network rm observability-network"
echo ""

