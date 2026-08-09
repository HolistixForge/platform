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
      case '--bootstrap':
        opts.bootstrap = true;
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
  --bootstrap          Create the test user, org and project if none exist
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
// Bootstrap: make sure there is something to collaborate on
// ---------------------------------------------------------------------------
const TEST_ACCOUNTS = [
  {
    email: 'claude@test.local',
    password: 'TestUser123!',
    username: 'claude-test',
    firstname: 'Claude',
    lastname: 'Test',
  },
  {
    email: 'claude2@test.local',
    password: 'TestUser123!',
    username: 'claude-test-2',
    firstname: 'Claude',
    lastname: 'Two',
  },
];

/** Sign a user access token with the environment key. */
function signUserToken(jwt, privateKey, account) {
  // authenticateJwtUser accepts the 'token ' prefix only, not 'Bearer '.
  return jwt.sign(
    {
      type: 'access_token',
      user: { id: account.user_id, username: `local:${account.username}` },
    },
    privateKey,
    { algorithm: 'RS256', expiresIn: '30m' },
  );
}

/** Create the account through the real signup route if it is missing. */
async function ensureUser(db, api, domain, account) {
  const find = () =>
    db.query('SELECT user_id FROM users WHERE email = $1', [account.email]);

  let row = await find();
  if (row.rowCount > 0) {
    info(`user ${account.email} already exists`);
    return { ...account, user_id: row.rows[0].user_id, created: false };
  }

  const res = await fetch(`${api}/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: `https://${domain}`,
    },
    body: JSON.stringify(account),
  }).catch((err) => {
    throw new StageError(
      `Cannot reach ${api}/signup: ${err.message}`,
      'Is Ganymede running? ./scripts/local-dev/envctl.sh status <env>',
    );
  });

  if (!res.ok) {
    throw new StageError(
      `Signup for ${account.email} failed with ${res.status}: ${(await res.text()).slice(0, 300)}`,
    );
  }

  row = await find();
  if (row.rowCount === 0) {
    throw new StageError('Signup reported success but no user row appeared');
  }
  ok(`created user ${account.email}`);
  return { ...account, user_id: row.rows[0].user_id, created: true };
}

/**
 * A freshly created environment has no user, organization or project, and the
 * collab room is per project — so there would be nothing to join.
 *
 * Creates two accounts in one organization, which is what live collaboration
 * actually needs: a second browser signed in as a different person. Everything
 * goes through the real Ganymede API rather than direct inserts, so the
 * permissions the gateway checks are built exactly as they are for a human.
 *
 * Every step is individually idempotent, so this also repairs a half-built
 * environment (for instance one created before the second account existed).
 *
 * Returns the accounts and the project to test with.
 */
