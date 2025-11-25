// Initialize OpenTelemetry BEFORE any other imports
// This ensures auto-instrumentation works correctly
import { initializeNodeObservability } from '@monorepo/observability';
initializeNodeObservability({
  serviceName: process.env.OTEL_SERVICE_NAME || 'gateway',
  environment: process.env.OTEL_DEPLOYMENT_ENVIRONMENT,
});

import express from 'express';
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import { log } from '@monorepo/log';
import {
  setupBasicExpressApp,
  setupErrorsHandler,
  setupValidator,
  TStart,
} from '@monorepo/backend-engine';
import { BackendEventProcessor } from '@monorepo/reducers';

import { VPN } from './config/organization';
import { CONFIG } from './config';
import { setupCollabRoutes, setBackendEventProcessor } from './routes/collab';
import { setupPermissionsRoutes } from './routes/permissions';
import oauthRoutes from './routes/oauth';
import oas from './oas30.json';
import {
  initializeGatewayForOrganization,
  shutdownGateway,
} from './initialization/gateway-init';
import { loadOrganizationConfig } from './config/organization';
import { signalGatewayReady } from './initialization/signal-ready';

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

  // Observability is now handled by @monorepo/observability package
  // Auto-instrumentation will automatically create spans for Express requests
  setupBasicExpressApp(app);

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

  // Routes
  const router = express.Router();
  setupCollabRoutes(router);
  setupPermissionsRoutes(router);
  app.use('/', router);

  // OAuth routes
  app.use('/oauth', oauthRoutes);

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
    log(6, 'GATEWAY', `Express server listening [${url}]`);
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
    log(6, 'GATEWAY', `Received ${signal}, initiating graceful shutdown...`);

    try {
      await shutdownGateway();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      log(2, 'GATEWAY', 'Failed to shutdown gateway:', error.message);
      // Continue with exit even if shutdown fails
    }

    log(6, 'GATEWAY', 'Shutdown complete, exiting');
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
    const bindings: TStart[] = JSON.parse(CONFIG.SERVER_BIND);
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
        6,
        'GATEWAY',
        `Initializing gateway for organization: ${orgConfig.organization_name}`
      );
      await initializeGatewayForOrganization(
        orgConfig.organization_id,
        orgConfig.gateway_id,
        orgConfig.gateway_token
      );
      log(6, 'GATEWAY', 'Gateway ready and serving organization');
    } else {
      log(6, 'GATEWAY', 'Gateway idle, waiting for organization allocation...');
      // Gateway is registered via app-ganymede-cmd CLI tool
      // Then allocated to organizations via /gateway/start API
      // Initialization happens via /collab/start
    }

    // Setup graceful shutdown
    setupShutdownHandlers();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    log(1, 'GATEWAY', `Fatal error during startup: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
})();
