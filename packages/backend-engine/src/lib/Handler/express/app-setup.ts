import express from 'express';
import nocache from 'nocache';
import cookieParser from 'cookie-parser';

import {
  error,
  log,
  Exception,
  NotFoundException,
  UnknownException,
  EPriority,
} from '@holistix-forge/log';
import { TJson } from '@holistix-forge/simple-types';

import { respond } from './responses';
import { trace, SpanStatusCode } from '@opentelemetry/api';

//

//

export const setupBasicExpressApp = (app: express.Express) => {
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Powered-By', '');
    next();
  });

  // CORS middleware - must run before routes
  app.use((req, res, next) => {
    const allowedOrigins: string[] = JSON.parse(
      process.env.ALLOWED_ORIGINS || '[]'
    );
    const origin = req.headers.origin;
    const allowedOrigin =
      origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization'
    );
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin || '*');
    next();
  });

  // disable express caching
  app.use(nocache());
  app.set('etag', false);

  // load JSON from POST, PATCH ... request body
  app.use(express.json());

  // load from "application/x-www-form-urlencoded"
  app.use(express.urlencoded({ extended: true }));

  app.use(cookieParser());

  // ============================================================================
  // CSRF (Cross-Site Request Forgery) Protection
  // ============================================================================
  //
  // CSRF attacks occur when a malicious website tricks a user's browser into
  // making unauthorized requests to your application using the user's cookies.
  //
  // Example attack without protection:
  //   1. User logs into yourapp.com (cookie stored)
  //   2. User visits evil.com in another tab
  //   3. evil.com makes POST request to yourapp.com/api/delete-account
  //   4. Browser automatically sends yourapp.com cookies
  //   5. Account deleted! (user never intended this)
  //
  // Our Multi-Layer CSRF Defense Strategy:
  //
  // Layer 1: JWT in Authorization Header (Primary Defense)
  //   - Most API endpoints use JWT tokens in Authorization header
  //   - Malicious sites CANNOT read tokens (same-origin policy)
  //   - Malicious sites CANNOT set Authorization header (CORS blocks it)
  //   - Result: JWT-based APIs are inherently CSRF-proof
  //
  // Layer 2: Origin/Referer Validation (Defense-in-Depth)
  //   - For cookie-based authentication (e.g., /auth/* routes)
  //   - Validates request comes from allowed origins
  //   - Browser sends Origin/Referer; attackers cannot forge these headers
  //   - Result: Cross-origin cookie-based attacks are blocked
  //
  // Layer 3: SameSite Cookies (Browser-Level Protection)
  //   - Modern browsers support SameSite cookie attribute
  //   - Configured in session setup (sameSite: 'none' with secure: true)
  //   - Prevents cookies from being sent in cross-site contexts
  //   - Result: Additional browser-level CSRF protection
  //
  // Why We Don't Use Token-Based CSRF Libraries (csurf, csrf-csrf):
  //   1. Our API is JWT-first (most endpoints don't need CSRF tokens)
  //   2. Origin/Referer validation is simpler and sufficient
  //   3. Fewer dependencies = smaller attack surface
  //   4. Token-based CSRF adds complexity without significant benefit
  //   5. Modern approach: CORS + SameSite + Origin validation
  //
  // When Token-Based CSRF Would Be Needed:
  //   - Extensive cookie-based session authentication (we're JWT-first)
  //   - No JWT tokens in headers (we use JWT for all sensitive APIs)
  //   - Older browsers without SameSite support (rare in 2024+)
  //   - Complex multi-subdomain cookie sharing (not our architecture)
  //
  // Note: If architecture changes to be more cookie-centric, consider:
  //   - csrf-csrf (modern, maintained, double-submit cookie pattern)
  //   - @dr.pogodin/csurf (maintained fork of deprecated csurf)
  //
  // References:
  //   - OWASP CSRF Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
  //   - JWT and CSRF: https://stackoverflow.com/questions/21357182/csrf-token-necessary-when-using-stateless-sessionless-authentication
  //
  app.use((req, res, next) => {
    // Skip CSRF check for safe HTTP methods
    // Safe methods (GET, HEAD, OPTIONS) should not cause state changes
    // and are therefore not vulnerable to CSRF attacks
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) {
      return next();
    }

    // Skip CSRF check for JWT-authenticated requests
    // JWT tokens in Authorization headers cannot be accessed by malicious sites
    // due to same-origin policy and CORS restrictions, making them CSRF-proof
    const hasJwtAuth = req.headers.authorization?.startsWith('Bearer ');
    if (hasJwtAuth) {
      return next();
    }

    // Skip CSRF check for health/monitoring endpoints
    // These endpoints don't perform sensitive operations
    const isHealthCheck = req.path === '/health' || req.path === '/ping';
    if (isHealthCheck) {
      return next();
    }

    // For state-changing operations without JWT (cookie-based auth):
    // Validate request comes from an allowed origin
    //
    // Origin header: Set by browser for cross-origin requests (CORS)
    // Referer header: Contains URL of page that made the request
    //
    // Malicious sites cannot forge these headers due to browser security.
    // If headers match allowed origins, request is legitimate.
    const origin = req.headers.origin || req.headers.referer;
    const allowedOrigins: string[] = JSON.parse(
      process.env.ALLOWED_ORIGINS || '[]'
    );

    if (
      origin &&
      allowedOrigins.some((allowed) => origin.startsWith(allowed))
    ) {
      return next();
    }

    // Reject request: No JWT and no valid Origin/Referer
    // This indicates either:
    //   1. Cross-site request from malicious site (CSRF attack)
    //   2. Misconfigured client (missing credentials)
    //   3. Direct API access without proper authentication
    log(
      EPriority.Warning,
      'CSRF',
      `Rejected request without valid origin or JWT: ${req.method} ${req.path}`,
      { origin, ip: req.ip }
    );
    return res.status(403).json({ error: 'CSRF validation failed' });
  });

  // Enrich span with basic request context (runs early, before authentication)
  app.use((req, res, next) => {
    const span = trace.getActiveSpan();
    if (span) {
      // Add basic HTTP context
      span.setAttribute('http.method', req.method);
      span.setAttribute('http.route', req.path);
      span.setAttribute('http.url', req.originalUrl || req.url);
    }
    next();
  });

  // log any request
  app.use((req, res, next) => {
    log(EPriority.Info, 'REQUEST', `${req.method}: ${req.path}`, null);
    const { headers, method, params, query } = req;

    const rd = {
      method,
      json: req.body,
      query,
      headers,
      params,
    };
    log(EPriority.Info, 'REQUEST', ``, rd);
    next();
  });
};

