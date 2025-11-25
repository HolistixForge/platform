# Logging Strategy Refactoring - Master Plan

**Status:** Planning Phase  
**Created:** 2025-01-XX  
**Goal:** Centralize all application logs with human-readable UI and AI-agent access, enable complex flow tracking, and distinguish between app errors and user errors.

---

## Executive Summary

This document outlines a comprehensive logging strategy for the Demiurge platform that addresses:

1. **Centralization** - All logs from all apps in one service
2. **Human Access** - Web UI for developers/operators
3. **AI Agent Access** - API for AI tools to read logs, diagnose issues, fix code
4. **Flow Tracking** - Trace requests across Frontend → API → SQL → API → Frontend
5. **Error Classification** - Distinguish app errors (code/resource issues) from user errors (misusage)

---

## Current State Analysis

### Existing Logging Infrastructure

1. **Custom Logger** (`packages/log`)

   - Priority-based logging (Emergency=0 to Debug=7)
   - Console output (stdout/stderr)
   - Browser/Node.js compatible
   - No persistence, no centralization

2. **Error Handling** (`packages/log/src/lib/exceptions.ts`)

   - `Exception` class with `public`/`private` error distinction
   - `UserException` for user misusage (public=true)
   - `UnknownException` for unexpected errors (public=false)
   - Error UUIDs for tracking
   - Already has foundation for error classification

3. **Distributed Tracing** (Partial)

   - Jaeger/OpenTelemetry setup exists (`packages/backend-engine/src/lib/Logs/jaeger.ts`)
   - Only configured for Express middleware
   - Not fully integrated across all apps
   - No correlation with application logs

4. **Current Logging Points**
   - 183+ `console.log/error` calls across 72 files
   - Request logging in Express middleware
   - Gateway state changes
   - Data sync operations
   - Error handlers

### Gaps Identified

- ❌ No centralized log aggregation
- ❌ No persistent storage (logs lost on restart)
- ❌ No correlation between logs from different services
- ❌ No structured format for AI consumption
- ❌ No web UI for log viewing
- ❌ No API for programmatic access
- ❌ Limited trace context propagation
- ❌ No distinction between error types in logs (only in exceptions)

---

## Refined Requirements

### 1. Centralization

**Requirement:** All application logs must end up in a unique service.

**Details:**

- Logs from: `app-frontend`, `app-ganymede`, `app-gateway` (all instances), user containers
- Real-time ingestion (streaming, not batch)
- Persistent storage (retention policy: TBD, suggest 30-90 days)
- High availability (logs should not be lost if service is temporarily down)
- Scalable (handle high-volume during peak usage)

**Scope:**

- Application logs (info, warn, error, debug)
- Request/response logs (HTTP, WebSocket)
- Database query logs (SQL with parameters)
- Error stack traces
- Performance metrics (optional, but recommended)

### 2. Human-Accessible Web UI

**Requirement:** Logs service must be easily consulted by humans via web UI.

**Details:**

- **Search & Filter:**
  - By time range
  - By log level (error, warn, info, debug)
  - By service/app (ganymede, gateway, frontend)
  - By organization/project (multi-tenancy)
  - By trace ID (correlation)
  - By error UUID
  - By user ID (for user-specific flows)
  - Full-text search in log messages
- **Visualization:**
  - Timeline view (logs over time)
  - Trace view (request flow across services)
  - Error aggregation (group similar errors)
  - Service dependency graph (which service called which)
- **Features:**
  - Real-time tail (live log streaming)
  - Export logs (JSON, CSV)
  - Saved searches/filters
  - Alerting (notify on error thresholds)

**User Roles:**

- Developers (full access to all logs)
- Operators (production monitoring)
- Organization admins (logs for their org only - optional)

### 3. AI Agent Access

**Requirement:** Logs service must be easily consulted by AI Agent to see outputs, get errors, fix code, etc.

**Details:**

- **REST API:**
  - Query logs by various filters
  - Get error details with stack traces
  - Get trace context (full request flow)
  - Get aggregated error statistics
  - Search logs semantically (if using vector search)
- **Structured Format:**
  - JSON responses
  - Consistent schema
  - Include code context (file paths, line numbers)
  - Include related logs (same trace, same error UUID)
