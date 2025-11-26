## Logging & Observability Architecture

This document describes the **current, implemented** logging and observability design (backend + frontend).  
It replaces the temporary design notes that lived in `doc/current-works/*`.

---

## Goals

- **Centralized telemetry**: all important logs and traces from `app-ganymede`, `app-gateway`, `app-frontend` go to the same stack.
- **Flow tracking**: follow a request end‑to‑end across HTTP, WebSocket, and SQL using traces.
- **Error classification**: distinguish app bugs vs. user errors in logs.
- **AI-/API-friendly**: logs and traces are structured and consistently tagged (future: AI/agent access API).

---

## Stack Overview

- **OpenTelemetry SDK** (Node + Browser)
  - Distributed tracing, context propagation, log correlation.
- **OTLP Collector**
  - Receives OTLP traces/logs from apps and forwards them.
- **Tempo**
  - Trace storage and query (traceQL, Grafana Tempo datasource).
- **Loki**
  - Log storage and query (LogQL, Grafana Loki datasource).
- **Grafana**
  - Unified UI over Loki (logs) and Tempo (traces).

High level:

```text
Apps (Node + Browser)
  ↓ OTLP (HTTP/GRPC)
Collector
  ↓
Tempo (traces) + Loki (logs)
  ↓
Grafana dashboards / APIs
```

---

## Core Principles

### 1. Set Context Once, Correlate Everywhere

- **Context lives on spans**, not in every log record:
  - `user.id`
  - `organization.id`
  - `project.id`
  - gateway IDs, etc.
- Logs only need:
  - `trace_id`
  - `span_id`
  - plus local log metadata (category, message, error info).
- Correlation is done in Grafana/Loki/Tempo via `trace_id`.

### 2. Backend Logs are First‑Class; Frontend Logs are Secondary

- Backend (`app-ganymede`, `app-gateway`, shared libs):
  - **Logs go to Loki via OTLP**, with trace context and error classification.
- Frontend (`app-frontend` + `frontend-data`):
  - Primary telemetry = **traces** (browser OTel SDK).
  - Frontend “logs” are currently **console + optional span events**, not shipped to Loki yet.

### 3. One Shared Initialization per Platform

- Node apps call a shared initializer from `@monorepo/observability`.
- Browser app calls a shared initializer from `@monorepo/observability`.
- All apps share:
  - OTLP endpoint config
  - resource attributes (`service.name`, `deployment.environment`, version)
  - auto‑instrumentation setup.

---

## Backend: Observability & Logging

### 1. Node Observability (`@monorepo/observability`)

**Usage in apps (simplified):**

```ts
import { initializeNodeObservability } from '@monorepo/observability';

initializeNodeObservability({
  serviceName: 'ganymede' | 'gateway' | '...',
  environment: process.env.OTEL_DEPLOYMENT_ENVIRONMENT,
  version: process.env.SERVICE_VERSION,
});
```

What it does (see `packages/observability/src/node/init.ts`):

- Reads OTLP endpoint config (HTTP) from environment.
- Creates a `Resource` with:
  - `service.name`
  - deployment environment
  - `service.version`.
- Configures:
  - **trace exporter** → OTLP `/v1/traces`.
  - **log exporter** → OTLP `/v1/logs`.
- Enables **Node auto‑instrumentations**:
  - Express, HTTP, PostgreSQL, etc.
- Starts `NodeSDK` once per process.

### 2. Logger (`@monorepo/log`)

**Key pieces (`packages/log/src/lib/log.ts`):**

- **Initialization (Node‑only OTLP export):**

```ts
import { Logger } from '@monorepo/log';

Logger.initialize({
  // optional; usually read from env
  otlpEndpointHttp: 'http://localhost:4318',
  serviceName: 'ganymede',
});
```

- **Severity / priority:**

```ts
export enum EPriority {
  Emergency = 'emergency',
  Alert = 'alert',
  Critical = 'critical',
  Error = 'error',
  Warning = 'warning',
  Notice = 'notice',
  Info = 'info',
  Debug = 'debug',
}
```

