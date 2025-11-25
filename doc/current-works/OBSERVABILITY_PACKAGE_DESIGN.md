# Observability Package Design

This document shows what initialization and configuration can be shared across apps, demonstrating why a shared `packages/observability` package is needed.

## Current State: Duplication

### app-ganymede (main.ts)

```typescript
// Lines 35-43
setupBasicExpressApp(app, {
  jaeger: process.env.JAEGER_FQDN
    ? {
        serviceName: 'demiurge',
        serviceTag: 'ganymede',
        host: process.env.JAEGER_FQDN,
      }
    : undefined,
});
```

### app-gateway (main.ts)

```typescript
// Lines 41-49
setupBasicExpressApp(app, {
  jaeger: process.env.JAEGER_FQDN
    ? {
        serviceName: 'demiurge',
        serviceTag: 'collab',
        host: process.env.JAEGER_FQDN,
      }
    : undefined,
});
```

### Current Jaeger Setup (packages/backend-engine/src/lib/Logs/jaeger.ts)

```typescript
// Lines 29-78
export const setupJaegerLog = (
  app: express.Express,
  serviceName: string,
  serviceTag: string,
  host: string
) => {
  const collectorOptions = {
    url: `http://${host}:4318/v1/traces`,
  };

  const provider = new BasicTracerProvider({
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: serviceName,
    }),
  });

  const exporter = new OTLPTraceExporter(collectorOptions);
  provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
  provider.register();

  const tracer = trace.getTracer('esm-tracer');
  
  // Express middleware...
};
```

## Problems with Current Approach

1. **Hardcoded configuration**: Each app manually constructs Jaeger config
2. **Limited functionality**: Only traces, no logs
3. **No auto-instrumentation**: Manual span creation only
4. **Inconsistent**: Different service names/tags per app
5. **No browser support**: Frontend can't use this
6. **Environment variables**: Each app must read `JAEGER_FQDN` separately
7. **No resource attributes**: Missing deployment.environment, service.version, etc.

## What Can Be Shared

### 1. OpenTelemetry SDK Initialization

**Shared Code:**
```typescript
// packages/observability/src/node/init.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_DEPLOYMENT_ENVIRONMENT } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

export function initializeObservability(options: {
  serviceName: string;
  environment?: string;
  version?: string;
}) {
  // Read from environment (same for all apps)
  const otlpEndpointHttp = process.env.OTLP_ENDPOINT_HTTP || 'http://localhost:4318';
  const otlpEndpointGrpc = process.env.OTLP_ENDPOINT_GRPC || 'http://localhost:4317';
  
  // Resource attributes (same structure for all apps)
  const resource = new Resource({
    [SEMRESATTRS_SERVICE_NAME]: options.serviceName,
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: options.environment || process.env.OTEL_DEPLOYMENT_ENVIRONMENT || 'development',
    'service.version': options.version || '1.0.0',
  });

  // OTLP exporters (same configuration)
  const traceExporter = new OTLPTraceExporter({
    url: `${otlpEndpointHttp}/v1/traces`,
  });
  
  const logExporter = new OTLPLogExporter({
    url: `${otlpEndpointHttp}/v1/logs`,
  });

  // SDK initialization (same pattern)
  const sdk = new NodeSDK({
    resource,
    traceExporter,
    logExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Auto-instrument Express, HTTP, PostgreSQL, etc.
        '@opentelemetry/instrumentation-express': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-http': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-pg': {
          enabled: true,
        },
      }),
    ],
  });

  sdk.start();
  return sdk;
}
```

**What's Shared:**
- ✅ Environment variable reading (`OTLP_ENDPOINT_HTTP`, `OTLP_ENDPOINT_GRPC`)
- ✅ Resource attribute structure
- ✅ OTLP exporter configuration
- ✅ Auto-instrumentation setup
- ✅ SDK initialization pattern

**What's Different Per App:**
- ❌ `serviceName` (ganymede vs gateway vs frontend)
- ❌ `environment` (can be overridden, but defaults to env var)

---

### 2. Express Middleware Integration

**Shared Code:**
```typescript
// packages/observability/src/node/express.ts
import express from 'express';
import { trace, context } from '@opentelemetry/api';