- **Authentication:**
  - API key or service token
  - Rate limiting
  - Audit trail (who/what accessed logs)

**Use Cases:**

- AI agent reads error logs → identifies bug → suggests fix
- AI agent analyzes performance logs → suggests optimizations
- AI agent reviews user error patterns → suggests UX improvements
- AI agent traces failed request → identifies root cause

### 4. Complex Flow Tracking

**Requirement:** Logs must allow tracking of complex flows like: Frontend → API → SQL → API → Error → Frontend.

**Details:**

- **Distributed Tracing:**
  - Trace ID propagation across all services
  - Span IDs for each operation (HTTP request, SQL query, function call)
  - Parent-child span relationships
  - Timing information (start, end, duration)
- **Context Propagation:**
  - Trace ID in HTTP headers (`X-Trace-Id`)
  - Trace ID in WebSocket messages
  - Trace ID in database query logs
  - Trace ID in frontend logs (via API responses)
- **Correlation:**
  - All logs with same trace ID grouped together
  - Visual trace view showing service calls
  - Timeline of operations
  - Error propagation through trace

**Example Flow:**

```
1. Frontend: POST /api/projects (trace-id: abc123)
2. Ganymede: Received request (trace-id: abc123, span: req-1)
3. Ganymede: SQL query SELECT * FROM projects (trace-id: abc123, span: sql-1, parent: req-1)
4. Ganymede: Call external API (trace-id: abc123, span: http-1, parent: req-1)
5. External API: Error 500 (trace-id: abc123, span: http-1)
6. Ganymede: Error handling (trace-id: abc123, span: req-1)
7. Frontend: Received error response (trace-id: abc123)
```

### 5. Error Classification

**Requirement:** Log mechanism must distinguish between:

- **App Errors** (code bugs, resource issues, connection failures) → Show "Sorry, something went wrong" in UI
- **Nominal Errors** (user misusage, validation errors) → Show relevant user message in frontend UI

**Details:**

- **Error Categories:**

  - `APP_ERROR` - Unexpected code error, resource issue, connection failure
    - Examples: Database connection lost, null pointer exception, out of memory
    - User sees: Generic "Sorry, something went wrong" message
    - Logged with: Full stack trace, context, severity=ERROR
  - `USER_ERROR` - User misusage, validation failure, business rule violation
    - Examples: Invalid email format, insufficient permissions, duplicate name
    - User sees: Specific error message (e.g., "Email format is invalid")
    - Logged with: User-friendly message, severity=WARN or INFO
  - `SYSTEM_ERROR` - Infrastructure issues (optional category)
    - Examples: Service unavailable, timeout, rate limit
    - User sees: Generic message or retry suggestion
    - Logged with: System context, severity=ERROR

- **Implementation:**

  - Extend existing `Exception` class with `errorCategory` field
  - Log structured error metadata (category, userMessage, technicalMessage)
  - Frontend error handler reads category → displays appropriate message
  - Logs service can filter/aggregate by category

- **Logging Strategy:**
  - App errors: Log with full context, stack trace, environment details
  - User errors: Log with user context, input validation details, less verbose
  - Both: Include trace ID for correlation

---

## Proposed Technology Stack

### Option 1: OpenTelemetry + Loki + Grafana (Recommended)

**Architecture:**

```
Apps → OpenTelemetry SDK → OTLP Collector → Loki (logs) + Tempo (traces) → Grafana (UI)
                                                      ↓
                                              PostgreSQL (optional metadata)
```

**Components:**

1. **OpenTelemetry (OTel)**

   - **Purpose:** Instrumentation, trace context propagation, log correlation
   - **SDK:** `@opentelemetry/api`, `@opentelemetry/sdk-node`
   - **Auto-instrumentation:** `@opentelemetry/auto-instrumentations-node` (Express, HTTP, PostgreSQL)
   - **Exporters:** OTLP exporter to collector
   - **Benefits:**
     - Industry standard
     - Automatic instrumentation for common libraries
     - Trace context propagation built-in
     - Supports logs, traces, metrics

