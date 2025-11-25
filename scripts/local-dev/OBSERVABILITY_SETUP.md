# Observability Infrastructure Setup

This document describes the observability infrastructure setup.

## Overview

The observability stack consists of:

- **OTLP Collector** - Receives logs and traces from all applications
- **Loki** - Stores and indexes logs
- **Tempo** - Stores and indexes traces
- **Grafana** - Web UI for viewing logs and traces

All services run as Docker containers and are **shared across all environments**.

## One-Time Setup

Run the setup script once when setting up local development:

```bash
./scripts/local-dev/setup-observability.sh
```

Or include it in the master setup:

```bash
./scripts/local-dev/setup-all.sh
```

This will:

1. Create Docker volumes for persistent storage
2. Create a Docker network for service communication
3. Deploy OTLP Collector, Loki, Tempo, and Grafana
4. Configure Grafana datasources automatically

## Port Allocation

| Service             | Port | Purpose                       |
| ------------------- | ---- | ----------------------------- |
| OTLP Collector HTTP | 4318 | Receives logs/traces via HTTP |
| OTLP Collector gRPC | 4317 | Receives logs/traces via gRPC |
| Loki                | 3100 | Log storage API               |
| Tempo               | 3200 | Trace storage API             |
| Grafana             | 3000 | Web UI                        |

## Per-Environment Configuration

When you create an environment with `create-env.sh`, the following OTLP configuration is automatically added to `.env.ganymede`:

```bash
OTLP_ENDPOINT_HTTP=http://localhost:4318
OTLP_ENDPOINT_GRPC=http://localhost:4317
OTEL_SERVICE_NAME=ganymede-{env-name}
OTEL_DEPLOYMENT_ENVIRONMENT={env-name}
```

All environments share the same OTLP Collector endpoints. The `OTEL_SERVICE_NAME` and `OTEL_DEPLOYMENT_ENVIRONMENT` variables allow filtering logs/traces by environment in Grafana.

## Accessing Grafana

1. Open browser: http://localhost:3000
2. Login:
   - Username: `admin`
   - Password: `admin` (change on first login)
3. Datasources are pre-configured:
   - **Loki** (default) - For log queries
   - **Tempo** - For trace queries

## Viewing Logs and Traces

### In Grafana

1. **Explore Logs:**

   - Go to Explore → Select "Loki" datasource
   - Use LogQL queries: `{service_name="ganymede-dev-001"}`
   - Filter by environment: `{deployment_environment="dev-001"}`

2. **Explore Traces:**

   - Go to Explore → Select "Tempo" datasource
   - Search by trace ID or service name
   - Click on a trace to see the full request flow

3. **Correlation:**
   - In a trace view, click "View logs" to see related logs
   - In a log view, click "View trace" to see the full request flow

### Via API

**Loki API:**

```bash
curl http://localhost:3100/ready
curl http://localhost:3100/loki/api/v1/labels
```

**Tempo API:**

```bash
curl http://localhost:3200/ready
curl http://localhost:3200/api/search?limit=10
```

## Management Commands

### View Logs

```bash
docker logs observability-otlp-collector
docker logs observability-loki
docker logs observability-tempo
docker logs observability-grafana
```

### Stop Services

```bash
docker stop observability-otlp-collector observability-loki observability-tempo observability-grafana
```

### Start Services

```bash
docker start observability-otlp-collector observability-loki observability-tempo observability-grafana
```

### Check Status

```bash
docker ps --filter "name=observability-"
```

### Remove Services (Data Preserved)

```bash
docker stop observability-otlp-collector observability-loki observability-tempo observability-grafana
docker rm observability-otlp-collector observability-loki observability-tempo observability-grafana
```

### Remove Everything (Including Data)

```bash
docker stop observability-otlp-collector observability-loki observability-tempo observability-grafana
docker rm observability-otlp-collector observability-loki observability-tempo observability-grafana
docker volume rm observability-loki-data observability-tempo-data observability-grafana-data
docker network rm observability-network
```

## Storage

Data is persisted in Docker volumes:

- `observability-loki-data` - Log storage
- `observability-tempo-data` - Trace storage
- `observability-grafana-data` - Grafana configuration and dashboards

Volumes persist across container restarts. To reset everything, remove the volumes (see commands above).

## Configuration Files

Configuration files are stored in `/root/.local-dev/observability/`:

- `otlp-collector-config.yaml` - OTLP Collector configuration
- `tempo-config.yaml` - Tempo configuration
- `grafana/provisioning/datasources/datasources.yaml` - Grafana datasources

## Troubleshooting

### Services Not Starting

1. Check Docker is running: `docker ps`
2. Check port conflicts: `netstat -tulpn | grep -E '4317|4318|3100|3200|3000'`
3. View container logs: `docker logs observability-{service-name}`

### Cannot Connect to OTLP Collector

1. Verify collector is running: `docker ps | grep observability-otlp-collector`
2. Test endpoint: `curl http://localhost:4318`
3. Check network: `docker network inspect observability-network`

### Grafana Not Showing Data

1. Verify datasources are configured: Grafana → Configuration → Data Sources
2. Check Loki is receiving logs: `docker logs observability-loki | tail -20`
3. Check Tempo is receiving traces: `docker logs observability-tempo | tail -20`
4. Verify applications are sending to OTLP Collector (check application logs)
