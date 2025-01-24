import express from 'express';
import {
  /*
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
  */
  context,
  trace,
  Span,
  SpanStatusCode,
} from '@opentelemetry/api';
import {
  BasicTracerProvider,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { Exception } from '../Exceptions/Exception';

//
//

type R = express.Request & { _opentelemetry_span: Span };

//

export const setupJaegerLog = (
  app: express.Express,
  serviceName: string,
  serviceTag: string,
  host: string
) => {
  // diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

  const collectorOptions = {
    url: `http://${host}:4318/v1/traces`, // url is optional and can be omitted - default is http://localhost:4318/v1/traces
    /*
    headers: {
      foo: 'bar',
    }, //an optional object containing custom headers to be sent with each request will only work with http
    */
  };

  const provider = new BasicTracerProvider({
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: serviceName,
    }),
  });

  const exporter = new OTLPTraceExporter(collectorOptions);

  provider.addSpanProcessor(new SimpleSpanProcessor(exporter));

  provider.register();

  // Initialize the tracer
  const tracer = trace.getTracer('esm-tracer');

  // Express middleware to create spans for each incoming request
  app.use((req: express.Request, res, next) => {
    const span = tracer.startSpan(`${serviceTag} ${req.method} ${req.path}`);

    // Add attributes to the span
    span.setAttribute('service', serviceTag);
    span.setAttribute('http.method', req.method);
    span.setAttribute('http.url', req.url);
    for (const h in req.headers)
      span.setAttribute(`headers.${h}`, req.headers[h] as string);

    // Set the span context on the request for later use
    context.with(context.active(), () => {
      (req as R)._opentelemetry_span = span;
      next();
    });
  });
};

//

export const jaegerSetError = (r: express.Request, exception: Exception) => {
  if ((r as R)._opentelemetry_span) {
    const span = (r as R)._opentelemetry_span;
    span.setStatus({ code: SpanStatusCode.ERROR, message: exception.message });
    span.recordException(exception);
  }
};

//

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const jaegerSetResponse = (r: R, o: { status: number } & any) => {
  if (r._opentelemetry_span) {
    const span = r._opentelemetry_span;
    span.setAttribute('http.status_code', o.status);
    span.setAttribute('http.response', JSON.stringify(o));
    span.end();
  }
};
