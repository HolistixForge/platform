import { trace } from '@opentelemetry/api';

export type BrowserLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface BrowserLogOptions {
  /**
   * Additional structured data to include in the log.
   * This should be JSON-serializable.
   */
  data?: unknown;

  /**
   * Whether to attach this log as a span event on the current active span.
   * Defaults to false to avoid noisy traces; enable only for important events.
   */
  asSpanEvent?: boolean;
}

/**
 * Browser-side logging helper.
 *
 * For now, this only logs to the browser console, but it centralizes the shape
 * so we can later route these logs to OTLP / Loki without touching all call sites.
 */
export function browserLog(
  level: BrowserLogLevel,
  category: string,
  message: string,
  options: BrowserLogOptions = {}
): void {
  const { data, asSpanEvent } = options;

  const payload: Record<string, unknown> = {
    level,
    category,
    message,
  };

  if (data !== undefined) {
    payload.data = data;
  }

  const consoleFn =
    level === 'error'
      ? console.error
      : level === 'warn'
      ? console.warn
      : level === 'info'
      ? console.info
      : console.debug;

  consoleFn('[browserLog]', payload);

  if (asSpanEvent) {
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent('browser.log', {
        'log.level': level,
        'log.category': category,
        'log.message': message,
        ...(data !== undefined ? { 'log.data': JSON.stringify(data) } : {}),
      });
    }
  }
}
