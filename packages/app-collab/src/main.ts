import express from 'express';
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import { log } from '@monorepo/log';
import { setupBasicExpressApp, setupErrorsHandler, setupValidator, TStart } from '@monorepo/backend-engine';
import { BackendEventProcessor } from '@monorepo/reducers';
import { TProjectConfig } from '@monorepo/gateway';
import { makeUuid, sleep } from '@monorepo/simple-types';

import { initProjectCollaboration } from './build-collab';
import { PROJECT, VPN, setProjectConfig } from './project-config';
import { CONFIG } from './config';
import { 
  setupCollabRoutes, 
  setBackendEventProcessor, 
  setRoomId,
  setStartProjectCollabCallback 
} from './routes/collab';
import oauthRoutes from './routes/oauth';
import containerRoutes from './routes/containers';
import * as oas from './oas30.json';
import { initializeGateway, shutdownGateway } from './initialization/gateway-init';
import { ProjectRoomsManager } from './state/ProjectRooms';
import { loadOrganizationConfig } from './config/organization';

//
// Global state
//

let bep: BackendEventProcessor<any>;
let projectRooms: ProjectRoomsManager | null = null;

//
// Legacy single-project mode (backwards compatibility)
//

const startProjectCollab = async (project: TProjectConfig) => {
  setProjectConfig(project);
  const roomId = makeUuid();
  setRoomId(roomId);
  await initProjectCollaboration(bep);
  log(6, 'GATEWAY', `Legacy single-project mode: room ID ${roomId}`);
};

//
// Express setup
//

const setupExpressApp = () => {
  const app = express();
  app.set('trust proxy', 1);

  setupBasicExpressApp(app, {
    jaeger: process.env.JAEGER_FQDN
      ? {
          serviceName: 'demiurge',
          serviceTag: 'collab',
          host: process.env.JAEGER_FQDN,
        }
      : undefined,
  });

  app.options('*', (req, res) => {
    res.status(200).end();
  });

  // OpenAPI validation
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

  // Routes
  const router = express.Router();
  setupCollabRoutes(router);
  app.use('/', router);
  
  // OAuth routes
  app.use('/oauth', oauthRoutes);
  
  // Container routes
  app.use('/containers', containerRoutes);

  // Error handler
  setupErrorsHandler(app);

  return app;
};

//
// Server startup
//

const startServer = (app: express.Express, config: TStart): https.Server | http.Server => {
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

  server.on('error', (...args: any[]) => {
    console.error('Express server error:', args);
  });

  return server;
};

//
// Signal gateway ready to Ganymede
//

const signalGatewayReady = async () => {
  while (true) {
    try {
      const response = await fetch(`https://${CONFIG.GANYMEDE_FQDN}/gateway/ready`, {
        method: 'POST',
        headers: { 
          'authorization': CONFIG.GATEWAY_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          gateway_id: projectRooms?.getProjectCount() ? 'org-gateway' : 'legacy-gateway' 
        })
      });
      
      if (response.ok) {
        log(6, 'GATEWAY', 'Successfully signaled ready to Ganymede');
        break;
      }
    } catch (e: any) {
      log(6, 'GATEWAY', `Can't set ready flag on Ganymede [${e.message}]`);
      await sleep(5);
    }
  }
};

//
// Graceful shutdown
//

function setupShutdownHandlers() {
  const shutdown = async (signal: string) => {
    log(6, 'GATEWAY', `Received ${signal}, initiating graceful shutdown...`);
    
    if (projectRooms) {
      await shutdownGateway(projectRooms);
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
    bep = new BackendEventProcessor<any>();
    setBackendEventProcessor(bep);
    setStartProjectCollabCallback(startProjectCollab);

    if (!VPN) throw new Error('VPN config read failed');

    // Setup Express server
    const app = setupExpressApp();
    const bindings: TStart[] = JSON.parse(CONFIG.SERVER_BIND);
    bindings.map((b) => startServer(app, b));

    // Load organization configuration
    const orgConfig = loadOrganizationConfig();
    
    if (orgConfig) {
      // NEW: Initialize gateway with organization config
      log(6, 'GATEWAY', `Initializing gateway for organization: ${orgConfig.organization_name}`);
      projectRooms = await initializeGateway(orgConfig);
      await signalGatewayReady();
      log(6, 'GATEWAY', 'Gateway ready and serving organization');
    } else if (PROJECT) {
      // LEGACY: Support old single-project mode for backwards compatibility
      log(5, 'GATEWAY', 'Running in legacy single-project mode (no organization config)');
      await startProjectCollab(PROJECT);
    } else {
      log(3, 'GATEWAY', 'No organization config or project config found - gateway idle');
      await signalGatewayReady();
    }

    // Setup graceful shutdown
    setupShutdownHandlers();
    
  } catch (error: any) {
    log(1, 'GATEWAY', `Fatal error during startup: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
})();
