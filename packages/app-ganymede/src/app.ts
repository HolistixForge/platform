import express, { Express } from 'express';
import expressSession from 'express-session';
import passport from 'passport';
import { OpenAPIV3 } from 'express-openapi-validator/dist/framework/types';
import { NotFoundException, error } from '@holistix-forge/log';
import {
  setupBasicExpressApp,
  setupErrorsHandler,
  setupValidator,
  respond,
} from '@holistix-forge/backend-engine';

import { CONFIG } from './config';
import { isTunnelRequest, withTunnelOrigin } from './lib/public-routing';
import { PgSessionModel } from './models/session';
import oas from './oas30.json';
import { setupGithubRoutes } from './routes/auth/github';
import { setupGitlabRoutes } from './routes/auth/gitlab';
import { setupDiscordRoutes } from './routes/auth/discord';
import { setupLinkedinRoutes } from './routes/auth/linkedin';
import { setupLocalRoutes } from './routes/auth/local';
import { setupTOTPRoutes } from './routes/auth/totp';
import { setupMagicLinkRoutes } from './routes/auth/magic-link';
import { setupOauthRoutes } from './routes/auth/oauth';
import { setupOrganizationRoutes } from './routes/organizations';
import { setupProjectRoutes } from './routes/projects';
import { setupGatewayRoutes } from './routes/gateway';
import { setupUserRoutes } from './routes/users';
import { setupRunnerRoutes } from './routes/runners';
import { setupInternalProjectRoutes } from './routes/internal/projects';
import { setupInternalOAuthClientRoutes } from './routes/internal/oauth-clients';
import { setupInternalContainerImageRoutes } from './routes/internal/container-images';
import { setupInternalProjectNetworkRoutes } from './routes/internal/project-networks';
import { setupInternalRunnerProjectRoutes } from './routes/internal/runner-projects';
import { setupCredentialRoutes } from './routes/credentials';
import {
  globalLimiter,
  authStrictLimiter,
  oauthLimiter,
  sensitiveLimiter,
  apiLimiter,
  isRateLimitingEnabled,
} from './middleware/rate-limiter';

export const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Create and configure the Express application
 *
 * This factory function centralizes all app configuration so it can be reused
 * in both production (main.ts) and tests (*.spec.ts)
 *
 * @param options - Configuration options for testing vs production
 * @param options.skipSession - Skip session configuration (for unit tests)
 * @param options.skipRateLimiting - Skip rate limiting (for unit tests)
 * @param options.skipValidation - Skip OpenAPI validation (for unit tests)
 * @param options.setupAdditionalRoutes - Callback to setup additional routes (e.g., test routes)
 * @returns Configured Express app
 */
