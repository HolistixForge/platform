import { hostname } from 'node:os';
import { log, EPriority } from '@holistix-forge/log';
import { createBrokerServer } from './lib/server';
import { ganymedeCatalogue } from './lib/catalogue';
import { withBuiltins } from './lib/builtin-catalogue';
import { engineExec } from './lib/runtime';
import { selectEngine } from './lib/engine';
import { dockerEngine } from './lib/engine-docker';
import { appleEngine } from './lib/engine-apple';
import { TBrokerConfig } from './lib/types';

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

const number = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return parsed;
};

const list = (name: string): string[] =>
  (process.env[name] || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const config: TBrokerConfig = {
  // No default, for the same reason `runtime` has none below. The two engines
  // do not grant the same things, so a broker that picked one by looking at
  // which binary happened to be installed would be deciding a security
  // question by accident.
  engine: required('BROKER_ENGINE'),
  // No default. A broker that silently fell back to runc would put every
  // tenant back on a shared kernel, which is the failure this service exists
  // to make impossible — so it must be stated, not assumed.
  runtime: required('BROKER_RUNTIME'),
  acceptedConcessions: list('BROKER_ACCEPT_CONCESSIONS'),
  hostname: process.env.BROKER_HOSTNAME || hostname(),
  token: required('BROKER_TOKEN'),
  port: number('BROKER_PORT', 9443),
  maxLimits: {
    cpus: number('BROKER_MAX_CPUS', 4),
    memoryMb: number('BROKER_MAX_MEMORY_MB', 8192),
    pidsLimit: number('BROKER_MAX_PIDS', 2048),
  },
};

// Throws unless every control this engine gives up has been written down.
const engine = selectEngine(config, {
  [dockerEngine.name]: dockerEngine,
  [appleEngine.name]: appleEngine,
});

const exec = engineExec(process.env.BROKER_RUNTIME_BINARY || engine.binary);

const server = createBrokerServer({
  config,
  // Built-in images resolve from this host's own list; anything else goes to
  // Ganymede, which owns the per-project catalog and mints the pull token.
  catalogue: withBuiltins(
    ganymedeCatalogue(
      required('GANYMEDE_INTERNAL_URL'),
      required('GANYMEDE_INTERNAL_TOKEN')
    )
  ),
  exec,
  engine,
});

// Loopback by default: the broker is reached from gateway containers over the
// Docker bridge, and binding 0.0.0.0 without meaning to would expose container
// creation to anything that can route to this host.
const host = process.env.BROKER_BIND || '127.0.0.1';

// Whatever the engine needs true of this host before it will serve — the
// process exits rather than starting in a state it has already said is unsafe.
engine
  .preflight(exec)
  .then(() => {
    server.listen(config.port, host, () => {
      const given = engine.concessions.map((c) => c.id).join(', ');
      log(
        EPriority.Info,
        'BROKER',
        `Container broker listening on ${host}:${config.port} ` +
          `(engine: ${engine.name}, runtime: ${config.runtime})` +
          (given ? ` — accepted concessions: ${given}` : '')
      );
    });
  })
  .catch((error: unknown) => {
    log(EPriority.Error, 'BROKER', `Refusing to start: ${String(error)}`);
    process.exitCode = 1;
  });