//

export const setupErrorsHandler = (app: express.Express) => {
  app.use(function (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    let exception: Exception;
    // if we reach this app.use block, it is an error

    // if openapi validator error ?
    // tested first because not our standard Exception
    if (
      err.name === 'Bad Request' &&
      err.status === 400 &&
      Array.isArray(err.errors)
    ) {
      // Structured logging for observability
      error(
        'OpenAPI Request Validation',
        `Request validation failed: ${err.message}`,
        {
          validation_type: 'request',
          url: req.originalUrl,
          method: req.method,
          route: err.path,
          error_details: err.errors,
          status_code: err.status,
        }
      );

      // Add validation context to active span
      const validationSpan = trace.getActiveSpan();
      if (validationSpan) {
        validationSpan.setAttribute('validation.type', 'request');
        validationSpan.setAttribute('validation.failed', true);
        validationSpan.setAttribute(
          'validation.error_count',
          err.errors.length
        );
        validationSpan.setAttribute('http.route', err.path);

        // Add each validation error as span attributes
        err.errors.forEach((e: any, idx: number) => {
          validationSpan.setAttribute(
            `validation.error.${idx}.path`,
            e.path || 'unknown'
          );
          validationSpan.setAttribute(
            `validation.error.${idx}.message`,
            e.message || 'unknown'
          );
          validationSpan.setAttribute(
            `validation.error.${idx}.code`,
            e.errorCode || 'unknown'
          );
        });

        // Add event to span for better tracing
        validationSpan.addEvent('openapi_validation_failed', {
          'validation.type': 'request',
          'validation.error_count': err.errors.length,
          'validation.errors': JSON.stringify(err.errors),
        });
      }

      exception = new Exception(
        err.errors.map((e: any) => ({ message: e.message, public: true })),
        400
      );
    }
    // if openapi validator not found ?
    else if (
      err.name === 'Not Found' &&
      err.status === 404 &&
      Array.isArray(err.errors)
    )
      exception = new NotFoundException(err.errors);
    //
    // if it is not our standard Exception
    // something bad happen
    else if (!(err instanceof Exception)) {
      // Log unknown error with structured logging (replaces console.log)
      error('Error', `Unknown error: ${err.message}`, {
        error_type: 'UNKNOWN_ERROR',
        error_message: err.message,
        error_stack: err.stack,
        raw_error: String(err),
      });
      exception = new UnknownException(err.message);
    }
    //
    else exception = err;

    const json = exception.toJson();

    const serialized = JSON.stringify(json, null, 4);
    // Enhanced error logging with error category
    error('Error', serialized, {
      error_uuid: exception._uuid,
      error_category: exception.errorCategory,
      error_stack: exception.stack || '',
      http_status: exception.httpStatus || 500,
    } as TJson);

    // Record exception in active span (if OpenTelemetry is initialized)
    const span = trace.getActiveSpan();
    if (span) {
      span.recordException(exception);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: exception.message,
      });
    }

    const { uuid, errors } = json;

    respond(req, res, {
      type: 'json',
      json: { uuid, errors },
      status: exception.httpStatus || 500,
    });
  });
};
