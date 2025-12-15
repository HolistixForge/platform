// CRITICAL: Import tracing first to register instrumentations
import './tracing';

// DEBUG: Test manual span creation
import { trace } from '@opentelemetry/api';
const tracer = trace.getTracer('ganymede-manual-test');
const testSpan = tracer.startSpan('app-startup');
console.log('[DEBUG] Manual test span created:', testSpan ? 'YES' : 'NO');
testSpan.end();

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