async function bootstrap({ db, domain, privateKey, jwt }) {
  const previousStage = stage;
  stage = 'bootstrap';

  step('Ensuring two test accounts share an organization and a project');
  const api = `https://ganymede.${domain}`;
  const prevTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  try {
    const owner = await ensureUser(db, api, domain, TEST_ACCOUNTS[0]);

    // proc_users_new creates an organization alongside the user.
    const org = await db.query(
      'SELECT organization_id, name FROM organizations WHERE owner_user_id = $1 ORDER BY created_at LIMIT 1',
      [owner.user_id],
    );
    if (org.rowCount === 0) {
      throw new StageError(
        `No organization owned by ${owner.user_id}`,
        'Signup normally creates one; check proc_users_new.',
      );
    }
    const orgId = org.rows[0].organization_id;
    info(`organization: ${org.rows[0].name} (${orgId})`);

    const ownerToken = signUserToken(jwt, privateKey, owner);
    const authed = (extra = {}) => ({
      'Content-Type': 'application/json',
      Authorization: `token ${ownerToken}`,
      Origin: `https://${domain}`,
      ...extra,
    });

    // The second account joins as `admin`, not `member`. gateway-init only
    // auto-assigns a gateway role for owner and admin — a plain member gets
    // none and its WebSocket would be rejected for lack of project access.
    const peer = await ensureUser(db, api, domain, TEST_ACCOUNTS[1]);

    const membership = await db.query(
      'SELECT role FROM organizations_members WHERE organization_id = $1 AND user_id = $2',
      [orgId, peer.user_id],
    );
    if (membership.rowCount === 0 || membership.rows[0].role === 'member') {
      const res = await fetch(`${api}/orgs/${orgId}/members`, {
        method: 'POST',
        headers: authed(),
        body: JSON.stringify({ user_id: peer.user_id, role: 'admin' }),
      });
      if (!res.ok) {
        throw new StageError(
          `Adding ${peer.email} to the organization failed with ${res.status}: ${(await res.text()).slice(0, 300)}`,
        );
      }
      ok(`${peer.email} added to the organization as admin`);
    } else {
      info(
        `${peer.email} is already ${membership.rows[0].role} of the organization`,
      );
    }

    // Project
    const projectName = 'ws-smoke-test';
    let project = await db.query(
      'SELECT project_id FROM projects WHERE organization_id = $1 AND name = $2',
      [orgId, projectName],
    );

    if (project.rowCount === 0) {
      const res = await fetch(`${api}/projects`, {
        method: 'POST',
        headers: authed(),
        body: JSON.stringify({
          organization_id: orgId,
          name: projectName,
          public: false,
        }),
      });
      if (!res.ok) {
        throw new StageError(
          `Project creation failed with ${res.status}: ${(await res.text()).slice(0, 300)}`,
        );
      }
      const created = await res.json();
      ok(`created project ${projectName} (${created.project_id})`);
      project = { rows: [{ project_id: created.project_id }], rowCount: 1 };
    } else {
      info(`project ${projectName} already exists`);
    }

    console.log(
      `\n${c.bold}Sign in from your browser with either account${c.reset}\n` +
        TEST_ACCOUNTS.map(
          (a) =>
            `     ${a.email}  /  ${a.password}   (${a.firstname} ${a.lastname})`,
        ).join('\n') +
        `\n     https://${domain}\n`,
    );

    return {
      orgId,
      projectId: project.rows[0].project_id,
      accounts: [owner, peer],
    };
  } finally {
    if (prevTls === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    else process.env.NODE_TLS_REJECT_UNAUTHORIZED = prevTls;
    stage = previousStage;
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
      }`,
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
      'Run this from the monorepo root so yjs/y-websocket/ws/jsonwebtoken/pg resolve.',
    );
  }

  // -- Environment configuration --------------------------------------------
  stage = 'environment';
  step(`Environment ${c.bold}${opts.envName}${c.reset}`);
  // Two layouts, because there are two ways to stand an environment up and
  // both are current. create-env.sh writes `.env.ganymede` and `jwt-key` under
  // /root/.local-dev; the macOS harness writes `ganymede.env` and `jwt.key`
  // under ~/.holistix-macos. Nothing else here differs — DOMAIN simply carries
  // a port on macOS, which every URL built from it already wanted.
  const pick = (...names) => {
    for (const name of names) {
      const candidate = path.join(envDir, name);
      if (fs.existsSync(candidate)) return candidate;
    }
    return null;
  };

  const envFile = pick('.env.ganymede', 'ganymede.env');
  if (!envFile) {
    throw new StageError(
      `No environment file in ${envDir}`,
      'Looked for .env.ganymede (Linux) and ganymede.env (macOS).',
    );
  }
  const env = readEnvFile(envFile);
  const domain = env.DOMAIN;
  if (!domain) throw new StageError(`DOMAIN missing from ${envFile}`);
  info(`domain: ${domain}`);

  const keyPath = pick('jwt-key', 'jwt.key');
  if (!keyPath) {
    throw new StageError(
      `JWT signing key not found in ${envDir}`,
      'Looked for jwt-key (Linux) and jwt.key (macOS).',
    );
  }
  const privateKey = fs.readFileSync(keyPath, 'utf8');

  // -- Pick org / project / user -------------------------------------------
  stage = 'database';

  let orgId = opts.orgId;
  let projectId = opts.projectId;
  let userId = opts.userId;
  let accounts = null;

  /**
   * Postgres is only consulted to answer questions the caller did not.
   *
   * It sits on the container network, which on macOS a Homebrew `node` cannot
   * reach at all — the same address answers `nc` and refuses node, because of
   * the local-network privacy check. The application itself is reachable, so
   * connecting three clients and watching them converge works fine there; it
   * was only this lookup that made the whole script unrunnable. Told which
   * org, project and user to use, it now never opens the connection.
   */
  const needsDb = opts.bootstrap || !orgId || !projectId || !userId;
  const db = needsDb
    ? new pg.Client({
        host: env.PG_HOST || 'localhost',
        port: Number(env.PG_PORT || 5432),
        user: env.PG_USER,
        password: env.PG_PASSWORD,
        database: env.PG_DATABASE,
      })
    : null;

  if (!db) {
    info('database: not consulted — org, project and user were all given');
  } else {
    await db.connect().catch((err) => {
      throw new StageError(
        `Cannot connect to PostgreSQL: ${err.message}`,
        `Checked ${env.PG_USER}@${env.PG_HOST}/${env.PG_DATABASE}. ` +
          'Passing --org, --project and --user skips this step entirely.',
      );
    });
  }

  try {
    if (!db) {
      info(`project: ${projectId}`);
    }
    if (opts.bootstrap) {
      const bootstrapped = await bootstrap({ db, domain, privateKey, jwt });
      orgId = orgId || bootstrapped.orgId;
      projectId = projectId || bootstrapped.projectId;
      userId = userId || bootstrapped.accounts[0].user_id;
      accounts = bootstrapped.accounts;
    }

    if (!projectId) {
      const q = await db.query(
        `SELECT p.project_id, p.organization_id, p.name, o.owner_user_id
           FROM projects p
           JOIN organizations o USING (organization_id)
          ${orgId ? 'WHERE p.organization_id = $1' : ''}
          ORDER BY p.created_at ASC
          LIMIT 1`,
        orgId ? [orgId] : [],
      );
      if (q.rowCount === 0) {
        throw new StageError(
          'No project exists in this environment',
          'Create one through the UI first — the collab room is per project.',
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
        [projectId],
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
    await db?.end().catch(() => undefined);
  }

  // -- Mint an access token --------------------------------------------------
  stage = 'authentication';
  // app-gateway only accepts type 'access_token' with a user id on the socket.
  // Spread the clients over every known account. With --bootstrap that means
  // two distinct users, which is what live collaboration actually looks like
  // and proves per-user authorisation rather than one token replayed N times.
  if (!accounts) {
    accounts = [{ user_id: userId, username: 'smoke-test' }];
  }
  const tokens = accounts.map((a) => signUserToken(jwt, privateKey, a));
  const token = tokens[0];
  ok(
    `signed ${tokens.length} RS256 access token(s) with the environment key` +
      (accounts.length > 1
        ? ` (${accounts.map((a) => a.email || a.user_id).join(', ')})`
        : ''),
  );

  // Development uses a mkcert certificate the Node trust store does not know.
  class DevWebSocket extends WS.WebSocket {
    constructor(address, protocols, options) {
      super(address, protocols, { ...options, rejectUnauthorized: false });
    }
  }

  // -- Allocate a gateway for this organization ------------------------------
  stage = 'gateway allocation';
  let gatewayHost = `org-${orgId}.${domain}`;

  if (opts.startGateway) {
    step(`Allocating a gateway for organization ${orgId}`);
    const prevTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    try {
      // Ganymede owns allocation and writes the nginx vhost for the gateway.
      // Until it has run, org-<uuid>.<domain> falls through to the frontend
      // server block and a WebSocket upgrade there just returns 200.
      const res = await fetch(`https://ganymede.${domain}/gateway/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `token ${token}`,
          Origin: `https://${domain}`,
        },
        body: JSON.stringify({ organization_id: orgId }),
      }).catch((err) => {
        throw new StageError(
          `Cannot reach https://ganymede.${domain}/gateway/start: ${err.message}`,
          'Check DNS for the domain and that Ganymede and nginx are running.',
        );
      });

      if (!res.ok) {
        throw new StageError(
          `Gateway allocation failed with ${res.status}: ${(await res.text()).slice(0, 300)}`,
        );
      }
      const body = await res.json();
      if (body.gateway_hostname) gatewayHost = body.gateway_hostname;
      ok(`gateway allocated: ${gatewayHost}`);
    } finally {
      if (prevTls === undefined)
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      else process.env.NODE_TLS_REJECT_UNAUTHORIZED = prevTls;
    }
  }

  // Allocation returns as soon as the record exists; nginx still has to reload
  // and the gateway container has to fetch its config and open the room. Probe
  // with a real upgrade so the wait ends the moment it can actually serve one.
  stage = 'gateway readiness';
  const probeUrl = `wss://${gatewayHost}/project/${projectId}?token=${token}`;
  step('Waiting for the gateway to accept a WebSocket upgrade');

  const probe = () =>
    new Promise((resolve) => {
      const sock = new DevWebSocket(probeUrl);
      const finish = (verdict) => {
        try {
          sock.terminate();
        } catch {
          /* already gone */
        }
        resolve(verdict);
      };
      sock.on('open', () => finish('open'));
      sock.on('unexpected-response', (_req, res) =>
        finish(`HTTP ${res.statusCode}`),
      );
      sock.on('error', (err) => finish(err.message));
    });

  let lastVerdict = 'no attempt';
  const readyDeadline = Date.now() + Math.max(opts.timeout, 60000);
  for (;;) {
    lastVerdict = await probe();
    if (lastVerdict === 'open') break;
    if (Date.now() > readyDeadline) {
      throw new StageError(
        `Gateway never accepted an upgrade (last response: ${lastVerdict})`,
        lastVerdict.startsWith('HTTP 200')
          ? 'A 200 means the request hit the frontend vhost — no gateway nginx config for this org.'
          : 'Check: docker logs gw-pool-<env>-N and /tmp/gateway.log inside the container.',
      );
    }
    await sleep(2000);
  }
  ok('gateway is serving WebSocket upgrades');

  // -- Connect N clients -----------------------------------------------------
  stage = 'websocket connect';
  const wsUrl = `wss://${gatewayHost}/project`;
  step(`Connecting ${opts.clients} clients to ${wsUrl}/${projectId}`);

  const clients = [];
  for (let i = 0; i < opts.clients; i++) {
    const doc = new Y.Doc();
    const provider = new WebsocketProvider(wsUrl, projectId, doc, {
      params: { token: tokens[i % tokens.length] },
      WebSocketPolyfill: DevWebSocket,
      // CRITICAL: without this, providers in the same Node process sync
      // through BroadcastChannel and the test would pass even with the
      // WebSocket server completely down.
      disableBc: true,
      connect: true,
    });
    clients.push({
      i,
      doc,
      provider,
      account: accounts[i % accounts.length],
      map: doc.getMap('holistix-ws-smoke'),
    });
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
      opts.timeout,
    ).catch(() => {
      const down = clients.filter((cl) => !cl.provider.wsconnected);
      throw new StageError(
        `${down.length}/${clients.length} client(s) never connected`,
        down[0]?.lastError
          ? `First error: ${down[0].lastError}`
          : 'A 401 here means the JWT was rejected; a 404 means the room was not found.',
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
        }),
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
        'The socket is open but events are not being relayed to the room.',
      );
    }
    ok(`all ${received.length} peers received the update`);

    // -- Awareness (presence) propagation ------------------------------------
    stage = 'awareness propagation';
    step('Each client publishes presence; client 0 must see every peer');
    clients.forEach((cl) =>
      cl.provider.awareness.setLocalStateField('user', {
        user_id: cl.account.user_id,
        username: cl.account.username || `smoke-client-${cl.i}`,
        color: '#888888',
      }),
    );

    await waitFor(
      'awareness to converge',
      () => clients[0].provider.awareness.getStates().size >= clients.length,
      opts.timeout,
    ).catch(() => {
      const n = clients[0].provider.awareness.getStates().size;
      throw new StageError(
        `Client 0 sees ${n} peer(s), expected ${clients.length}`,
        'Document sync works but presence/awareness is not being broadcast.',
      );
    });
    ok(`awareness converged across ${clients.length} clients`);

    // -- Two people drawing at once ------------------------------------------
    //
    // The scenario TAC-213 asks for, and the recipe test for phase 1.
    //
    // A drawing used to be one entry in the shared map — the whole element
    // array, rewritten on every stroke. Two people drawing at the same time
    // wrote the same key, so the later write replaced the earlier one whole
    // and one of them lost their work. Nothing reported it: both clients
    // converged, on the wrong scene.
    //
    // One entry per element instead, keyed `<drawingId>::<elementId>`, so the
    // map's own per-key concurrency does the merging. This test would have
    // failed before that change and is expected to pass now.
    //
    // The two clients are disconnected while they draw, so the divergence is
    // real rather than two writes that happen to be ordered by the server.
    stage = 'per-element concurrency';
    const [alice, bob] = clients;
    const drawing = `smoke-${Date.now()}`;
    const elementsOf = (cl) => cl.doc.getMap('excalidraw:elements');
    const keyA = `${drawing}::el-alice`;
    const keyB = `${drawing}::el-bob`;
    const stroke = (id, x) => ({
      drawingId: drawing,
      element: { id, type: 'rectangle', x, y: 0, width: 10, height: 10, version: 1 },
    });

    step('Two clients draw at the same time, offline; neither may lose work');

    alice.provider.disconnect();
    bob.provider.disconnect();
    await waitFor(
      'both clients to be offline',
      () => !alice.provider.wsconnected && !bob.provider.wsconnected,
      opts.timeout,
    );

    elementsOf(alice).set(keyA, stroke('el-alice', 0));
    elementsOf(bob).set(keyB, stroke('el-bob', 100));
    info('each drew one element while the other could not see it');

    alice.provider.connect();
    bob.provider.connect();

    const hasBoth = (cl) =>
      elementsOf(cl).has(keyA) && elementsOf(cl).has(keyB);

    await waitFor(
      'both drawings to reach both clients',
      () => hasBoth(alice) && hasBoth(bob),
      opts.timeout,
    ).catch(() => {
      const missing = [alice, bob]
        .map((cl) => {
          const lost = [keyA, keyB].filter((k) => !elementsOf(cl).has(k));
          return lost.length ? `client ${cl.i} is missing ${lost.join(', ')}` : null;
        })
        .filter(Boolean);
      throw new StageError(
        `Concurrent edits did not merge: ${missing.join('; ')}`,
        'One writer replaced the other. That is the whole-drawing-per-entry ' +
          'model coming back: elements must be one shared-map entry each.',
      );
    });

    // Merged is not enough — the surviving elements have to be the ones that
    // were drawn, not one of them twice under two keys.
    const drawn = (cl) => [keyA, keyB].map((k) => elementsOf(cl).get(k).element.id);
    for (const cl of [alice, bob]) {
      const ids = drawn(cl);
      if (ids.join() !== 'el-alice,el-bob') {
        throw new StageError(
          `Client ${cl.i} holds [${ids.join(', ')}], expected [el-alice, el-bob]`,
          'The keys merged but the elements behind them did not.',
        );
      }
    }
    ok('both drawings survived; per-element granularity holds');

    // -- Leave the document as we found it -----------------------------------
    stage = 'cleanup';
    clients[0].map.delete('marker');
    elementsOf(alice).delete(keyA);
    elementsOf(alice).delete(keyB);
    await sleep(500);

    console.log(
      `\n${c.green}${c.bold}PASS${c.reset} collaboration WebSocket is functional` +
        `\n     ${clients.length} clients, room ${projectId}, via ${wsUrl}\n`,
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
      `\n${c.red}${c.bold}FAIL${c.reset} [${err.stage || stage}] ${err.message}`,
    );
    if (err.hint) console.error(`     ${c.dim}${err.hint}${c.reset}`);
    if (!err.stage && err.stack) console.error(c.dim + err.stack + c.reset);
    console.error();
    process.exit(1);
  });