- **Core API:**

```ts
import { EPriority, log, error } from '@monorepo/log';

log(EPriority.Info, 'CATEGORY', 'message', { structured: 'data' });
error('CATEGORY', 'message', { ... }); // convenience wrapper
```

- **What `log()` does in Node:**
  - Uses the OpenTelemetry **logs SDK** with an OTLP exporter.
  - Extracts the **active span** (`trace.getActiveSpan()`):
    - Attaches `trace_id` and `span_id` to log attributes (if a span exists).
  - Flattens primitive `data` fields into `log.data.*` attributes.
  - Emits a log record to Loki via the collector.

- **What `log()` does in the browser (today):**
  - `Logger.initialize()` bails out in browser (to avoid bundling Node‑only log exporter).
  - `Logger._otlpLogger` therefore stays `null`.
  - The OTLP export branch is skipped → **no log record is sent**.
  - We rely on **traces** and the separate `browserLog` helper (see below) for frontend diagnostics.

### 3. Error Classification (`Exception` classes)

**Location:** `packages/log/src/lib/exceptions.ts`

- All application errors extend a root `Exception` type.
- `Exception` includes:
  - `_uuid` (error instance ID)
  - `httpStatus`
  - `_errors` (public/private details)
  - `errorCategory: APP_ERROR | USER_ERROR | SYSTEM_ERROR`.

The category is derived mostly from the **concrete subclass**:

- `UserException`, `ForbiddenException`, `NotFoundException` → `USER_ERROR`.
- `SystemException` → `SYSTEM_ERROR`.
- Everything else defaults to `APP_ERROR`.

**Express error handler** (`backend-engine/app-setup.ts`) logs:

- `error_uuid`
- `error_category`
- `http_status`
- optional raw error string (for non‑`Exception` errors)
- plus any span context (trace/span, user/org/project attributes).

This gives Grafana/Loki clear dimensions to filter and aggregate by category.

### 4. Span Enrichment & Middleware

**Key idea:** enrich spans progressively as middleware learns more context (sequential enrichment).

- In `setupBasicExpressApp` (shared backend engine):
  - We set **generic HTTP attributes** early:
    - `http.method`
    - `http.route`
    - `http.url`.
  - Optionally, we can infer `project.id` from URL/body when obvious.

- In authentication middleware:
  - `app-gateway` (`jwt-auth.ts`):
    - Sets span attributes:
      - `user.id`
      - `organization.id`
      - `gateway.id`.
  - `app-ganymede` (`auth.ts`):
    - For user tokens:
      - `user.id`
      - `user.username`.
    - For org/gateway tokens:
      - `organization.id`
      - `gateway.id`.

- This matches the **“set context once, correlate everywhere”** principle from the original audit:
  - Logs don’t redundantly store `user_id` / `organization_id` / `project_id`.
  - Instead, they carry `trace_id` / `span_id`, and Grafana can look up the span attributes.

### 5. WebSocket Logging (Gateway)

**Location:** `packages/app-gateway/src/websocket.ts`

We implemented:

- A **`websocket.upgrade` span** for the HTTP upgrade handshake.
- A **`websocket.connection` span** for each YJS WebSocket connection:
  - Attributes:
    - `websocket.room_id`
    - `project.id` (via `ProjectRoomsManager`)
    - `user.id` (from JWT)
    - `websocket.connected` flag
    - Close code + reason on shutdown.
- Structured logs for:
  - Connection success, token expiry, auth failures, and upgrade errors.
  - Classification:
    - Auth failures → effectively `USER_ERROR` in terms of semantics.
    - Upgrade failures → `APP_ERROR`/system side.

This matches the **WebSocket cases** in `LOGGING_AUDIT.md` without repeating all details here.

---

## Frontend: Traces, `browserLog`, and Limits

### 1. Browser Observability (`@monorepo/observability`)

**Usage in `app-frontend/src/main.tsx`:**

