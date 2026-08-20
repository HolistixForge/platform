import {
  TContainerStackDefinition,
  TContainerStackService,
  TStackExposedPort,
  TStackSync,
} from './container-stack';

/**
 * The manifest a project keeps beside its code, turned into a catalogue entry.
 *
 * The source of truth for a stack is a file in the repository the stack is
 * built from — not something registered through an API — so that what runs and
 * what is reachable move with the code that changed them, and land in the same
 * review.
 *
 * Two things it says, and they are deliberately separate:
 *
 *   - `ports` — where a service listens. What the runner binds.
 *   - `tunnel` — which of those get a name on the project's domain.
 *
 * Keeping them apart is the whole point. A service can open a port for the rest
 * of the stack and never be reachable from outside it, which is the normal case
 * for everything that is not the interface. One list would have made "runs" and
 * "is public" the same word.
 *
 * ```yaml
 * version: 1
 * stack: acme-platform
 * name: Acme Platform
 * services:
 *   api:
 *     image: acme:api
 *     ports: [8080, 9090]
 *     tunnel:
 *       - port: 8080
 *         name: main
 *       - port: 9090
 *         name: metrics
 *   db:
 *     image: acme:db
 *     ports: [5432]
 * ```
 *
 * This takes the parsed document, not the file and not the YAML. Module
 * packages are bundled with a browser `process` shim and have no filesystem;
 * reading and parsing belong to the runner, which is a Node application. It
 * also means the format can be fed from anywhere — a test, an editor, a future
 * API — without a parser in the middle deciding what a manifest is.
 */

/** The only version this understands. */
export const STACK_MANIFEST_VERSION = 1;

/** The name looked for in a repository, when nothing else is said. */
export const STACK_MANIFEST_FILENAME = 'holistix.stack.yaml';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isPort = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 65535;

const readTunnel = (
  raw: unknown,
  ports: number[],
  serviceName: string
): TStackExposedPort[] => {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    throw new Error(`service ${serviceName}: tunnel must be a list`);
  }

  return raw.map((entry) => {
    if (!isRecord(entry)) {
      throw new Error(
        `service ${serviceName}: each tunnel entry must be a mapping with a port`
      );
    }
    if (!isPort(entry.port)) {
      throw new Error(
        `service ${serviceName}: tunnel port ${String(
          entry.port
        )} is not a port number`
      );
    }
    // A door onto a port the service never opens is the mistake this format
    // exists to make visible: it would register a name, write an nginx block
    // and answer connection refused, which reads as the tunnel being broken.
    if (!ports.includes(entry.port)) {
      throw new Error(
        `service ${serviceName}: tunnel port ${
          entry.port
        } is not in ports [${ports.join(', ')}]`
      );
    }
    if (entry.name !== undefined && typeof entry.name !== 'string') {
      throw new Error(`service ${serviceName}: tunnel name must be a string`);
    }
    if (entry.secure !== undefined && typeof entry.secure !== 'boolean') {
      throw new Error(
        `service ${serviceName}: tunnel secure must be true or false`
      );
    }

    return {
      // Defaulting to the service's own name keeps the FQDN predictable and
      // local to the service that declared it. `main` is not the default: it
      // is the base name of the whole stack, and picking it by accident is how
      // the interface ends up being whichever service registered first.
      name: (entry.name as string | undefined) ?? serviceName,
      port: entry.port,
      ...(entry.secure === undefined ? {} : { secure: entry.secure }),
    };
  });
};

/**
 * A repository-relative path that cannot leave the repository.
 *
 * Split on both separators, so a Windows-authored manifest is checked by the
 * same rule. `.` segments are harmless and dropped; anything absolute, any
 * `..`, and any drive letter is refused rather than normalised — a manifest
 * that meant to escape should fail, not be quietly clamped to something it did
 * not ask for.
 */
