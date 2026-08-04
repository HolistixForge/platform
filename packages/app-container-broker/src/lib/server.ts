import {
  createServer,
  IncomingMessage,
  ServerResponse,
  Server,
} from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { log, EPriority } from '@holistix-forge/log';
import { TBrokerConfig, TStartResponse } from './types';
import { validateStartRequest, InvalidRequest } from './validate';
import { TCatalogueSource, resolveImage, UnknownImage } from './catalogue';
import { TRuntimeExec, startContainer, removeContainer } from './runtime';

const MAX_BODY_BYTES = 64 * 1024;

/**
 * Compare bearer tokens without leaking their contents through timing.
 *
 * Length is compared first and separately — `timingSafeEqual` throws on a
 * length mismatch, so there is no way to fold it in.
 */
const tokenMatches = (presented: string, expected: string): boolean => {
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
};

const authorized = (req: IncomingMessage, config: TBrokerConfig): boolean => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return false;
  return tokenMatches(header.slice('Bearer '.length), config.token);
};

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new InvalidRequest('body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });

const json = (res: ServerResponse, status: number, body: unknown): void => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
};

export type TBrokerDeps = {
  config: TBrokerConfig;
  catalogue: TCatalogueSource;
  exec: TRuntimeExec;
};

/**
 * The container broker.
 *
 * It exists so that the gateway — which faces tenants, holds their JWTs and
 * runs a reducer over their events — never needs Docker access. Mounting a
 * socket into it would be the shortest path and the worst one: root-equivalent
 * on the host. This service accepts a fixed vocabulary instead, and composes
 * the run itself.
 */
export const createBrokerServer = (deps: TBrokerDeps): Server => {
  const { config, exec } = deps;

  return createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      json(res, 200, { status: 'ok', runtime: config.runtime });
      return;
    }

    if (!authorized(req, config)) {
      // No detail: an unauthenticated caller learns whether the route exists
      // and nothing else.
      json(res, 401, { error: 'unauthorized' });
      return;
    }

    if (req.method === 'POST' && req.url === '/containers') {
      await handleStart(req, res, deps);
      return;
    }

    const remove = req.url?.match(/^\/containers\/([A-Za-z0-9_.-]+)$/);
    if (req.method === 'DELETE' && remove) {
      try {
        await removeContainer(exec, remove[1]);
        json(res, 200, { removed: remove[1] });
      } catch (e) {
        log(EPriority.Warning, 'BROKER', `Remove failed: ${String(e)}`);
        json(res, 500, { error: 'remove failed' });
      }
      return;
    }

    json(res, 404, { error: 'not found' });
  });
};

const handleStart = async (
  req: IncomingMessage,
  res: ServerResponse,
  { config, catalogue, exec }: TBrokerDeps
): Promise<void> => {
  let request;
  try {
    const raw = await readBody(req);
    request = validateStartRequest(JSON.parse(raw), config);
  } catch (e) {
    const message = e instanceof InvalidRequest ? e.message : 'malformed body';
    log(EPriority.Warning, 'BROKER', `Rejected start: ${message}`);
    json(res, 400, { error: message });
    return;
  }

  let image;
  try {
    image = await resolveImage(
      catalogue,
      request.organization_id,
      request.image_id
    );
  } catch (e) {
    if (e instanceof UnknownImage) {
      log(EPriority.Warning, 'BROKER', e.message);
      json(res, 404, { error: e.message });
      return;
    }
    log(EPriority.Error, 'BROKER', `Catalogue lookup failed: ${String(e)}`);
    json(res, 502, { error: 'catalogue unavailable' });
    return;
  }

  try {
    const containerId = await startContainer(exec, request, image, config);
    const body: TStartResponse = {
      container_id: containerId,
      host: config.hostname,
      runtime: config.runtime,
    };
    log(
      EPriority.Info,
      'BROKER',
      `Started ${request.user_container_id} for org ${request.organization_id}`,
      { container_id: containerId, image: image.imageId }
    );
    json(res, 201, body);
  } catch (e) {
    log(EPriority.Error, 'BROKER', `Start failed: ${String(e)}`);
    json(res, 500, { error: 'start failed' });
  }
};
