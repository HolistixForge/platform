/**
 * Shared configuration for reading OpenTelemetry environment variables
 */

export interface ObservabilityConfig {
  otlpEndpointHttp: string;
  otlpEndpointGrpc: string;
  deploymentEnvironment: string;
  serviceVersion: string;
}

/**
 * Read observability configuration from environment variables
 */
export function readObservabilityConfig(): ObservabilityConfig {
  return {
    otlpEndpointHttp:
      process.env.OTLP_ENDPOINT_HTTP || 'http://localhost:4318',
    otlpEndpointGrpc:
      process.env.OTLP_ENDPOINT_GRPC || 'http://localhost:4317',
    deploymentEnvironment:
      process.env.OTEL_DEPLOYMENT_ENVIRONMENT || 'development',
    serviceVersion: process.env.SERVICE_VERSION || '1.0.0',
  };
}


