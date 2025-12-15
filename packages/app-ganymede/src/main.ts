// Initialize OpenTelemetry BEFORE any other imports
// This ensures auto-instrumentation works correctly
import { initializeNodeObservability } from '@holistix-forge/observability';
initializeNodeObservability({
  serviceName: process.env.OTEL_SERVICE_NAME || 'ganymede',
  environment: process.env.OTEL_DEPLOYMENT_ENVIRONMENT,
});

import './declarations.d.ts';
import { createApp } from './app';
import { CONFIG } from './config';

//
// Create Express app using factory
// This ensures consistent setup between production and tests
//

const app = createApp();

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
