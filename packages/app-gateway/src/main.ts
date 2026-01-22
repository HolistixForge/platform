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
import { setupMembersRoutes } from './routes/members';
import { setupRolesRoutes } from './routes/roles';
import { setupProtectedServicesRoutes } from './routes/protected-services';
import { setupOauthRoutes } from './routes/oauth';
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

export const setupExpressApp = (options?: {
  skipValidation?: boolean;
  setupAdditionalRoutes?: (
    router: express.Router,
    rateLimiters: {
      api?: express.RequestHandler;
      oauth?: express.RequestHandler;
    }
  ) => void;
}) => {
  const app = express();
  app.set('trust proxy', 1);

  // Observability is now handled by @holistix-forge/observability package
  // Auto-instrumentation will automatically create spans for Express requests
  // Gateway-specific CSRF exemptions:
  // - /collab/:project_id: WebSocket connections for YJS collaboration
  //   (WebSocket upgrade requests use GET, but clients may POST to collab endpoint)
  setupBasicExpressApp(app, {
    csrfExemptPaths: [
      '/collab/:project_id', // YJS collaboration endpoint (supports Express params)
    ],
  });

  // Global rate limiter (apply to all routes as baseline protection)
  if (isRateLimitingEnabled()) {
    app.use(globalLimiter);
  }

  app.options('*', (req, res) => {
    res.status(200).end();
  });

  // OpenAPI validation
  if (!options?.skipValidation) {
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
  }

  // Routes with rate limiting
  const router = express.Router();
  const rateLimiters = {
    api: isRateLimitingEnabled() ? apiLimiter : undefined,
    oauth: isRateLimitingEnabled() ? oauthLimiter : undefined,
  };

  setupCollabRoutes(router, rateLimiters.api);
  setupPermissionsRoutes(router, rateLimiters.api);
  setupMembersRoutes(router, rateLimiters.api);
  setupRolesRoutes(router, rateLimiters.api);
  setupProtectedServicesRoutes(router, rateLimiters.api);
  setupOauthRoutes(router, rateLimiters.oauth);

  // Additional routes (e.g., test routes)
  if (options?.setupAdditionalRoutes) {
    options.setupAdditionalRoutes(router, rateLimiters);
  }

  app.use('/', router);

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

// Store server instances for WebSocket grafting
import { setServers } from './servers';
let servers: (http.Server | https.Server)[] = [];

(async function main() {
  try {
    bep = new BackendEventProcessor<never>();
    setBackendEventProcessor(bep);

    if (!VPN) throw new Error('VPN config read failed');

    // Setup Express server
    const app = setupExpressApp();
    // Gateway always listens on port 8888 internally (Nginx proxies from external port)
    const bindings: TStart[] = [{ host: '127.0.0.1', port: 8888 }];
    servers = bindings.map((b) => startServer(app, b));
    
    // Make servers available globally for WebSocket grafting
    setServers(servers);

    // Signal gateway is ready (if GATEWAY_ID is set)
    // Run in background - don't block gateway startup if Ganymede is unreachable
    const gatewayId = process.env.GATEWAY_ID;
    if (gatewayId) {
      signalGatewayReady(gatewayId).catch((err) => {
        log(
          EPriority.Warning,
          'GATEWAY',
          `Failed to signal ready to Ganymede: ${err.message}`
        );
      });
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
        orgConfig.gateway_token,
        servers  // Pass servers for WebSocket initialization
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