export function createApp(
  options: {
    skipSession?: boolean;
    skipRateLimiting?: boolean;
    skipValidation?: boolean;
    setupAdditionalRoutes?: (
      router: express.Router,
      rateLimiters: {
        auth?: express.RequestHandler;
        oauth?: express.RequestHandler;
        sensitive?: express.RequestHandler;
        api?: express.RequestHandler;
      }
    ) => void;
  } = {}
): Express {
  const app = express();
  app.set('trust proxy', 1);

  // First, so everything below runs with the request's own origin in scope.
  // The OAuth model reads it from there; see lib/public-routing.ts.
  app.use(withTunnelOrigin);

  // Basic Express setup (CORS, body parsing, etc.)
  // Ganymede-specific CSRF exemptions:
  // - /gateway/*: Gateway management endpoints (server-to-server or frontend-initiated)
  // - /collab/start: Gateway calls during initialization
  setupBasicExpressApp(app, {
    csrfExemptPaths: [
      '/gateway/start', // Frontend initiates gateway allocation
      '/gateway/config', // Gateway fetches config from Ganymede
      '/gateway/ready', // Gateway signals ready status
      '/gateway/stop', // Gateway signals shutdown/deallocation
      '/gateway/tokens/scoped', // Gateway requests project-scoped tokens
      '/collab/start', // Gateway calls during initialization
      '/oauth/authorize', // OAuth authorization code flow (protected by client credentials)
      '/oauth/token', // OAuth token exchange (protected by client credentials)
      '/internal/oauth/clients', // Internal OAuth client management (protected by gateway token)
      '/internal/oauth/clients/:client_id', // Internal OAuth client deletion (protected by gateway token)
      '/internal/projects/:project_id/members', // Internal project member add (protected by gateway token)
      '/internal/projects/:project_id/members/:user_id', // Internal project member remove (protected by gateway token)
      '/internal/projects/:project_id/images/:image_id', // Broker resolves a catalog id to a pullable reference (protected by gateway token)
      '/internal/projects/:project_id/networks', // Gateway allocates and lists private network ranges (protected by gateway token)
      '/internal/runners/:runner_id/projects', // Gateway opts a machine into a project (protected by gateway token)
      // Runner enrolment. The CSRF gate waives requests carrying
      // `Authorization: Bearer …`, and authenticateJwtUser accepts the
      // `token ` prefix instead — so this call, made by a CLI with no browser
      // and no Origin header, would be rejected on a prefix rather than on
      // anything about its authenticity. Everything else the runner does uses
      // Bearer and needs no exemption.
      '/runners',
    ],
  });

  // Global rate limiter (apply to all routes as baseline protection)
  // Can be disabled for testing or via environment variable
  if (!options.skipRateLimiting && isRateLimitingEnabled()) {
    app.use(globalLimiter);
  }

  // OPTIONS handler for CORS preflight requests
  // Must set CORS headers including Access-Control-Allow-Origin
  app.options('*', (req, res) => {
    respond(req, res, {
      type: 'options',
    });
  });

  // OpenAPI Request/Response Validation
  if (!options.skipValidation) {
    setupValidator(app, {
      apiSpec: oas as OpenAPIV3.DocumentV3,
      // Request validation errors are handled by Express error middleware, see setupErrorsHandler
      validateRequests: true,
      validateResponses: {
        removeAdditional: 'failing',
        onError: (err, body, req) => {
          // Log to structured logger
          error(
            'OpenAPI Response Validation',
            `Response validation failed: ${err.message}`,
            {
              validation_type: 'response',
              url: req.originalUrl,
              method: req.method,
              error_path: err.path as string,
              status_code: req.statusCode as number,
            }
          );
        },
      },
    });
  }

  // Session setup (can be skipped in unit tests)
  if (!options.skipSession) {
    // SSL/TLS Termination Architecture:
    // - Nginx handles SSL termination (HTTPS → HTTP)
    // - Nginx sets X-Forwarded-Proto: https header
    // - Ganymede runs on HTTP (localhost:6100)
    // - Trust proxy (line 46) detects HTTPS from X-Forwarded-Proto
    // - Cookie secure flag works correctly
    //
    // Flow: Browser (HTTPS) → Nginx (SSL term) → Ganymede (HTTP, trusts proxy)

    // Two session middlewares, differing in one attribute of the cookie.
    //
    // A browser refuses a `Set-Cookie` whose `Domain` is not a suffix of the
    // host it is talking to. So a session issued to a visitor on
    // `foo.trycloudflare.com` carrying `Domain=ganymede.apollo.test` is
    // dropped on the floor, silently, and every flow that needs the session —
    // the OAuth authorize step, so: signing in — loops without saying why.
    //
    // Two middlewares rather than one plus a per-request fix-up, which is what
    // this was first written as and which does not work: `req.login()` calls
    // `req.session.regenerate()`, and regenerate builds a *fresh* Cookie from
    // the options the middleware was constructed with. Any mutation made
    // earlier in the request is discarded at exactly the moment the cookie
    // that matters is minted — a login, verified against the running binary,
    // still handed out the local domain.
    //
    // A store instance each, and that is not an oversight to tidy up later.
    // express-session installs its own `generate` *onto the store object* —
    // and `regenerate()`, which `req.login()` calls, goes through it. Handed
    // one shared store, the second middleware constructed overwrites the
    // first's, so every login on either arrangement mints the cookie of
    // whichever was created last. Measured: with a shared store, a login on
    // the configured domain came back with no `Domain` at all.
    //
    // Two instances cost nothing and share everything that matters: the model
    // holds no state, and both read and write the same sessions table. A
    // session started on either can be read by either.
    const sessionCookie: expressSession.CookieOptions = {
      secure: true, // Works via X-Forwarded-Proto with trust proxy
      maxAge: SESSION_MAX_AGE,
      httpOnly: true,
      path: '/',
      sameSite: 'none', // Required for cross-site cookies with credentials
    };
    const sessionBase = {
      secret: CONFIG.SESSION_COOKIE_KEY,
      resave: false,
      saveUninitialized: false,
      name: 'sessid',
    };

    const localSession = expressSession({
      ...sessionBase,
      store: new PgSessionModel(),
      cookie: {
        ...sessionCookie,
        // The host without its port. A cookie domain is a domain — a browser
        // rejects `ganymede.apollo.test:8443` outright — while GANYMEDE_FQDN
        // has to carry the port, because every URL built from it is a link
        // somebody follows and nginx does not listen on 443 where binding
        // under 1024 needs root. This is the one place the port has to come
        // back off.
        domain: CONFIG.GANYMEDE_FQDN.split(':')[0],
      },
    });

    // No domain at all, which scopes the cookie to exactly the host that set
    // it. That is what a single-hostname arrangement wants: there are no
    // sibling subdomains to share it with.
    const tunnelSession = expressSession({
      ...sessionBase,
      store: new PgSessionModel(),
      cookie: { ...sessionCookie },
    });

    app.use((req, res, next) =>
      isTunnelRequest(req)
        ? tunnelSession(req, res, next)
        : localSession(req, res, next)
    );
  }

  // Passport setup (skip entirely for tests that don't need authentication)
  if (!options.skipSession) {
    app.use(passport.initialize());
    app.use(passport.session());
  }

  // Routes with tiered rate limiting
  const router = express.Router();

  // Determine which rate limiters to use (none if disabled)
  const rateLimiters =
    options.skipRateLimiting || !isRateLimitingEnabled()
      ? {
          auth: undefined,
          oauth: undefined,
          sensitive: undefined,
          api: undefined,
        }
      : {
          auth: authStrictLimiter,
          oauth: oauthLimiter,
          sensitive: sensitiveLimiter,
          api: apiLimiter,
        };

  // OAuth provider routes - Moderate limits (sensitive operations)
  setupGithubRoutes(router, rateLimiters.sensitive);
  setupGitlabRoutes(router, rateLimiters.sensitive);
  setupLinkedinRoutes(router, rateLimiters.sensitive);
  setupDiscordRoutes(router, rateLimiters.sensitive);

  // Authentication routes - Strict limits (brute-force protection)
  setupLocalRoutes(router, rateLimiters.auth);
  setupTOTPRoutes(router, rateLimiters.auth);
  setupMagicLinkRoutes(router, rateLimiters.sensitive);

  // OAuth routes - Token endpoint limits
  setupOauthRoutes(router, rateLimiters.oauth);

  // API routes - General limits
  setupOrganizationRoutes(router, rateLimiters.api);
  setupProjectRoutes(router, rateLimiters.api);
  setupGatewayRoutes(router, rateLimiters.api);
  setupUserRoutes(router, rateLimiters.api);
  setupCredentialRoutes(router, rateLimiters.api);
  setupRunnerRoutes(router, rateLimiters.api);

  // Internal API routes (gateway-only, protected by gateway token)
  setupInternalProjectRoutes(router, rateLimiters.api);
  setupInternalOAuthClientRoutes(router, rateLimiters.api);
  setupInternalContainerImageRoutes(router, rateLimiters.api);
  setupInternalProjectNetworkRoutes(router, rateLimiters.api);
  setupInternalRunnerProjectRoutes(router, rateLimiters.api);

  // Additional routes (e.g., test routes)
  if (options.setupAdditionalRoutes) {
    options.setupAdditionalRoutes(router, rateLimiters);
  }

  app.use('/', router);

  // Error handlers
  app.use(function (req, res, next) {
    const err = new NotFoundException();
    next(err);
  });

  setupErrorsHandler(app);

  return app;
}
