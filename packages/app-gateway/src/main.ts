// CRITICAL: Import tracing first to register instrumentations
import './tracing';

import express from 'express';
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import { EPriority, log } from '@holistix-forge/log';
import {
  setupBasicExpressApp,
  setupErrorsHandler,
  setupValidator,
  TStart,
} from '@holistix-forge/backend-engine';
import { BackendEventProcessor } from '@holistix-forge/reducers';

import { VPN } from './config/organization';
import { setupCollabRoutes, setBackendEventProcessor } from './routes/collab';
import { setupPermissionsRoutes } from './routes/permissions';
import { setupProtectedServicesRoutes } from './routes/protected-services';
import oauthRoutes from './routes/oauth';
import oas from './oas30.json';
import {
  initializeGatewayForOrganization,
  shutdownGateway,
} from './initialization/gateway-init';
import { loadOrganizationConfig } from './config/organization';
import { signalGatewayReady } from './initialization/signal-ready';
import {
  globalLimiter,
  oauthLimiter,
  apiLimiter,
  isRateLimitingEnabled,
} from './middleware/rate-limiter';

//
// Global state
//

let bep: BackendEventProcessor<never>;

//
// Express setup
//

const setupExpressApp = () => {
  const app = express();
  app.set('trust proxy', 1);

  // Observability is now handled by @holistix-forge/observability package
  // Auto-instrumentation will automatically create spans for Express requests
  setupBasicExpressApp(app);

  // Global rate limiter (apply to all routes as baseline protection)
  if (isRateLimitingEnabled()) {
    app.use(globalLimiter);
  }

  app.options('*', (req, res) => {
    res.status(200).end();
  });

  // OpenAPI validation
  setupValidator(app, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // Routes with rate limiting
  const router = express.Router();
  const rateLimiter = isRateLimitingEnabled() ? apiLimiter : undefined;
  
  setupCollabRoutes(router, rateLimiter);
  setupPermissionsRoutes(router, rateLimiter);
  setupProtectedServicesRoutes(router, rateLimiter);
  app.use('/', router);

  // OAuth routes - Apply OAuth-specific rate limiter
  if (isRateLimitingEnabled()) {
    app.use('/oauth', oauthLimiter, oauthRoutes);
  } else {
    app.use('/oauth', oauthRoutes);
  }

  // Error handler
  setupErrorsHandler(app);

  return app;
};

//
// Server startup
//

const startServer = (
  app: express.Express,
  config: TStart
): https.Server | http.Server => {
  const { host, port, certificate } = config;
  const url = `${certificate ? 'https' : 'http'}://${host}:${port}`;

  const server = certificate
    ? https.createServer(
        {
          key: fs.readFileSync(certificate.keyfile),
          cert: fs.readFileSync(certificate.certFile),
        },
        app
      )
    : http.createServer({}, app);

  server.listen(port, host, undefined, function () {
    log(EPriority.Info, 'GATEWAY', `Express server listening [${url}]`);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  server.on('error', (...args: any[]) => {
    console.error('Express server error:', args);
  });

  return server;
};

//
// Graceful shutdown
//

function setupShutdownHandlers() {
  const shutdown = async (signal: string) => {
    log(
      EPriority.Info,
      'GATEWAY',
      `Received ${signal}, initiating graceful shutdown...`
    );

    try {
      await shutdownGateway();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      log(
        EPriority.Critical,
        'GATEWAY',
        'Failed to shutdown gateway:',
        error.message
      );
      // Continue with exit even if shutdown fails
    }

    log(EPriority.Info, 'GATEWAY', 'Shutdown complete, exiting');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

//
// Main
//

(async function main() {
  try {
    bep = new BackendEventProcessor<never>();
    setBackendEventProcessor(bep);

    if (!VPN) throw new Error('VPN config read failed');

    // Setup Express server
    const app = setupExpressApp();
    // Gateway always listens on port 8888 internally (Nginx proxies from external port)
    const bindings: TStart[] = [{ host: '127.0.0.1', port: 8888 }];
    bindings.map((b) => startServer(app, b));

    // Signal gateway is ready (if GATEWAY_ID is set)
    const gatewayId = process.env.GATEWAY_ID;
    if (gatewayId) {
      await signalGatewayReady(gatewayId);
    }

    // Load organization configuration (for hot restart)
    const orgConfig = loadOrganizationConfig();

    if (orgConfig) {
      // NEW: Initialize gateway with organization config
      log(
        EPriority.Info,
        'GATEWAY',
        `Initializing gateway for organization: ${orgConfig.organization_name}`
      );
      await initializeGatewayForOrganization(
        orgConfig.organization_id,
        orgConfig.gateway_id,
        orgConfig.gateway_token
      );
      log(EPriority.Info, 'GATEWAY', 'Gateway ready and serving organization');
    } else {
      log(
        EPriority.Info,
        'GATEWAY',
        'Gateway idle, waiting for organization allocation...'
      );
      // Gateway is registered via app-ganymede-cmd CLI tool
      // Then allocated to organizations via /gateway/start API
      // Initialization happens via /collab/start
    }

    // Setup graceful shutdown
    setupShutdownHandlers();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    log(
      EPriority.Alert,
      'GATEWAY',
      `Fatal error during startup: ${error.message}`
    );
    console.error(error);
    process.exit(1);
  }
})();
