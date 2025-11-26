/**
 * Browser OpenTelemetry SDK initialization
 *
 * This initializes the OpenTelemetry SDK for browser applications
 * with automatic instrumentation for fetch, XMLHttpRequest, etc.
 */

import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
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
 * Initialize OpenTelemetry for browser applications
 *
 * This should be called once at application startup, before any other code
 * that might be instrumented.
 *
 * @example
 * ```typescript
 * import { initializeBrowserObservability } from '@monorepo/observability/browser';
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

  // Create tracer provider with resource
  tracerProvider = new WebTracerProvider({
    resource,
  });

  // Register the tracer provider
  tracerProvider.register();

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
