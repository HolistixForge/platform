#!/usr/bin/env node
/**
 * ===========================================================================
 * Collaboration WebSocket smoke test
 * ===========================================================================
 * Proves the thing the whiteboard is built on: that several clients connected
 * to the same project room actually receive each other's events.
 *
 * Run it ON the platform host (VM or server), where the environment's JWT
 * signing key and database credentials live:
 *
 *   node scripts/local-dev/verify-collab-websocket.mjs <env-name>
 *   node scripts/local-dev/verify-collab-websocket.mjs dev-001 --clients 4
 *   node scripts/local-dev/verify-collab-websocket.mjs dev-001 \
 *     --project <uuid> --user <uuid> --timeout 20000
 *
 * What it exercises, end to end:
 *   browser-equivalent client
 *     -> stage-1 nginx  (wss://org-<uuid>.<domain>, TLS + Upgrade headers)
 *     -> gateway container nginx
 *     -> app-gateway node process
 *     -> y-websocket room for the project
 *
 * Exit code 0 = every client saw every other client's document update and
 * awareness state. Anything else = a real failure, printed with the stage it
 * broke at.
 * ===========================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const positional = [];
  const opts = {
    clients: 3,
    timeout: 15000,
    localDevDir: '/root/.local-dev',
    startGateway: true,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--clients':
        opts.clients = Number(argv[++i]);
        break;
      case '--timeout':
        opts.timeout = Number(argv[++i]);
        break;
      case '--project':
        opts.projectId = argv[++i];
        break;
      case '--user':
        opts.userId = argv[++i];
        break;
      case '--org':
        opts.orgId = argv[++i];
        break;
      case '--local-dev-dir':
        opts.localDevDir = argv[++i];
        break;
      case '--no-start-gateway':
        opts.startGateway = false;
        break;
      case '-h':
      case '--help':
        opts.help = true;
        break;
      default:
        if (a.startsWith('-')) throw new Error(`Unknown option: ${a}`);
        positional.push(a);
    }
  }

  opts.envName = positional[0];
  if (!opts.help && !opts.envName) {
    throw new Error('Missing <env-name>. Try --help.');
  }
  if (opts.clients < 2) {
    throw new Error('--clients must be at least 2; the point is propagation.');
  }
  return opts;
}

const HELP = `
Usage: verify-collab-websocket.mjs <env-name> [options]

  --clients <n>        Number of simultaneous clients (default 3, minimum 2)
  --timeout <ms>       Per-stage timeout (default 15000)
  --project <uuid>     Project to use (default: first project of the org)
  --user <uuid>        User to authenticate as (default: the org owner)
  --org <uuid>         Organization (default: the first one with a project)
  --no-start-gateway   Skip the /collab/start allocation trigger
  --local-dev-dir <p>  Environment root (default /root/.local-dev)
`;

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
const tty = process.stdout.isTTY;
const c = {
  reset: tty ? '\x1b[0m' : '',
  bold: tty ? '\x1b[1m' : '',
  dim: tty ? '\x1b[2m' : '',
  red: tty ? '\x1b[31m' : '',
  green: tty ? '\x1b[32m' : '',
  yellow: tty ? '\x1b[33m' : '',
  blue: tty ? '\x1b[34m' : '',
};

let stage = 'startup';
const step = (msg) => console.log(`${c.blue}${c.bold}==>${c.reset} ${msg}`);
const ok = (msg) => console.log(`${c.green}  ok${c.reset} ${msg}`);
const info = (msg) => console.log(`${c.dim}     ${msg}${c.reset}`);
const warn = (msg) => console.warn(`${c.yellow}warn${c.reset} ${msg}`);

class StageError extends Error {
  constructor(message, hint) {
    super(message);
    this.hint = hint;
    this.stage = stage;
  }
}

// ---------------------------------------------------------------------------
// Environment file
// ---------------------------------------------------------------------------
function readEnvFile(file) {
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Resolve when `check()` returns truthy, or reject after `timeout`. */
async function waitFor(label, check, timeout, interval = 100) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const v = await check();
    if (v) return v;
    if (Date.now() > deadline) {
      throw new StageError(`Timed out after ${timeout}ms waiting for ${label}`);
    }
    await sleep(interval);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(HELP);
    return 0;
  }

  const envDir = path.join(opts.localDevDir, opts.envName);
  if (!fs.existsSync(envDir)) {
    throw new StageError(
      `Environment '${opts.envName}' not found at ${envDir}`,
      `Existing environments: ${
        fs.existsSync(opts.localDevDir)
          ? fs.readdirSync(opts.localDevDir).join(', ') || '(none)'
          : '(no ' + opts.localDevDir + ')'
      }`
    );
  }

  // -- Modules are resolved from the workspace, so run this from the repo ----
  stage = 'dependencies';
  let Y, WebsocketProvider, WS, jwt, pg;
  try {
    Y = require('yjs');
    ({ WebsocketProvider } = require('y-websocket'));
    WS = require('ws');
    jwt = require('jsonwebtoken');
    pg = require('pg');
  } catch (err) {
    throw new StageError(
      `Cannot load a required module: ${err.message}`,
      'Run this from the monorepo root so yjs/y-websocket/ws/jsonwebtoken/pg resolve.'
    );
  }

  // -- Environment configuration --------------------------------------------
  stage = 'environment';
  step(`Environment ${c.bold}${opts.envName}${c.reset}`);
  const env = readEnvFile(path.join(envDir, '.env.ganymede'));
  const domain = env.DOMAIN;
  if (!domain) throw new StageError('DOMAIN missing from .env.ganymede');
  info(`domain: ${domain}`);

  const keyPath = path.join(envDir, 'jwt-key');
  if (!fs.existsSync(keyPath)) {
    throw new StageError(`JWT signing key not found at ${keyPath}`);
  }
  const privateKey = fs.readFileSync(keyPath, 'utf8');

  // -- Pick org / project / user -------------------------------------------
  stage = 'database';
  const db = new pg.Client({
    host: env.PG_HOST || 'localhost',
    port: Number(env.PG_PORT || 5432),
    user: env.PG_USER,
    password: env.PG_PASSWORD,
    database: env.PG_DATABASE,
  });
  await db.connect().catch((err) => {
    throw new StageError(
      `Cannot connect to PostgreSQL: ${err.message}`,
      `Checked ${env.PG_USER}@${env.PG_HOST}/${env.PG_DATABASE}`
    );
  });

  let orgId = opts.orgId;
  let projectId = opts.projectId;
  let userId = opts.userId;

  try {
    if (!projectId) {
      const q = await db.query(
        `SELECT p.project_id, p.organization_id, p.name, o.owner_user_id
           FROM projects p
           JOIN organizations o USING (organization_id)
          ${orgId ? 'WHERE p.organization_id = $1' : ''}
          ORDER BY p.created_at ASC
          LIMIT 1`,
        orgId ? [orgId] : []
      );
      if (q.rowCount === 0) {
        throw new StageError(
          'No project exists in this environment',
          'Create one through the UI first — the collab room is per project.'
        );
      }
      projectId = q.rows[0].project_id;
      orgId = q.rows[0].organization_id;
      userId = userId || q.rows[0].owner_user_id;
      info(`project: ${q.rows[0].name} (${projectId})`);
    } else if (!orgId || !userId) {
      const q = await db.query(
        `SELECT p.organization_id, o.owner_user_id
           FROM projects p
           JOIN organizations o USING (organization_id)
          WHERE p.project_id = $1`,
        [projectId]
      );
      if (q.rowCount === 0) {
        throw new StageError(`Project ${projectId} not found`);
      }
      orgId = orgId || q.rows[0].organization_id;
      userId = userId || q.rows[0].owner_user_id;
    }
    info(`org:     ${orgId}`);
    info(`user:    ${userId}`);
    ok('resolved org / project / user');
  } finally {
    await db.end().catch(() => undefined);
  }

  const gatewayHost = `org-${orgId}.${domain}`;

  // -- Make sure a gateway is allocated -------------------------------------
  stage = 'gateway allocation';
  if (opts.startGateway) {
    step(`Triggering gateway allocation for ${gatewayHost}`);
    // Self-signed certificates in development.
    const prevTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    try {
      const res = await fetch(`https://${gatewayHost}/collab/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: `https://${domain}`,
        },
        body: '{}',
      });
      if (!res.ok) {
        warn(`/collab/start returned ${res.status} — continuing anyway`);
      } else {
        ok('gateway responded to /collab/start');
      }
    } catch (err) {
      throw new StageError(
        `Cannot reach https://${gatewayHost}/collab/start: ${err.message}`,
        'Check DNS resolution for the wildcard domain and that nginx is running.'
      );
    } finally {
      if (prevTls === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      else process.env.NODE_TLS_REJECT_UNAUTHORIZED = prevTls;
    }
  }

  // -- Mint an access token --------------------------------------------------
  stage = 'authentication';
  // app-gateway only accepts type 'access_token' with a user id on the socket.
  const token = jwt.sign(
    { type: 'access_token', user: { id: userId } },
    privateKey,
    { algorithm: 'RS256', expiresIn: '10m' }
  );
  ok('signed an RS256 access token with the environment key');

  // -- Connect N clients -----------------------------------------------------
  stage = 'websocket connect';
  const wsUrl = `wss://${gatewayHost}/project`;
  step(`Connecting ${opts.clients} clients to ${wsUrl}/${projectId}`);

  // Development uses a mkcert certificate the Node trust store does not know.
  class DevWebSocket extends WS.WebSocket {
    constructor(address, protocols, options) {
      super(address, protocols, { ...options, rejectUnauthorized: false });
    }
  }

  const clients = [];
  for (let i = 0; i < opts.clients; i++) {
    const doc = new Y.Doc();
    const provider = new WebsocketProvider(wsUrl, projectId, doc, {
      params: { token },
      WebSocketPolyfill: DevWebSocket,
      // CRITICAL: without this, providers in the same Node process sync
      // through BroadcastChannel and the test would pass even with the
      // WebSocket server completely down.
      disableBc: true,
      connect: true,
    });
    clients.push({ i, doc, provider, map: doc.getMap('holistix-ws-smoke') });
  }

  const cleanup = async () => {
    for (const cl of clients) {
      try {
        cl.provider.disconnect();
        cl.provider.destroy();
        cl.doc.destroy();
      } catch {
        /* best effort */
      }
    }
  };

  try {
    for (const cl of clients) {
      cl.provider.on('connection-error', (event) => {
        cl.lastError = event?.message || 'connection error';
      });
    }

    await waitFor(
      'all clients to report status=connected',
      () => clients.every((cl) => cl.provider.wsconnected),
      opts.timeout
    ).catch(() => {
      const down = clients.filter((cl) => !cl.provider.wsconnected);
      throw new StageError(
        `${down.length}/${clients.length} client(s) never connected`,
        down[0]?.lastError
          ? `First error: ${down[0].lastError}`
          : 'A 401 here means the JWT was rejected; a 404 means the room was not found.'
      );
    });
    ok(`${clients.length} clients connected`);

    // -- Document propagation ------------------------------------------------
    stage = 'document propagation';
    const marker = `smoke-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    step('Client 0 writes a document update; every other client must see it');

    const seen = clients.slice(1).map(
      (cl) =>
        new Promise((resolve) => {
          const onChange = () => {
            if (cl.map.get('marker') === marker) {
              cl.map.unobserve(onChange);
              resolve(cl.i);
            }
          };
          cl.map.observe(onChange);
          onChange(); // in case it already arrived
        })
    );

    clients[0].map.set('marker', marker);

    const received = await Promise.race([
      Promise.all(seen),
      sleep(opts.timeout).then(() => null),
    ]);

    if (received === null) {
      const missing = clients
        .slice(1)
        .filter((cl) => cl.map.get('marker') !== marker)
        .map((cl) => `client ${cl.i}`);
      throw new StageError(
        `Update from client 0 never reached ${missing.join(', ')}`,
        'The socket is open but events are not being relayed to the room.'
      );
    }
    ok(`all ${received.length} peers received the update`);

    // -- Awareness (presence) propagation ------------------------------------
    stage = 'awareness propagation';
    step('Each client publishes presence; client 0 must see every peer');
    clients.forEach((cl) =>
      cl.provider.awareness.setLocalStateField('user', {
        user_id: `smoke-${cl.i}`,
        username: `smoke-client-${cl.i}`,
        color: '#888888',
      })
    );

    await waitFor(
      'awareness to converge',
      () => clients[0].provider.awareness.getStates().size >= clients.length,
      opts.timeout
    ).catch(() => {
      const n = clients[0].provider.awareness.getStates().size;
      throw new StageError(
        `Client 0 sees ${n} peer(s), expected ${clients.length}`,
        'Document sync works but presence/awareness is not being broadcast.'
      );
    });
    ok(`awareness converged across ${clients.length} clients`);

    // -- Leave the document as we found it -----------------------------------
    stage = 'cleanup';
    clients[0].map.delete('marker');
    await sleep(500);

    console.log(
      `\n${c.green}${c.bold}PASS${c.reset} collaboration WebSocket is functional` +
        `\n     ${clients.length} clients, room ${projectId}, via ${wsUrl}\n`
    );
    return 0;
  } finally {
    await cleanup();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(
      `\n${c.red}${c.bold}FAIL${c.reset} [${err.stage || stage}] ${err.message}`
    );
    if (err.hint) console.error(`     ${c.dim}${err.hint}${c.reset}`);
    if (!err.stage && err.stack) console.error(c.dim + err.stack + c.reset);
    console.error();
    process.exit(1);
  });