```ts
import { initializeBrowserObservability } from '@monorepo/observability';

initializeBrowserObservability({
  serviceName: 'frontend',
  environment:
    (window as any).OTEL_DEPLOYMENT_ENVIRONMENT ??
    import.meta.env.VITE_ENVIRONMENT ??
    'development',
});
```

Implementation (`packages/observability/src/browser/init.ts`):

- Uses `WebTracerProvider` (OTel browser tracing).
- Exports traces via `OTLPTraceExporter` → OTLP `/v1/traces`.
- Enables web auto‑instrumentations:
  - `fetch`
  - `XMLHttpRequest`
  - user interaction instrumentation.
- Registers the tracer provider globally.

Result: **frontend traces** exist and correlate with backend traces via `trace_id`.

### 2. `browserLog` Helper (`@monorepo/frontend-data`)

We introduced a small, browser‑only logging shim that we can later hook into OTLP if needed.

**Location:** `packages/frontend-data/src/lib/browser-log.ts`  
**Exports:** `browserLog` via `@monorepo/frontend-data`.

API:

```ts
browserLog(
  level: 'debug' | 'info' | 'warn' | 'error',
  category: string,
  message: string,
  options?: {
    data?: unknown;
    asSpanEvent?: boolean;
  }
);
```

Behavior:

- Logs a single structured object to the browser console:
  - `{ level, category, message, data? }`.
- Optionally (`asSpanEvent: true`), also attaches a **span event** to the active span:
  - `span.addEvent('browser.log', { 'log.level', 'log.category', 'log.message', 'log.data'? })`.
- Today, **we do not send browser logs to Loki**:
  - This avoids bundler issues with the logs SDK and keeps volume manageable.
  - We rely on traces as the primary frontend telemetry.

Current usages:

- `frontend-data`:
  - `LOCAL_STORAGE_STORE` debug (local storage state machine).
  - `API_CALL` debug around token logic in `GanymedeApi`.
  - `STORY_API_CONTEXT` mock API fetch logs.
- `app-frontend`:
  - `PROJECT_CONTEXT` debug updates (project state + user snapshot).

All of these are **low‑value debug signals**, so `asSpanEvent` is left at its default (`false`).

If we later decide certain frontend failures are critical (e.g. global error boundary, “project load failed” page), we can:

- Switch those specific calls to `asSpanEvent: true`.
- Or implement a small OTLP logs exporter on top of `browserLog` without touching call sites.

---

## What We Did *Not* Implement (Yet)

- No dedicated **logs/trace query API** for AI agents:
  - The endpoints sketched in `LOGGING_STRATEGY.md` (e.g. `/api/logs`, `/api/traces/:traceId`) are **not yet implemented**.
  - When we build them, they should sit on top of Loki/Tempo and return JSON in the log/trace schema outlined there.
- No **browser OTLP logs exporter**:
  - We deliberately avoided shipping `@opentelemetry/sdk-logs` + log exporters in the browser bundle due to Node‑specific dependencies and complexity.
  - `browserLog` is the future integration point for that, if needed.

---

## Relationship to the Temporary Docs

The following design / thinking documents were used to drive this implementation and are now considered **superseded by this file and the code**:

- `doc/current-works/LOGGING_STRATEGY.md`
  - Most relevant parts preserved here:
    - goals
    - stack choice (OTel + Loki + Tempo + Grafana)
    - log/trace schema concepts
    - phased implementation idea (we are mid‑Phase 1 / early Phase 2).
- `doc/current-works/LOGGING_AUDIT.md`
  - Translated into:
    - concrete changes in `backend-engine`, `app-gateway`, `app-ganymede`.
    - the logger’s trace‑aware design.
    - WebSocket and DB logging improvements.
- `doc/current-works/MIDDLEWARE_ANALYSIS.md`
  - Distilled into the **span enrichment** section above (where context lives and how it is set).
- `doc/current-works/OBSERVABILITY_PACKAGE_DESIGN.md`
  - Materialized as the actual `@monorepo/observability` package and the usage patterns described here.

Those files can be safely removed; this document is the canonical overview of logging & observability behavior going forward.


