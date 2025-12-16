import express, { Express } from 'express';
import expressSession from 'express-session';
import passport from 'passport';
import { OpenAPIV3 } from 'express-openapi-validator/dist/framework/types';
import { NotFoundException, error } from '@holistix-forge/log';
import {
  setupBasicExpressApp,
  setupErrorsHandler,
  setupValidator,
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

export const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Create and configure the Express application
 *
 * This factory function centralizes all app configuration so it can be reused
 * in both production (main.ts) and tests (*.spec.ts)
 *
 * @param options - Configuration options for testing vs production
 * @returns Configured Express app
 */
export function createApp(
  options: {
    skipSession?: boolean;
  } = {}
): Express {
  const app = express();
  app.set('trust proxy', 1);

  // Basic Express setup (CORS, body parsing, etc.)
  setupBasicExpressApp(app);

  // OPTIONS handler
  app.options('*', (req, res) => {
    res.status(200).end();
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
    app.use(
      expressSession({
        store: new PgSessionModel(),
        secret: CONFIG.SESSION_COOKIE_KEY,
        resave: false,
        saveUninitialized: false,
        name: 'sessid',
        cookie: {
          secure: true,
          domain: CONFIG.GANYMEDE_FQDN,
          maxAge: SESSION_MAX_AGE,
          httpOnly: true,
          path: '/',
          sameSite: 'lax',
        },
      })
    );

    // Passport setup (requires session)
    app.use(passport.initialize());
    app.use(passport.session());
  }

  // Routes
  const router = express.Router();
  setupGithubRoutes(router);
  setupGitlabRoutes(router);
  setupLinkedinRoutes(router);
  setupDiscordRoutes(router);
  setupLocalRoutes(router);
  setupTOTPRoutes(router);
  setupMagicLinkRoutes(router);
  setupOauthRoutes(router);
  setupOrganizationRoutes(router);
  setupProjectRoutes(router);
  setupGatewayRoutes(router);
  setupUserRoutes(router);

  app.use('/', router);

  // Error handlers
  app.use(function (req, res, next) {
    const err = new NotFoundException();
    next(err);
  });

  setupErrorsHandler(app);

  return app;
}
