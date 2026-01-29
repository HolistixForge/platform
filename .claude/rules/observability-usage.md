# Observability Stack Usage

**MANDATORY RULE:** When debugging issues, investigating errors, or analyzing application behavior, use the observability stack to retrieve traces and logs.

## Overview

The project uses:

- **OTLP Collector** - Receives telemetry from applications
- **Loki** - Log storage and querying
- **Tempo** - Distributed trace storage and querying
- **Grafana** - Web UI for visualization

All applications (app-ganymede, app-gateway, app-frontend) are instrumented with OpenTelemetry.

## Quick Start: Observability Query Tool

**Location:** `scripts/observability-query.sh`

Features: Auto-detects environment, dynamically resolves container IPs, direct API access to Loki and Tempo.

## Common Commands

```bash
# Check stack health
./scripts/observability-query.sh health

# List services sending telemetry
./scripts/observability-query.sh services

# Query logs for a service
./scripts/observability-query.sh logs ganymede-dev-001

# Query all logs
./scripts/observability-query.sh logs-all

# Query traces for a service
./scripts/observability-query.sh traces ganymede-dev-001

# Query all traces
./scripts/observability-query.sh traces-all

# List available log labels
./scripts/observability-query.sh labels
```

## When to Use Observability

**ALWAYS check when:**

- User reports an error - check logs for error messages and stack traces
- Debugging performance issues - check traces to find slow operations
- Investigating "not working" issues - verify services are sending telemetry
- After making changes - confirm new code generates expected traces/logs
- Analyzing request flow - use traces for multi-service interactions

**Check BEFORE:**

- Making assumptions about application behavior
- Asking the user for logs (check stack first)
- Concluding "no error occurred" (verify in logs)

## Debugging Workflow

1. **Verify stack**: `./scripts/observability-query.sh health`
2. **Check services**: `./scripts/observability-query.sh services`
3. **Query logs**: `./scripts/observability-query.sh logs-all` or `logs <service>`
4. **Analyze traces**: `./scripts/observability-query.sh traces-all`
5. **Correlate**: Logs include `trace_id` and `span_id` for cross-referencing

## Common Patterns

### Service Not Sending Data

1. Check service is running: `ps aux | grep <service>`
2. Check OTLP env vars: `cat /root/.local-dev/<env>/.env.ganymede | grep OTLP`
3. Check OpenTelemetry init in logs
4. Common fix: Restart service, fix OTLP endpoint (use `172.17.0.1` for dev containers)

### Analyzing Request Errors

1. Query logs for the service
2. Find error message and extract trace_id
3. Query trace for full request flow

### Performance Investigation

1. Query traces, identify high-duration ones
2. Look at span breakdown for slow operations
3. Query logs for that trace_id for context
4. Optimize the bottleneck

## Direct API Usage (Advanced)

Container IPs are dynamic. The script handles this automatically. For manual queries, resolve IPs first:

```bash
docker inspect observability-loki --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'
```

## Environment Details

- **OTLP Endpoint:** `http://172.17.0.1:4318` (Docker gateway from dev container)
- **Grafana UI:** `http://localhost:3000` (from host)
- **Service Names:** Suffixed with environment (e.g., `ganymede-dev-001`)

## Related Documentation

- Architecture: `doc/architecture/LOGGING_AND_OBSERVABILITY.md`
- Setup: `scripts/local-dev/OBSERVABILITY_SETUP.md`
