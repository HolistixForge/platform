// Initialize OpenTelemetry BEFORE any other imports
// This ensures auto-instrumentation works correctly
import { initializeNodeObservability } from '@monorepo/observability/node';
initializeNodeObservability({
  serviceName: process.env.OTEL_SERVICE_NAME || 'ganymede',
  environment: process.env.OTEL_DEPLOYMENT_ENVIRONMENT,
});

import './declarations.d.ts';
import express from 'express';
import expressSession from 'express-session';
import passport from 'passport';
import { NotFoundException } from '@monorepo/log';
import {
  setupBasicExpressApp,
  setupErrorsHandler,
  setupValidator,
} from '@monorepo/backend-engine';

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

//
// Express app setup
//

const app = express();
app.set('trust proxy', 1);

// Observability is now handled by @monorepo/observability package
// Auto-instrumentation will automatically create spans for Express requests
setupBasicExpressApp(app);

app.options('*', (req, res) => {
  res.status(200).end();
});

//
// OpenAPI Request/Response Validation
//

setupValidator(app, {
  apiSpec: oas as any,
  validateRequests: true,
  validateResponses: {
    removeAdditional: 'failing',
    onError: (err, body, req) => {
      if (!err.message.includes(' must be string')) {
        console.error('Response validation error:', err.message);
        console.error('From:', req.originalUrl);
      }
    },
  },
});

//
// Session setup
//

export const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

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

//
// Passport setup
//

app.use(passport.initialize());
app.use(passport.session());

//
// Routes
//

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

//
// Error handlers
//

app.use(function (req, res, next) {
  const err: any = new NotFoundException();
  next(err);
});

setupErrorsHandler(app);

//
// Start server
//

const bindings: Array<{
  port: number;
  protocol: 'http' | 'https';
  cert?: string;
  key?: string;
}> = JSON.parse(CONFIG.GANYMEDE_SERVER_BIND);

bindings.forEach((binding) => {
  if (binding.protocol === 'https') {
    const https = require('https');
    const fs = require('fs');
    const server = https.createServer(
      {
        cert: fs.readFileSync(binding.cert),
        key: fs.readFileSync(binding.key),
      },
      app
    );
    server.listen(binding.port, () => {
      console.log(`Ganymede HTTPS server listening on port ${binding.port}`);
    });
  } else {
    app.listen(binding.port, () => {
      console.log(`Ganymede HTTP server listening on port ${binding.port}`);
    });
  }
});