2. **OTLP Collector**

   - **Purpose:** Receive, process, route telemetry data
   - **Deployment:** Docker container or standalone service
   - **Processors:**
     - Batch processor (efficiency)
     - Resource processor (add service metadata)
     - Attribute processor (filter/enrich)
   - **Exporters:**
     - Loki exporter (logs)
     - Tempo exporter (traces)
     - Optional: Prometheus (metrics)

3. **Loki (Log Aggregation)**

   - **Purpose:** Store and query logs
   - **Features:**
     - Label-based indexing (service, level, org, trace-id)
     - LogQL query language (similar to PromQL)
     - Efficient storage (compression, retention)
     - Real-time streaming
   - **Deployment:** Single binary or distributed mode

4. **Tempo (Distributed Tracing)**

   - **Purpose:** Store and query traces
   - **Features:**
     - Trace storage (efficient, compressed)
     - TraceQL query language
     - Integration with Loki (trace-to-logs correlation)
   - **Deployment:** Single binary or distributed mode

5. **Grafana (UI)**
   - **Purpose:** Unified dashboard for logs, traces, metrics
   - **Features:**
     - Log exploration (Loki datasource)
     - Trace visualization (Tempo datasource)
     - Dashboard creation
     - Alerting
     - User authentication/authorization
   - **Deployment:** Docker container

**Pros:**

- ✅ Open source, no vendor lock-in
- ✅ Unified observability (logs + traces + metrics)
- ✅ Excellent Grafana UI
- ✅ Efficient storage (Loki/Tempo are optimized)
- ✅ Good documentation and community
- ✅ Can run on-premises or cloud

**Cons:**

- ⚠️ Requires setup and maintenance
- ⚠️ Learning curve for LogQL/TraceQL
- ⚠️ May need tuning for high volume

**Estimated Setup:**

- 3-5 Docker containers (collector, loki, tempo, grafana, optional postgres)
- ~2-4GB RAM, ~50GB disk (depends on retention)

---

### Option 2: ELK Stack (Elasticsearch + Logstash + Kibana)

**Architecture:**

```
Apps → Logstash/Filebeat → Elasticsearch → Kibana (UI)
```

**Components:**

1. **Elasticsearch**

   - **Purpose:** Search and analytics engine
   - **Features:** Full-text search, aggregations, scalable

2. **Logstash/Filebeat**

   - **Purpose:** Log collection and processing
   - **Features:** Parsing, filtering, enrichment

3. **Kibana**
   - **Purpose:** Visualization and dashboard
   - **Features:** Log exploration, APM (Application Performance Monitoring)

**Pros:**

- ✅ Mature, battle-tested
- ✅ Powerful search (full-text, complex queries)
- ✅ APM features (application performance monitoring)
- ✅ Good documentation

**Cons:**

- ⚠️ Resource-intensive (Elasticsearch needs RAM)
- ⚠️ More complex setup
- ⚠️ Licensing costs for advanced features (optional)
- ⚠️ Separate solution for traces (need Jaeger or Elastic APM)

**Estimated Setup:**

- 3-4 Docker containers (elasticsearch, logstash, kibana, optional filebeat)
- ~4-8GB RAM, ~100GB disk

---

### Option 3: Cloud Services (Datadog, New Relic, etc.)

**Architecture:**

```
Apps → Agent/SDK → Cloud Service → Web UI + API
```

**Pros:**

- ✅ Managed service (no maintenance)
- ✅ Excellent UI/UX
- ✅ Built-in alerting, AI insights
- ✅ Easy setup

**Cons:**

- ❌ Cost (per GB ingested, per host)
- ❌ Vendor lock-in
- ❌ Data privacy (logs in cloud)
- ❌ May not meet on-premises requirement

**Estimated Cost:**

- $0.10-0.50 per GB ingested
- $15-50 per host/month
- Can get expensive at scale

---

### Option 4: Custom Solution (PostgreSQL + Express API + React UI)

**Architecture:**

```
Apps → HTTP API → PostgreSQL → Express API → React UI
```

**Components:**

1. **Logging Service** (`app-logs` - new app)

   - Express.js API for log ingestion
   - PostgreSQL for storage
   - REST API for querying
   - WebSocket for real-time streaming

