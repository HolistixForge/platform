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
 *
 * IMPORTANT: When running inside Docker containers (dev containers, gateway containers):
 * - OTLP_ENDPOINT_HTTP should be 'http://172.17.0.1:4318'
 * - OTLP_ENDPOINT_GRPC should be 'http://172.17.0.1:4317'
 *
 * 172.17.0.1 is the Docker bridge gateway IP, allowing containers to reach
 * services exposed on the Docker host (where OTLP Collector runs).
 *
 * The 'localhost' defaults below are only used as fallback and won't work
 * correctly from inside containers.
 */
export function readObservabilityConfig(): ObservabilityConfig {
  return {
    otlpEndpointHttp: process.env.OTLP_ENDPOINT_HTTP || 'http://localhost:4318',
    otlpEndpointGrpc: process.env.OTLP_ENDPOINT_GRPC || 'http://localhost:4317',
    deploymentEnvironment:
      process.env.OTEL_DEPLOYMENT_ENVIRONMENT || 'development',
    serviceVersion: process.env.SERVICE_VERSION || '1.0.0',
  };
}