const readSyncFrom = (raw: string, serviceName: string): string => {
  const bad = (why: string) => {
    throw new Error(`service ${serviceName}: sync from ${raw} ${why}`);
  };

  if (!raw) bad('is empty');
  if (raw.startsWith('/') || raw.startsWith('\\') || /^[a-zA-Z]:/.test(raw)) {
    bad('must be relative to the manifest');
  }

  const segments = raw.split(/[/\\]+/).filter((s) => s && s !== '.');
  if (segments.some((s) => s === '..')) {
    bad('must stay inside the repository');
  }
  if (!segments.length) bad('names nothing');

  return segments.join('/');
};

const readSync = (raw: unknown, serviceName: string): TStackSync[] => {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    throw new Error(`service ${serviceName}: sync must be a list`);
  }

  return raw.map((entry) => {
    if (!isRecord(entry)) {
      throw new Error(
        `service ${serviceName}: each sync entry must be a mapping with from and to`
      );
    }
    if (typeof entry.from !== 'string') {
      throw new Error(`service ${serviceName}: sync from is required`);
    }
    if (typeof entry.to !== 'string' || !entry.to.startsWith('/')) {
      throw new Error(
        `service ${serviceName}: sync to must be an absolute path in the container`
      );
    }
    return { from: readSyncFrom(entry.from, serviceName), to: entry.to };
  });
};

const readService = (
  serviceName: string,
  raw: unknown
): TContainerStackService => {
  if (!isRecord(raw)) {
    throw new Error(`service ${serviceName} must be a mapping`);
  }
  if (typeof raw.image !== 'string' || !raw.image) {
    throw new Error(`service ${serviceName}: image is required`);
  }

  let ports: number[] = [];
  if (raw.ports !== undefined) {
    if (!Array.isArray(raw.ports)) {
      throw new Error(`service ${serviceName}: ports must be a list`);
    }
    ports = raw.ports.map((p) => {
      if (!isPort(p)) {
        throw new Error(
          `service ${serviceName}: port ${String(p)} is not a port number`
        );
      }
      return p;
    });
  }

  const exposes = readTunnel(raw.tunnel, ports, serviceName);
  const sync = readSync(raw.sync, serviceName);

  return {
    serviceName,
    imageId: raw.image,
    ...(exposes.length ? { exposes } : {}),
    ...(sync.length ? { sync } : {}),
  };
};

/**
 * Read a parsed manifest into a stack definition.
 *
 * What it checks is what only the manifest knows: the version, the shape, and
 * that every tunnelled port is one the service actually opens. Everything that
 * depends on the catalogue — that the images resolve for this project, that no
 * two doors describe one FQDN, that a name survives becoming a DNS label — is
 * `ContainerStackRegistry`'s, and is not repeated here. Two copies of a rule is
 * one rule and one bug waiting for them to disagree.
 */
export const parseStackManifest = (doc: unknown): TContainerStackDefinition => {
  if (!isRecord(doc)) {
    throw new Error('Stack manifest must be a mapping');
  }

  // Refused rather than assumed. A manifest from a later version may mean
  // something different by a field this one thinks it understands, and running
  // it half-read is worse than not running it.
  if (doc.version !== STACK_MANIFEST_VERSION) {
    throw new Error(
      `Stack manifest version must be ${STACK_MANIFEST_VERSION}, got ${String(
        doc.version
      )}`
    );
  }

  if (typeof doc.stack !== 'string' || !doc.stack) {
    throw new Error('Stack manifest must name a stack');
  }

  if (!isRecord(doc.services)) {
    throw new Error(`Stack ${doc.stack}: services must be a mapping`);
  }

  const names = Object.keys(doc.services);
  if (!names.length) {
    throw new Error(`Stack ${doc.stack} has no services`);
  }

  const services = names.map((name) => {
    try {
      return readService(name, (doc.services as Record<string, unknown>)[name]);
    } catch (e) {
      throw new Error(`Stack ${doc.stack}: ${(e as Error).message}`);
    }
  });

  return {
    stackId: doc.stack,
    stackName: typeof doc.name === 'string' && doc.name ? doc.name : doc.stack,
    ...(typeof doc.description === 'string'
      ? { description: doc.description }
      : {}),
    ...(typeof doc.category === 'string' ? { category: doc.category } : {}),
    ...(typeof doc.icon === 'string' ? { icon: doc.icon } : {}),
    services,
  };
};