2. **PostgreSQL Schema**

   - `logs` table (structured log entries)
   - `traces` table (trace metadata)
   - `spans` table (individual operations)
   - Indexes on: timestamp, service, level, trace_id, org_id

3. **React UI**
   - Log viewer component
   - Search/filter interface
   - Trace visualization (custom or library)

**Pros:**

- ✅ Full control
- ✅ Uses existing PostgreSQL infrastructure
- ✅ Can customize exactly to needs
- ✅ No external dependencies

**Cons:**

- ❌ Significant development effort
- ❌ Need to build search, indexing, retention
- ❌ Performance challenges at scale
- ❌ Maintenance burden

**Estimated Development:**

- 2-4 weeks for MVP
- Ongoing maintenance

---

## Recommended Solution: OpenTelemetry + Loki + Tempo + Grafana

**Rationale:**

1. **Best fit for requirements:**

   - Centralization ✅
   - Human UI (Grafana) ✅
   - AI API (Loki/Tempo APIs) ✅
   - Flow tracking (Tempo traces) ✅
   - Error classification (structured logs) ✅

2. **Technical advantages:**

   - Industry standard (OpenTelemetry)
   - Efficient storage (Loki/Tempo)
   - Unified observability
   - Good performance at scale

3. **Operational advantages:**

   - Can run on-premises (meets privacy/security)
   - Open source (no licensing costs)
   - Active community and documentation
   - Can migrate to cloud later if needed

4. **Cost:**
   - Free (open source)
   - Infrastructure costs only (compute/storage)

---

## Implementation Plan

### Phase 1: Foundation (Week 1-2)

**Goal:** Set up logging infrastructure and basic instrumentation.

**Tasks:**

1. **Infrastructure Setup**

   - [ ] Deploy OTLP Collector (Docker container)
   - [ ] Deploy Loki (log storage)
   - [ ] Deploy Tempo (trace storage)
   - [ ] Deploy Grafana (UI)
   - [ ] Configure networking (collector endpoint accessible from all apps)
   - [ ] Set up retention policies (30-90 days)

2. **OpenTelemetry SDK Integration**

   - [ ] Install OpenTelemetry packages in monorepo
   - [ ] Create shared OTel configuration package (`packages/observability`)
   - [ ] Configure OTLP exporter (point to collector)
   - [ ] Set up resource attributes (service.name, service.version, etc.)

3. **Basic Instrumentation**

   - [ ] Instrument `app-ganymede` (Express auto-instrumentation)
   - [ ] Instrument `app-gateway` (Express auto-instrumentation)
   - [ ] Instrument `app-frontend` (browser SDK, send to collector)
   - [ ] Test log/trace ingestion

4. **Migration of Existing Logger**
   - [ ] Extend `packages/log` to export to OTLP
   - [ ] Keep console output for development
   - [ ] Add trace context to logs
   - [ ] Update all apps to use enhanced logger

**Deliverables:**

- Logs flowing to Loki
- Traces flowing to Tempo
- Basic Grafana dashboard showing logs
- All apps instrumented

---

### Phase 2: Enhanced Logging (Week 3-4)

**Goal:** Add structured logging, error classification, and context propagation.

**Tasks:**

1. **Structured Logging**

   - [ ] Define log schema (fields: level, message, service, trace_id, span_id, error_category, etc.)
   - [ ] Update logger to include structured fields
   - [ ] Add organization/project context to logs
   - [ ] Add user context (user_id) where applicable

2. **Error Classification**

   - [ ] Extend `Exception` class with `errorCategory` field
   - [ ] Create error categories: `APP_ERROR`, `USER_ERROR`, `SYSTEM_ERROR`
   - [ ] Update error handlers to log with category
   - [ ] Add category to log metadata

3. **Trace Context Propagation**

   - [ ] Ensure trace ID in HTTP headers (`X-Trace-Id`)
   - [ ] Propagate trace ID in WebSocket messages
   - [ ] Add trace ID to database query logs
   - [ ] Test end-to-end trace correlation

4. **Database Query Logging**
   - [ ] Instrument PostgreSQL client (OpenTelemetry PostgreSQL instrumentation)
   - [ ] Log SQL queries with parameters (sanitized)
   - [ ] Include trace ID in query logs
   - [ ] Add query duration metrics

