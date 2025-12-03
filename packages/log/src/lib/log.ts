import { TJson } from '@holistix/shared-types';
import { trace } from '@opentelemetry/api';
import {
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

//
//

export enum EPriority {
  Emergency = 'emergency',
  Alert = 'alert',
  Critical = 'critical',
  Error = 'error',
  Warning = 'warning',
  Notice = 'notice',
  Info = 'info',
  Debug = 'debug',
}

//
//

//
//

// Map EPriority to OpenTelemetry SeverityNumber
const priorityToSeverityNumber = (p: EPriority): number => {
  // OpenTelemetry SeverityNumber: TRACE=1-4, DEBUG=5-8, INFO=9-12, WARN=13-16, ERROR=17-20, FATAL=21-24
  switch (p) {
    case EPriority.Emergency:
    case EPriority.Alert:
    case EPriority.Critical:
      return 21; // FATAL
    case EPriority.Error:
      return 17; // ERROR
    case EPriority.Warning:
      return 13; // WARN
    case EPriority.Notice:
    case EPriority.Info:
      return 9; // INFO
    case EPriority.Debug:
      return 5; // DEBUG
    default:
      return 9; // INFO
  }
};

export interface LoggerInitOptions {
  otlpEndpointHttp?: string;
  serviceName?: string;
}

export class Logger {
  private static _loggerProvider: LoggerProvider | null = null;
  private static _otlpLogger: any | null = null;

  /**
   * Initialize the Logger with OpenTelemetry OTLP exporter
   * This should be called once at application startup
   *
   * @param options - Configuration options for the logger
   */
  static initialize(options?: LoggerInitOptions): void {
    if (Logger._loggerProvider) {
      // Already initialized
      return;
    }

    // Browser-compatible environment variable reading
    const getEnvVar = (key: string, defaultValue: string): string => {
      if (typeof process !== 'undefined' && process.env) {
        return process.env[key] || defaultValue;
      }
      if (typeof window !== 'undefined' && (window as any)[key]) {
        return (window as any)[key];
      }
      return defaultValue;
    };

    const otlpEndpointHttp =
      options?.otlpEndpointHttp ||
      getEnvVar('OTLP_ENDPOINT_HTTP', 'http://localhost:4318');
    const serviceName =
      options?.serviceName || getEnvVar('OTEL_SERVICE_NAME', 'unknown-service');

    // Check if we're in browser environment
    // @opentelemetry/sdk-logs and @opentelemetry/exporter-logs-otlp-proto
    // have Node.js-specific dependencies (stream, zlib, etc.) that don't work in browser bundles
    const isBrowser = typeof window !== 'undefined';

    if (isBrowser) {
      // In browser, the logs SDK cannot be used due to Node.js dependencies
      // Logger will still work but without OTLP export
      // Trace context will still be extracted from active spans for correlation
      // Note: Frontend logs can still be correlated with traces via trace_id/span_id
      // that are automatically included in log attributes when spans are active
      return;
    }

    // Initialize OTLP logger for Node.js environment
    // Note: In browser builds, this code path is skipped above, so the imports
    // won't cause issues (they're tree-shaken or handled by bundler configuration)
    try {
      const logExporter = new OTLPLogExporter({
        url: `${otlpEndpointHttp}/v1/logs`,
      });

      const resource = resourceFromAttributes({
        [SEMRESATTRS_SERVICE_NAME]: serviceName,
      });

      const loggerProvider = new LoggerProvider({
        resource,
      });

      // Add log record processor (method exists at runtime)
      (loggerProvider as any).addLogRecordProcessor(
        new SimpleLogRecordProcessor(logExporter)
      );

      Logger._loggerProvider = loggerProvider;
      Logger._otlpLogger = loggerProvider.getLogger('@holistix/log');
    } catch (error) {
      // Silently fail if SDK packages aren't available
      // Logger will still work but without OTLP export
      // Trace context will still be extracted from active spans for correlation
    }
  }

  /**
   * Check if the logger has been initialized
   */
  static isInitialized(): boolean {
    return Logger._loggerProvider !== null && Logger._otlpLogger !== null;
  }

  log(p: EPriority, category: string, msg: string, data?: TJson): void {
    // Export to OTLP (OpenTelemetry)
    // Only export if logger has been initialized
    if (Logger._otlpLogger) {
      try {
        const span = trace.getActiveSpan();
        const spanContext = span?.spanContext();

        // Build log record body
        const body = msg;

        // Build attributes
        const attributes: Record<string, any> = {
          'log.category': category,
          'log.priority': p,
          'log.priority_name': p, // p is already the string value
        };

        // Add trace context (trace_id and span_id)
        if (spanContext && spanContext.traceId) {
          attributes['trace_id'] = spanContext.traceId;
        }
        if (spanContext && spanContext.spanId) {
          attributes['span_id'] = spanContext.spanId;
        }

        // Add data as attributes if provided
        if (data) {
          // Flatten data object into attributes (with prefix to avoid conflicts)
          Object.keys(data).forEach((key) => {
            const value = (data as Record<string, unknown>)[key];
            // Only add primitive values as attributes
            if (
              typeof value === 'string' ||
              typeof value === 'number' ||
              typeof value === 'boolean'
            ) {
              attributes[`log.data.${key}`] = value;
            } else if (value !== null && value !== undefined) {
              // For complex objects, stringify them
              try {
                attributes[`log.data.${key}`] = JSON.stringify(value);
              } catch {
                // Ignore stringify errors
              }
            }
          });
        }

        // Emit log record
        Logger._otlpLogger.emit({
          severityNumber: priorityToSeverityNumber(p),
          severityText: p,
          body: body,
          attributes: attributes,
        });
      } catch (error) {
        // Silently fail OTLP export (don't break application if observability is not configured)
        // In development, we might want to log this, but in production we should fail silently
        if (process.env.NODE_ENV === 'development') {
          console.error('[Logger] Failed to export log to OTLP:', error);
        }
      }
    }
  }

  error(category: string, msg: string, data?: TJson): void {
    this.log(EPriority.Error, category, msg, data);
  }

  //

  static _logger: Logger = new Logger();

  static _priority: EPriority = (() => {
    if (typeof process !== 'undefined') {
      if (process.env['LOG_LEVEL'] !== undefined) {
        const level = process.env['LOG_LEVEL'];
        // Support both numeric (legacy) and string values
        const numericLevel = parseInt(level);
        if (!isNaN(numericLevel)) {
          // Map numeric to string
          const mapping: Record<number, EPriority> = {
            0: EPriority.Emergency,
            1: EPriority.Alert,
            2: EPriority.Critical,
            3: EPriority.Error,
            4: EPriority.Warning,
            5: EPriority.Notice,
            6: EPriority.Info,
            7: EPriority.Debug,
          };
          return mapping[numericLevel] || EPriority.Info;
        }
        // Try to match string value
        const upperLevel = level.toUpperCase();
        if (upperLevel in EPriority) {
          return EPriority[upperLevel as keyof typeof EPriority];
        }
      }
      if (process.env['NODE_ENV'] !== 'development') {
        return EPriority.Info;
      } else {
        return EPriority.Debug;
      }
    } else {
      return EPriority.Debug;
    }
  })();

  static setLogger(logger: Logger): void {
    Logger._logger = logger;
  }

  static setPriority(p: EPriority): void {
    Logger._priority = p;
  }

  static log(
    p: EPriority,
    category: string,
    msg: string,

    data?: any
  ) {
    // Compare priorities: lower enum value = higher priority
    const priorityOrder: Record<EPriority, number> = {
      [EPriority.Emergency]: 0,
      [EPriority.Alert]: 1,
      [EPriority.Critical]: 2,
      [EPriority.Error]: 3,
      [EPriority.Warning]: 4,
      [EPriority.Notice]: 5,
      [EPriority.Info]: 6,
      [EPriority.Debug]: 7,
    };
    if (priorityOrder[p] <= priorityOrder[Logger._priority])
      Logger._logger.log(p, category, msg, data);
  }

  static error(category: string, msg: string, data?: TJson) {
    Logger._logger.error(category, msg, data);
  }
}

export const log = Logger.log;
export const error = Logger.error;
