/**
 * OpenTelemetry Tracing Initialization
 * 
 * CRITICAL: This file MUST be imported FIRST, before any other application code.
 * It registers OpenTelemetry instrumentations that patch Node.js core modules
 * (http, https, express, etc.) BEFORE they are loaded by the application.
 * 
 * This is required for auto-instrumentation to work correctly.
 */

import { initializeNodeObservability } from '@holistix-forge/observability';
import { Logger } from '@holistix-forge/log';

// Initialize OpenTelemetry with auto-instrumentation
initializeNodeObservability({
  serviceName: process.env.OTEL_SERVICE_NAME || 'ganymede',
  environment: process.env.OTEL_DEPLOYMENT_ENVIRONMENT,
});

console.log('[Tracing] OpenTelemetry initialized and instrumentations registered');

// Initialize Logger to enable OTLP log export
Logger.initialize({
  otlpEndpointHttp: process.env.OTLP_ENDPOINT_HTTP,
  serviceName: process.env.OTEL_SERVICE_NAME || 'ganymede',
});

console.log('[Tracing] Logger initialized for OTLP export');