**Deliverables:**

- Structured logs with all context
- Error classification working
- End-to-end trace correlation
- Database queries in traces

---

### Phase 3: Web UI & API (Week 5-6)

**Goal:** Build human-accessible UI and AI-accessible API.

**Tasks:**

1. **Grafana Dashboards**

   - [ ] Create log exploration dashboard
   - [ ] Create trace visualization dashboard
   - [ ] Create error aggregation dashboard
   - [ ] Create service dependency graph
   - [ ] Add filters (time, service, level, org, trace-id)
   - [ ] Configure authentication (basic auth or OAuth)

2. **Loki API Integration**

   - [ ] Create wrapper API in `app-ganymede` or new `app-logs` service
   - [ ] Add authentication (API key)
   - [ ] Expose endpoints:
     - `GET /api/logs` - Query logs
     - `GET /api/logs/:traceId` - Get logs for trace
     - `GET /api/logs/errors` - Get error logs
     - `GET /api/logs/errors/:errorId` - Get specific error
   - [ ] Add rate limiting
   - [ ] Add audit logging (who accessed what)

3. **Tempo API Integration**

   - [ ] Expose trace endpoints:
     - `GET /api/traces/:traceId` - Get full trace
     - `GET /api/traces/search` - Search traces
   - [ ] Add trace-to-logs correlation

4. **Frontend Integration**
   - [ ] Add error display component (reads error category)
   - [ ] Show "Sorry" message for APP_ERROR
   - [ ] Show user message for USER_ERROR
   - [ ] Include error UUID in user-facing errors (for support)

**Deliverables:**

- Grafana dashboards for log/trace viewing
- REST API for programmatic access
- Frontend error handling updated

---

### Phase 4: AI Agent Integration (Week 7-8)

**Goal:** Optimize logs for AI consumption and add semantic search.

**Tasks:**

1. **Structured API Responses**

   - [ ] Ensure all API responses are JSON
   - [ ] Include code context (file, line, function) in error logs
   - [ ] Include related logs (same trace, same error UUID)
   - [ ] Add log summaries/aggregations

2. **Semantic Search (Optional)**

   - [ ] Evaluate vector database (Qdrant, Weaviate, or PostgreSQL pgvector)
   - [ ] Add log embeddings (using LLM or embedding model)
   - [ ] Enable semantic search ("find errors related to database connection")
   - [ ] Add to API: `POST /api/logs/search/semantic`

3. **Error Analysis Endpoints**

   - [ ] `GET /api/logs/errors/analyze/:errorId` - Full error analysis
   - [ ] `GET /api/logs/errors/similar` - Find similar errors
   - [ ] `GET /api/logs/traces/:traceId/analysis` - Trace analysis

4. **Documentation**
   - [ ] API documentation (OpenAPI spec)
   - [ ] Usage examples for AI agents
   - [ ] Best practices guide

**Deliverables:**

- AI-optimized API endpoints
- Semantic search (if implemented)
- Documentation

---

### Phase 5: Optimization & Monitoring (Week 9-10)

**Goal:** Performance tuning, alerting, and production readiness.

**Tasks:**

1. **Performance Optimization**

   - [ ] Tune Loki retention and compression
   - [ ] Optimize indexes (PostgreSQL if used)
   - [ ] Load testing
   - [ ] Monitor resource usage

2. **Alerting**

   - [ ] Configure Grafana alerts (error rate thresholds)
   - [ ] Set up notifications (email, Slack, etc.)
   - [ ] Create alert rules for:
     - High error rate
     - Service downtime
     - Slow queries
     - High log volume

3. **Monitoring**

   - [ ] Add metrics (Prometheus + Grafana)
   - [ ] Monitor log ingestion rate
   - [ ] Monitor storage usage
   - [ ] Monitor API usage (for AI agents)

4. **Documentation & Training**
   - [ ] User guide for Grafana
   - [ ] API documentation for developers/AI
   - [ ] Runbooks for common issues
   - [ ] Training session for team

**Deliverables:**

- Optimized, production-ready system
- Alerting configured
- Documentation complete

---

## Technical Specifications

### Log Schema

