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
 * @returns Configured Express app
 */
export function createApp(
  options: {
    skipSession?: boolean;
    skipRateLimiting?: boolean;
  } = {}
): Express {
  const app = express();
  app.set('trust proxy', 1);

  // Basic Express setup (CORS, body parsing, etc.)
  setupBasicExpressApp(app);

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

    app.use(
      expressSession({
        store: new PgSessionModel(),
        secret: CONFIG.SESSION_COOKIE_KEY,
        resave: false,
        saveUninitialized: false,
        name: 'sessid',
        cookie: {
          secure: true, // Works via X-Forwarded-Proto with trust proxy
          domain: CONFIG.GANYMEDE_FQDN, // Explicitly set to ganymede.domain.local only
          maxAge: SESSION_MAX_AGE,
          httpOnly: true,
          path: '/',
          sameSite: 'none', // Required for cross-site cookies with credentials
        },
      })
    );

    // Passport setup (requires session)
    app.use(passport.initialize());
    app.use(passport.session());
  }

  // Routes with tiered rate limiting
  const router = express.Router();
  
  // Determine which rate limiters to use (none if disabled)
  const rateLimiters = options.skipRateLimiting || !isRateLimitingEnabled()
    ? { auth: undefined, oauth: undefined, sensitive: undefined, api: undefined }
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

  app.use('/', router);

  // Error handlers
  app.use(function (req, res, next) {
    const err = new NotFoundException();
    next(err);
  });

  setupErrorsHandler(app);

  return app;
}
