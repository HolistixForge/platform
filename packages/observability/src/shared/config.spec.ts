/**
 * Tests for observability configuration reader
 *
 * Tests environment variable reading and default fallback values
 * for OpenTelemetry configuration.
 */

import { readObservabilityConfig, ObservabilityConfig } from './config';

describe('readObservabilityConfig', () => {
  // Store original env vars to restore after each test
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore original environment after each test
    process.env = { ...originalEnv };
  });

  describe('default values', () => {
    it('should return default localhost endpoints when no env vars are set', () => {
      // Clear all observability-related env vars
      delete process.env.OTLP_ENDPOINT_HTTP;
      delete process.env.OTLP_ENDPOINT_GRPC;
      delete process.env.OTEL_DEPLOYMENT_ENVIRONMENT;
      delete process.env.SERVICE_VERSION;

      const config = readObservabilityConfig();

      expect(config).toEqual({
        otlpEndpointHttp: 'http://localhost:4318',
        otlpEndpointGrpc: 'http://localhost:4317',
        deploymentEnvironment: 'development',
        serviceVersion: '1.0.0',
      });
    });

    it('should use default HTTP endpoint when OTLP_ENDPOINT_HTTP is not set', () => {
      delete process.env.OTLP_ENDPOINT_HTTP;
      process.env.OTLP_ENDPOINT_GRPC = 'http://custom:4317';
      process.env.OTEL_DEPLOYMENT_ENVIRONMENT = 'test';
      process.env.SERVICE_VERSION = '2.0.0';

      const config = readObservabilityConfig();

      expect(config.otlpEndpointHttp).toBe('http://localhost:4318');
    });

    it('should use default gRPC endpoint when OTLP_ENDPOINT_GRPC is not set', () => {
      process.env.OTLP_ENDPOINT_HTTP = 'http://custom:4318';
      delete process.env.OTLP_ENDPOINT_GRPC;
      process.env.OTEL_DEPLOYMENT_ENVIRONMENT = 'test';
      process.env.SERVICE_VERSION = '2.0.0';

      const config = readObservabilityConfig();

      expect(config.otlpEndpointGrpc).toBe('http://localhost:4317');
    });

    it('should use default deployment environment when OTEL_DEPLOYMENT_ENVIRONMENT is not set', () => {
      process.env.OTLP_ENDPOINT_HTTP = 'http://custom:4318';
      process.env.OTLP_ENDPOINT_GRPC = 'http://custom:4317';
      delete process.env.OTEL_DEPLOYMENT_ENVIRONMENT;
      process.env.SERVICE_VERSION = '2.0.0';

      const config = readObservabilityConfig();

      expect(config.deploymentEnvironment).toBe('development');
    });

    it('should use default service version when SERVICE_VERSION is not set', () => {
      process.env.OTLP_ENDPOINT_HTTP = 'http://custom:4318';
      process.env.OTLP_ENDPOINT_GRPC = 'http://custom:4317';
      process.env.OTEL_DEPLOYMENT_ENVIRONMENT = 'test';
      delete process.env.SERVICE_VERSION;

      const config = readObservabilityConfig();

      expect(config.serviceVersion).toBe('1.0.0');
    });
  });

  describe('environment variable override', () => {
    it('should read OTLP_ENDPOINT_HTTP from environment', () => {
      process.env.OTLP_ENDPOINT_HTTP = 'http://custom-host:8080';

      const config = readObservabilityConfig();

      expect(config.otlpEndpointHttp).toBe('http://custom-host:8080');
    });

    it('should read OTLP_ENDPOINT_GRPC from environment', () => {
      process.env.OTLP_ENDPOINT_GRPC = 'http://custom-host:9090';

      const config = readObservabilityConfig();

      expect(config.otlpEndpointGrpc).toBe('http://custom-host:9090');
    });

    it('should read OTEL_DEPLOYMENT_ENVIRONMENT from environment', () => {
      process.env.OTEL_DEPLOYMENT_ENVIRONMENT = 'production';

      const config = readObservabilityConfig();

      expect(config.deploymentEnvironment).toBe('production');
    });

    it('should read SERVICE_VERSION from environment', () => {
      process.env.SERVICE_VERSION = '3.2.1';

      const config = readObservabilityConfig();

      expect(config.serviceVersion).toBe('3.2.1');
    });

    it('should read all environment variables when set', () => {
      process.env.OTLP_ENDPOINT_HTTP = 'http://collector:4318';
      process.env.OTLP_ENDPOINT_GRPC = 'http://collector:4317';
      process.env.OTEL_DEPLOYMENT_ENVIRONMENT = 'staging';
      process.env.SERVICE_VERSION = '2.5.0';

      const config = readObservabilityConfig();

      expect(config).toEqual({
        otlpEndpointHttp: 'http://collector:4318',
        otlpEndpointGrpc: 'http://collector:4317',
        deploymentEnvironment: 'staging',
        serviceVersion: '2.5.0',
      });
    });
  });

  describe('Docker container configuration', () => {
    it('should work with Docker bridge gateway IP for HTTP endpoint', () => {
      // This is the typical configuration for containers
      process.env.OTLP_ENDPOINT_HTTP = 'http://172.17.0.1:4318';
      process.env.OTLP_ENDPOINT_GRPC = 'http://172.17.0.1:4317';

      const config = readObservabilityConfig();

      expect(config.otlpEndpointHttp).toBe('http://172.17.0.1:4318');
      expect(config.otlpEndpointGrpc).toBe('http://172.17.0.1:4317');
    });

    it('should work with localhost for non-container environments', () => {
      process.env.OTLP_ENDPOINT_HTTP = 'http://localhost:4318';
      process.env.OTLP_ENDPOINT_GRPC = 'http://localhost:4317';

      const config = readObservabilityConfig();

      expect(config.otlpEndpointHttp).toBe('http://localhost:4318');
      expect(config.otlpEndpointGrpc).toBe('http://localhost:4317');
    });
  });

  describe('various deployment environments', () => {
    const environments = [
      'development',
      'staging',
      'production',
      'test',
      'local',
      'ci',
    ];

    environments.forEach((env) => {
      it(`should accept ${env} as deployment environment`, () => {
        process.env.OTEL_DEPLOYMENT_ENVIRONMENT = env;

        const config = readObservabilityConfig();

        expect(config.deploymentEnvironment).toBe(env);
      });
    });
  });

  describe('service version formats', () => {
    const versions = ['1.0.0', '2.3.4-beta', '0.0.1-alpha.1', 'latest', 'dev'];

    versions.forEach((version) => {
      it(`should accept ${version} as service version`, () => {
        process.env.SERVICE_VERSION = version;

        const config = readObservabilityConfig();

        expect(config.serviceVersion).toBe(version);
      });
    });
  });

  describe('empty string handling', () => {
    it('should use default when OTLP_ENDPOINT_HTTP is empty string', () => {
      process.env.OTLP_ENDPOINT_HTTP = '';

      const config = readObservabilityConfig();

      // Empty string is falsy, so should use default
      expect(config.otlpEndpointHttp).toBe('http://localhost:4318');
    });

    it('should use default when OTLP_ENDPOINT_GRPC is empty string', () => {
      process.env.OTLP_ENDPOINT_GRPC = '';

      const config = readObservabilityConfig();

      expect(config.otlpEndpointGrpc).toBe('http://localhost:4317');
    });

    it('should use default when OTEL_DEPLOYMENT_ENVIRONMENT is empty string', () => {
      process.env.OTEL_DEPLOYMENT_ENVIRONMENT = '';

      const config = readObservabilityConfig();

      expect(config.deploymentEnvironment).toBe('development');
    });

    it('should use default when SERVICE_VERSION is empty string', () => {
      process.env.SERVICE_VERSION = '';

      const config = readObservabilityConfig();

      expect(config.serviceVersion).toBe('1.0.0');
    });
  });

  describe('URL format variations', () => {
    it('should accept HTTP URLs', () => {
      process.env.OTLP_ENDPOINT_HTTP = 'http://collector:4318';

      const config = readObservabilityConfig();

      expect(config.otlpEndpointHttp).toBe('http://collector:4318');
    });

    it('should accept HTTPS URLs', () => {
      process.env.OTLP_ENDPOINT_HTTP = 'https://collector.example.com:4318';

      const config = readObservabilityConfig();

      expect(config.otlpEndpointHttp).toBe(
        'https://collector.example.com:4318'
      );
    });

    it('should accept URLs with paths', () => {
      process.env.OTLP_ENDPOINT_HTTP =
        'http://collector.example.com:4318/v1/traces';

      const config = readObservabilityConfig();

      expect(config.otlpEndpointHttp).toBe(
        'http://collector.example.com:4318/v1/traces'
      );
    });

    it('should accept URLs without port specified', () => {
      process.env.OTLP_ENDPOINT_HTTP = 'http://collector.example.com';

      const config = readObservabilityConfig();

      expect(config.otlpEndpointHttp).toBe('http://collector.example.com');
    });

    it('should accept IP addresses as hosts', () => {
      process.env.OTLP_ENDPOINT_HTTP = 'http://192.168.1.100:4318';
      process.env.OTLP_ENDPOINT_GRPC = 'http://192.168.1.100:4317';

      const config = readObservabilityConfig();

      expect(config.otlpEndpointHttp).toBe('http://192.168.1.100:4318');
      expect(config.otlpEndpointGrpc).toBe('http://192.168.1.100:4317');
    });
  });

  describe('return type', () => {
    it('should return an object with all required fields', () => {
      const config = readObservabilityConfig();

      expect(config).toHaveProperty('otlpEndpointHttp');
      expect(config).toHaveProperty('otlpEndpointGrpc');
      expect(config).toHaveProperty('deploymentEnvironment');
      expect(config).toHaveProperty('serviceVersion');
    });

    it('should return strings for all fields', () => {
      const config = readObservabilityConfig();

      expect(typeof config.otlpEndpointHttp).toBe('string');
      expect(typeof config.otlpEndpointGrpc).toBe('string');
      expect(typeof config.deploymentEnvironment).toBe('string');
      expect(typeof config.serviceVersion).toBe('string');
    });

    it('should match ObservabilityConfig interface', () => {
      const config: ObservabilityConfig = readObservabilityConfig();

      // TypeScript will catch if this doesn't match the interface
      expect(config).toBeDefined();
    });
  });

  describe('real-world scenarios', () => {
    it('should handle local development setup', () => {
      delete process.env.OTLP_ENDPOINT_HTTP;
      delete process.env.OTLP_ENDPOINT_GRPC;
      process.env.OTEL_DEPLOYMENT_ENVIRONMENT = 'local';
      process.env.SERVICE_VERSION = 'dev';

      const config = readObservabilityConfig();

      expect(config).toEqual({
        otlpEndpointHttp: 'http://localhost:4318',
        otlpEndpointGrpc: 'http://localhost:4317',
        deploymentEnvironment: 'local',
        serviceVersion: 'dev',
      });
    });

    it('should handle production deployment', () => {
      process.env.OTLP_ENDPOINT_HTTP = 'https://otel-collector.prod.com:4318';
      process.env.OTLP_ENDPOINT_GRPC = 'https://otel-collector.prod.com:4317';
      process.env.OTEL_DEPLOYMENT_ENVIRONMENT = 'production';
      process.env.SERVICE_VERSION = '1.5.2';

      const config = readObservabilityConfig();

      expect(config).toEqual({
        otlpEndpointHttp: 'https://otel-collector.prod.com:4318',
        otlpEndpointGrpc: 'https://otel-collector.prod.com:4317',
        deploymentEnvironment: 'production',
        serviceVersion: '1.5.2',
      });
    });

    it('should handle dev container setup with Docker bridge IP', () => {
      process.env.OTLP_ENDPOINT_HTTP = 'http://172.17.0.1:4318';
      process.env.OTLP_ENDPOINT_GRPC = 'http://172.17.0.1:4317';
      process.env.OTEL_DEPLOYMENT_ENVIRONMENT = 'local-dev';
      process.env.SERVICE_VERSION = '1.0.0-dev';

      const config = readObservabilityConfig();

      expect(config).toEqual({
        otlpEndpointHttp: 'http://172.17.0.1:4318',
        otlpEndpointGrpc: 'http://172.17.0.1:4317',
        deploymentEnvironment: 'local-dev',
        serviceVersion: '1.0.0-dev',
      });
    });

    it('should handle CI/CD environment', () => {
      process.env.OTLP_ENDPOINT_HTTP = 'http://otel-collector:4318';
      process.env.OTLP_ENDPOINT_GRPC = 'http://otel-collector:4317';
      process.env.OTEL_DEPLOYMENT_ENVIRONMENT = 'ci';
      process.env.SERVICE_VERSION = '1.2.3-ci.456';

      const config = readObservabilityConfig();

      expect(config).toEqual({
        otlpEndpointHttp: 'http://otel-collector:4318',
        otlpEndpointGrpc: 'http://otel-collector:4317',
        deploymentEnvironment: 'ci',
        serviceVersion: '1.2.3-ci.456',
      });
    });
  });
});