```typescript
interface LogEntry {
  timestamp: string; // ISO 8601
  level: 'debug' | 'info' | 'warn' | 'error';
  service: string; // 'ganymede', 'gateway', 'frontend'
  message: string; // Human-readable message
  trace_id?: string; // OpenTelemetry trace ID
  span_id?: string; // OpenTelemetry span ID
  error_category?: 'APP_ERROR' | 'USER_ERROR' | 'SYSTEM_ERROR';
  error_id?: string; // UUID for error tracking
  user_id?: string; // User who triggered (if applicable)
  organization_id?: string; // Organization context
  project_id?: string; // Project context
  metadata?: Record<string, any>; // Additional structured data
  stack_trace?: string; // For errors
  code_context?: {
    // For errors
    file: string;
    line: number;
    function?: string;
  };
}
```

### Trace Schema

```typescript
interface Trace {
  trace_id: string;
  spans: Span[];
  start_time: string;
  end_time: string;
  duration_ms: number;
  service_name: string;
  status: 'success' | 'error';
  error_id?: string;
}

interface Span {
  span_id: string;
  parent_span_id?: string;
  name: string;
  service: string;
  start_time: string;
  end_time: string;
  duration_ms: number;
  attributes: Record<string, any>;
  events: SpanEvent[];
  status: 'success' | 'error';
}

interface SpanEvent {
  name: string;
  timestamp: string;
  attributes: Record<string, any>;
}
```

### API Endpoints (for AI Agents)

```
GET  /api/logs                    # Query logs (filters: time, service, level, trace_id, etc.)
GET  /api/logs/:traceId            # Get all logs for a trace
GET  /api/logs/errors              # Get error logs
GET  /api/logs/errors/:errorId     # Get specific error with context
GET  /api/traces/:traceId          # Get full trace
GET  /api/traces/search            # Search traces
POST /api/logs/search/semantic     # Semantic search (if implemented)
```

---

## Migration Strategy

### Gradual Migration

1. **Phase 1:** Deploy infrastructure, start ingesting logs (parallel to existing console logs)
2. **Phase 2:** Update apps to use new logger (keep console for dev)
3. **Phase 3:** Teams start using Grafana for log viewing
4. **Phase 4:** Deprecate old console.log patterns (add linter rules)
5. **Phase 5:** Remove console.log in production (keep for dev)

### Backward Compatibility

- Keep existing `packages/log` API (extend, don't replace)
- Console output still works in development
- Gradual migration of existing `console.log` calls

---

## Success Criteria

1. ✅ All apps send logs to centralized service
2. ✅ Developers can view logs in Grafana UI
3. ✅ AI agents can query logs via API
4. ✅ End-to-end traces work (Frontend → API → SQL → API → Frontend)
5. ✅ Error classification works (APP_ERROR vs USER_ERROR)
6. ✅ Frontend shows appropriate error messages
7. ✅ Logs retained for 30-90 days
8. ✅ System handles production load
9. ✅ Alerting configured for critical errors

---

## Open Questions

1. **Retention Policy:** How long to keep logs? (Suggest: 30 days for debug/info, 90 days for errors)
2. **Storage Location:** On-premises only, or cloud backup?
3. **Access Control:** Who can view logs? (All devs, or org-scoped?)
4. **Cost:** Infrastructure costs acceptable? (Estimate: ~$50-100/month for small deployment)
5. **Semantic Search:** Is it needed, or is structured search enough?
6. **Metrics:** Should we add Prometheus for metrics, or logs/traces only?

---

## Next Steps

1. **Review this plan** with team
2. **Answer open questions** (retention, access, etc.)
3. **Approve technology stack** (OTel + Loki + Tempo + Grafana recommended)
4. **Allocate resources** (developer time, infrastructure)
5. **Start Phase 1** (infrastructure setup)

---

## References

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Loki Documentation](https://grafana.com/docs/loki/latest/)
- [Tempo Documentation](https://grafana.com/docs/tempo/latest/)
- [Grafana Documentation](https://grafana.com/docs/grafana/latest/)
- [OpenTelemetry Node.js SDK](https://github.com/open-telemetry/opentelemetry-js)

---

**Last Updated:** 2025-01-XX  
**Author:** AI Assistant  
**Status:** Draft - Pending Review