export function setupObservabilityMiddleware(app: express.Express) {
  // Auto-instrumentation handles most of this, but we can add custom middleware
  // for trace context propagation, error handling, etc.
  
  app.use((req, res, next) => {
    // Ensure trace context is available
    const span = trace.getActiveSpan();
    if (span) {
      // Add custom attributes
      span.setAttribute('http.route', req.route?.path || req.path);
      span.setAttribute('http.user_agent', req.get('user-agent') || '');
    }
    next();
  });
}
```

**What's Shared:**
- ✅ Trace context propagation
- ✅ Custom span attributes
- ✅ Error handling pattern

**What's Different Per App:**
- ❌ Custom attributes (ganymede might add org_id, gateway might add project_id)

---

### 3. Browser SDK Initialization

**Shared Code:**
```typescript
// packages/observability/src/browser/init.ts
import { WebSDK } from '@opentelemetry/sdk-web';
import { Resource } from '@opentelemetry/resources';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web';

export function initializeBrowserObservability(options: {
  serviceName: string;
  environment?: string;
}) {
  // Read from environment (same pattern as Node.js)
  const otlpEndpointHttp = process.env.OTLP_ENDPOINT_HTTP || 'http://localhost:4318';
  
  const resource = new Resource({
    [SEMRESATTRS_SERVICE_NAME]: options.serviceName,
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: options.environment || 'development',
  });

  const traceExporter = new OTLPTraceExporter({
    url: `${otlpEndpointHttp}/v1/traces`,
  });

  const sdk = new WebSDK({
    resource,
    traceExporter,
    instrumentations: [
      getWebAutoInstrumentations({
        // Auto-instrument fetch, XMLHttpRequest, etc.
      }),
    ],
  });

  sdk.start();
  return sdk;
}
```

**What's Shared:**
- ✅ Same initialization pattern as Node.js
- ✅ Same environment variable reading
- ✅ Same resource structure

**What's Different:**
- ❌ Browser-specific SDK (`WebSDK` vs `NodeSDK`)
- ❌ Different auto-instrumentations (fetch vs Express)

---

## Usage Comparison

### Without Shared Package (Current - Duplicated)

**app-ganymede/main.ts:**
```typescript
// Each app must:
// 1. Read environment variables
// 2. Configure OpenTelemetry
// 3. Set up exporters
// 4. Initialize SDK
// 5. Configure auto-instrumentation
// 6. Set up Express middleware

const otlpEndpoint = process.env.OTLP_ENDPOINT_HTTP || 'http://localhost:4318';
const resource = new Resource({ /* ... */ });
const exporter = new OTLPTraceExporter({ /* ... */ });
const sdk = new NodeSDK({ /* ... */ });
sdk.start();
// ... 50+ lines of setup code
```

**app-gateway/main.ts:**
```typescript
// Same 50+ lines duplicated!
const otlpEndpoint = process.env.OTLP_ENDPOINT_HTTP || 'http://localhost:4318';
const resource = new Resource({ /* ... */ });
// ... exact same code
```

**app-frontend/main.tsx:**
```typescript
// Different SDK but same pattern - more duplication!
const otlpEndpoint = process.env.OTLP_ENDPOINT_HTTP || 'http://localhost:4318';
const resource = new Resource({ /* ... */ });
// ... browser-specific but similar code
```

### With Shared Package (Proposed - DRY)

**app-ganymede/main.ts:**
```typescript
import { initializeObservability } from '@monorepo/observability/node';

