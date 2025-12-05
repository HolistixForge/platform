/**
 * Node.js OpenTelemetry SDK initialization
 *
 * This initializes the OpenTelemetry SDK for Node.js applications
 * with automatic instrumentation for Express, HTTP, PostgreSQL, etc.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
  SEMRESATTRS_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
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

  // Build resource attributes
  const resourceAttributes: Record<string, string> = {
    [SEMRESATTRS_SERVICE_NAME]: options.serviceName,
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]:
      options.environment || config.deploymentEnvironment,
    [SEMRESATTRS_SERVICE_VERSION]: options.version || config.serviceVersion,
  };

  const resource = resourceFromAttributes(resourceAttributes);

  // Create OTLP exporters
  const traceExporter = new OTLPTraceExporter({
    url: `${config.otlpEndpointHttp}/v1/traces`,
  });

  const logExporter = new OTLPLogExporter({
    url: `${config.otlpEndpointHttp}/v1/logs`,
  });

  // Build SDK configuration
  const sdkConfig: {
    resource: ReturnType<typeof resourceFromAttributes>;
    traceExporter: OTLPTraceExporter;
    logExporter: OTLPLogExporter;
    instrumentations?: ReturnType<typeof getNodeAutoInstrumentations>;
  } = {
    resource,
    traceExporter,
    logExporter,
  };

  // Add auto-instrumentation if enabled
  if (options.enableAutoInstrumentation !== false) {
    sdkConfig.instrumentations = getNodeAutoInstrumentations({
      // Enable Express instrumentation
      '@opentelemetry/instrumentation-express': {
        enabled: true,
      },
      // Enable HTTP instrumentation
      '@opentelemetry/instrumentation-http': {
        enabled: true,
      },
      // Enable PostgreSQL instrumentation
      '@opentelemetry/instrumentation-pg': {
        enabled: true,
      },
      // Enable fs instrumentation (optional, can be disabled if too verbose)
      '@opentelemetry/instrumentation-fs': {
        enabled: false,
      },
    });
  }

  // Create and start SDK
  sdk = new NodeSDK(sdkConfig);
  sdk.start();

  console.log(
    `[Observability] Initialized for service: ${
      options.serviceName
    }, environment: ${options.environment || config.deploymentEnvironment}`
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

