/**
 * OpenTelemetry Tracing Initialization for Gateway
 * 
 * CRITICAL: This file MUST be imported FIRST, before any other application code.
 * It registers OpenTelemetry instrumentations that patch Node.js core modules
 * (http, https, express, etc.) BEFORE they are loaded by the application.
 * 
 * This is required for auto-instrumentation to work correctly.
 */

import { initializeNodeObservability } from '@holistix-forge/observability';

// Initialize OpenTelemetry with auto-instrumentation
initializeNodeObservability({
  serviceName: process.env.OTEL_SERVICE_NAME || 'gateway',
  environment: process.env.OTEL_DEPLOYMENT_ENVIRONMENT,
});

console.log('[Tracing] OpenTelemetry initialized and instrumentations registered');

