/**
 * Node.js OpenTelemetry SDK initialization
 *
 * This initializes the OpenTelemetry SDK for Node.js applications
 * with automatic instrumentation for Express, HTTP, PostgreSQL, etc.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { readObservabilityConfig } from '../shared/config';

export interface NodeObservabilityOptions {
  /**
   * Service name (e.g., 'ganymede', 'gateway')
   */
  serviceName: string;
  /**
   * Deployment environment (defaults to OTEL_DEPLOYMENT_ENVIRONMENT env var)
   */
  environment?: string;
  /**
   * Service version (defaults to SERVICE_VERSION env var or '1.0.0')
   */
  version?: string;
  /**
   * Enable auto-instrumentation (default: true)
   */
  enableAutoInstrumentation?: boolean;
}

let sdk: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry for Node.js applications
 *
 * This should be called once at application startup, before any other imports
 * that might be instrumented.
 *
 * @example
 * ```typescript
 * import { initializeNodeObservability } from '@holistix-forge/observability/node';
 *
 * initializeNodeObservability({
 *   serviceName: 'ganymede',
 *   environment: process.env.OTEL_DEPLOYMENT_ENVIRONMENT,
 * });
 * ```
 */
export function initializeNodeObservability(
  options: NodeObservabilityOptions
): NodeSDK {
  if (sdk) {
    console.warn(
      'OpenTelemetry SDK already initialized. Ignoring duplicate initialization.'
    );
    return sdk;
  }

  const config = readObservabilityConfig();

  // Set environment variables for NodeSDK to use
  // NodeSDK reads these automatically for OTLP exporters
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT = config.otlpEndpointHttp;
  process.env.OTEL_EXPORTER_OTLP_PROTOCOL = 'http/protobuf';

  // Build resource attributes
  const resourceAttributes: Record<string, string> = {
    [ATTR_SERVICE_NAME]: options.serviceName,
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]:
      options.environment || config.deploymentEnvironment,
    [ATTR_SERVICE_VERSION]: options.version || config.serviceVersion,
  };

  const resource = resourceFromAttributes(resourceAttributes);

  // Create OTLP exporters
  const traceExporter = new OTLPTraceExporter();
  const logExporter = new OTLPLogExporter();

  // Build SDK configuration
  const sdkConfig: {
    resource: ReturnType<typeof resourceFromAttributes>;
    traceExporter: OTLPTraceExporter;
    logExporter: OTLPLogExporter;
    instrumentations?: any[];
  } = {
    resource,
    traceExporter,
    logExporter,
  };

  // Add auto-instrumentation if enabled
  // MANUAL INSTRUMENTATION: Due to esbuild bundling, auto-instrumentation doesn't work reliably
  // We use explicit manual instrumentation instead
  const instrumentations: any[] = [];

  if (options.enableAutoInstrumentation !== false) {
    // Import instrumentations manually to ensure they're loaded
    const {
      HttpInstrumentation,
    } = require('@opentelemetry/instrumentation-http');
    const {
      ExpressInstrumentation,
    } = require('@opentelemetry/instrumentation-express');

    instrumentations.push(
      new HttpInstrumentation(),
      new ExpressInstrumentation()
    );

    console.log(
      `[Observability] DEBUG: Loaded ${instrumentations.length} manual instrumentations`
    );
    instrumentations.forEach((inst: any) => {
      console.log(
        `[Observability] DEBUG: - ${
          inst.instrumentationName || inst.constructor.name
        }`
      );
    });

    sdkConfig.instrumentations = instrumentations;
  }

  // Create and start SDK
  sdk = new NodeSDK(sdkConfig);

  // CRITICAL: Manually register instrumentations BEFORE SDK starts
  // This ensures Express/HTTP are patched before they're loaded
  console.log(
    '[Observability] DEBUG: Manually registering instrumentations...'
  );
  registerInstrumentations({
    instrumentations: sdkConfig.instrumentations || [],
  });
  console.log(
    '[Observability] DEBUG: Instrumentations registered, starting SDK...'
  );

  sdk.start();

  console.log(
    `[Observability] Initialized for service: ${
      options.serviceName
    }, environment: ${options.environment || config.deploymentEnvironment}`
  );
  console.log(`[Observability] OTLP endpoint: ${config.otlpEndpointHttp}`);
  console.log(
    `[Observability] Trace endpoint: ${config.otlpEndpointHttp}/v1/traces`
  );
  console.log(
    `[Observability] Log endpoint: ${config.otlpEndpointHttp}/v1/logs`
  );

  return sdk;
}

/**
 * Shutdown OpenTelemetry SDK
 *
 * Call this during application shutdown to flush any pending telemetry data.
 */
export async function shutdownNodeObservability(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
  }
}
