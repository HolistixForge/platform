/**
 * Browser OpenTelemetry SDK initialization
 *
 * This initializes the OpenTelemetry SDK for browser applications
 * with automatic instrumentation for fetch, XMLHttpRequest, etc.
 */

import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
  SEMRESATTRS_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web';

export interface BrowserObservabilityOptions {
  /**
   * Service name (e.g., 'frontend')
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
   * OTLP endpoint URL (e.g., 'http://localhost:4318')
   * If not provided, defaults to 'http://localhost:4318'
   * The path '/v1/traces' will be automatically appended if not present
   */
  otlpEndpoint?: string;
  /**
   * Enable auto-instrumentation (default: true)
   */
  enableAutoInstrumentation?: boolean;
}

let tracerProvider: WebTracerProvider | null = null;

/**
 * Read deployment environment from environment or use default
 */
function getDeploymentEnvironment(): string {
  if (
    typeof window !== 'undefined' &&
    (window as any).OTEL_DEPLOYMENT_ENVIRONMENT
  ) {
    return (window as any).OTEL_DEPLOYMENT_ENVIRONMENT;
  }
  return 'development';
}

/**
 * Read OTLP endpoint from environment variables
 *
 * In browser context:
 * - Vite injects import.meta.env at build time (not available at runtime in packages)
 * - Application code passes OTLP endpoint via initializeBrowserObservability options
 * - We use localhost (not 172.17.0.1) because browser runs on host, not in container
 * - OTLP Collector is exposed on host's localhost:4318
 */
function getOtlpEndpoint(providedEndpoint?: string): string {
  // Use provided endpoint from application
  if (providedEndpoint) {
    // Ensure endpoint includes /v1/traces path
    if (!providedEndpoint.includes('/v1/traces')) {
      return `${providedEndpoint}/v1/traces`;
    }
    return providedEndpoint;
  }

  // Fallback to localhost (browser runs on host, not in container)
  return 'http://localhost:4318/v1/traces';
}

/**
 * Initialize OpenTelemetry for browser applications
 *
 * This should be called once at application startup, before any other code
 * that might be instrumented.
 *
 * @example
 * ```typescript
 * import { initializeBrowserObservability } from '@holistix-forge/observability/browser';
 *
 * initializeBrowserObservability({
 *   serviceName: 'frontend',
 * });
 * ```
 */
export function initializeBrowserObservability(
  options: BrowserObservabilityOptions
): WebTracerProvider {
  if (tracerProvider) {
    // Log warning (using console.warn as this is SDK initialization, before Logger is available)
    console.warn(
      'OpenTelemetry SDK already initialized. Ignoring duplicate initialization.'
    );
    return tracerProvider;
  }

  const deploymentEnvironment = getDeploymentEnvironment();

  // Build resource attributes
  const resourceAttributes: Record<string, string> = {
    [SEMRESATTRS_SERVICE_NAME]: options.serviceName,
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]:
      options.environment || deploymentEnvironment,
    [SEMRESATTRS_SERVICE_VERSION]: options.version || '1.0.0',
  };

  const resource = resourceFromAttributes(resourceAttributes);

  // Get OTLP endpoint for exporting traces
  const otlpEndpoint = getOtlpEndpoint(options.otlpEndpoint);

  // Create OTLP exporter for sending traces to collector
  const traceExporter = new OTLPTraceExporter({
    url: otlpEndpoint,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Create span processor for batching and exporting traces
  const spanProcessor = new BatchSpanProcessor(traceExporter);

  // Create tracer provider with resource and span processor
  // The span processor is configured in the constructor to ensure
  // all spans are exported to OTLP Collector
  tracerProvider = new WebTracerProvider({
    resource,
    spanProcessors: [spanProcessor],
  });

  // Register the tracer provider
  tracerProvider.register();

  console.log(
    `[Observability] Browser SDK configured to send traces to: ${otlpEndpoint}`
  );

  // Add auto-instrumentation if enabled
  if (options.enableAutoInstrumentation !== false) {
    const instrumentations = getWebAutoInstrumentations({
      // Enable fetch instrumentation
      '@opentelemetry/instrumentation-fetch': {
        enabled: true,
      },
      // Enable XMLHttpRequest instrumentation
      '@opentelemetry/instrumentation-xml-http-request': {
        enabled: true,
      },
      // Enable user interaction instrumentation
      '@opentelemetry/instrumentation-user-interaction': {
        enabled: true,
      },
    });
    // Register instrumentations
    instrumentations.forEach((instrumentation) => {
      instrumentation.setTracerProvider(tracerProvider!);
    });
  }

  // Log initialization (using console.log as this is SDK initialization, before Logger is available)
  console.log(
    `[Observability] Initialized for service: ${
      options.serviceName
    }, environment: ${options.environment || deploymentEnvironment}`
  );

  return tracerProvider;
}

/**
 * Shutdown OpenTelemetry SDK
 *
 * Call this during application shutdown to flush any pending telemetry data.
 */
export async function shutdownBrowserObservability(): Promise<void> {
  if (tracerProvider) {
    await tracerProvider.shutdown();
    tracerProvider = null;
  }
}