// One line!
initializeObservability({
  serviceName: 'ganymede',
  environment: process.env.OTEL_DEPLOYMENT_ENVIRONMENT,
});
```

**app-gateway/main.ts:**
```typescript
import { initializeObservability } from '@monorepo/observability/node';

// One line!
initializeObservability({
  serviceName: 'gateway',
  environment: process.env.OTEL_DEPLOYMENT_ENVIRONMENT,
});
```

**app-frontend/main.tsx:**
```typescript
import { initializeBrowserObservability } from '@monorepo/observability/browser';

// One line!
initializeBrowserObservability({
  serviceName: 'frontend',
  environment: process.env.OTEL_DEPLOYMENT_ENVIRONMENT,
});
```

---

## What Gets Shared vs What's App-Specific

### ✅ Shared (in `packages/observability`)

1. **Environment Variable Reading**
   - `OTLP_ENDPOINT_HTTP`
   - `OTLP_ENDPOINT_GRPC`
   - `OTEL_DEPLOYMENT_ENVIRONMENT`
   - Default values

2. **OTLP Exporter Configuration**
   - URL construction
   - Protocol selection (HTTP vs gRPC)
   - Retry logic
   - Batch configuration

3. **Resource Attributes Structure**
   - `service.name`
   - `deployment.environment`
   - `service.version`
   - Common metadata

4. **Auto-Instrumentation Setup**
   - Express instrumentation config
   - HTTP client instrumentation
   - PostgreSQL instrumentation
   - Browser fetch/XMLHttpRequest instrumentation

5. **SDK Initialization Pattern**
   - SDK creation
   - Exporter registration
   - Instrumentation registration
   - Start/stop lifecycle

6. **Error Handling**
   - Exporter errors
   - SDK initialization errors
   - Graceful degradation

### ❌ App-Specific (passed as parameters)

1. **Service Name**
   - `ganymede` vs `gateway` vs `frontend`
   - Passed as parameter

2. **Environment**
   - Can be overridden per app
   - Defaults to env var (shared)

3. **Custom Attributes**
   - App-specific metadata
   - Added after initialization

4. **Custom Instrumentation**
   - App-specific libraries
   - Added after initialization

---

## Benefits of Shared Package

### 1. **DRY Principle**
- ✅ No code duplication
- ✅ Single source of truth
- ✅ Easier maintenance

### 2. **Consistency**
- ✅ All apps use same configuration
- ✅ Same resource attributes
- ✅ Same exporter settings

### 3. **Easier Updates**
- ✅ Update OpenTelemetry version once
- ✅ Fix bugs once
- ✅ Add features once

### 4. **Better Testing**
- ✅ Test initialization once
- ✅ Mock in one place
- ✅ Integration tests shared

### 5. **Type Safety**
- ✅ Shared TypeScript types
- ✅ Consistent interfaces
- ✅ Better IDE support

---

## Package Structure

```
packages/observability/
├── src/
│   ├── node/
│   │   ├── init.ts              # Node.js SDK initialization
│   │   ├── express.ts            # Express middleware helpers
│   │   └── index.ts             # Node.js exports
│   ├── browser/
│   │   ├── init.ts              # Browser SDK initialization
│   │   └── index.ts             # Browser exports
│   ├── shared/
│   │   ├── config.ts            # Shared configuration reading
│   │   ├── resource.ts          # Resource attribute helpers
│   │   └── types.ts             # Shared TypeScript types
│   └── index.ts                 # Main exports
├── package.json
└── tsconfig.json
```

---

## Summary

**Without shared package:**
- 3 apps × 50+ lines = **150+ lines of duplicated code**
- 3 places to update when OpenTelemetry changes
- 3 places to fix bugs
- Inconsistent configuration

**With shared package:**
- 1 package with shared initialization = **~100 lines total**
- 1 place to update
- 1 place to fix bugs
- Consistent configuration
- **Each app: 1 line to initialize**

The shared package provides **massive value** by eliminating duplication and ensuring consistency across all applications.


