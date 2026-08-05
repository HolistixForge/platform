import { TStartRequest, TBrokerConfig, ALLOWED_CAPABILITIES } from './types';

export class InvalidRequest extends Error {}

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0;

/**
 * Container and host names that reach an argv array.
 *
 * Nothing here is interpolated into a shell — `runContainer` spawns with an
 * argv array precisely so that it cannot be. This is the second lock: a name
 * beginning with `-` would be read by Docker as a flag rather than a value,
 * which is argument injection without a shell being involved at all.
 */
const SAFE_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;
const SAFE_HOSTNAME = /^[a-zA-Z0-9][a-zA-Z0-9.-]*$/;
const SAFE_IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_:.-]*$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Validate an incoming start request and clamp it to the broker's ceilings.
 *
 * Returns a new object rather than mutating: what the runtime layer receives
 * should be the validated value, never the caller's original.
 */
export const validateStartRequest = (
  body: unknown,
  config: TBrokerConfig
): TStartRequest => {
  if (typeof body !== 'object' || body === null) {
    throw new InvalidRequest('body must be an object');
  }
  const r = body as Record<string, unknown>;

  for (const field of [
    'organization_id',
    'project_id',
    'user_container_id',
    'image_id',
  ]) {
    if (!isNonEmptyString(r[field]) || !SAFE_ID.test(r[field] as string)) {
      throw new InvalidRequest(`${field} is missing or malformed`);
    }
  }

  if (!isNonEmptyString(r.name) || !SAFE_NAME.test(r.name)) {
    throw new InvalidRequest('name is missing or malformed');
  }

  if (!isNonEmptyString(r.settings) || !BASE64.test(r.settings)) {
    throw new InvalidRequest('settings must be a base64 string');
  }

  const capabilities = Array.isArray(r.capabilities) ? r.capabilities : [];
  for (const cap of capabilities) {
    if (typeof cap !== 'string' || !ALLOWED_CAPABILITIES.includes(cap)) {
      throw new InvalidRequest(`capability ${String(cap)} is not allowed`);
    }
  }

  // Host device passthrough is refused outright rather than filtered. Under a
  // microVM runtime the guest has its own kernel, so a request for one is
  // either meaningless or an attempt to reach the host — neither is worth
  // honouring, and both are worth hearing about.
  const devices = Array.isArray(r.devices) ? r.devices : [];
  if (devices.length > 0) {
    throw new InvalidRequest('host device passthrough is not permitted');
  }

  const extraHosts = Array.isArray(r.extra_hosts) ? r.extra_hosts : [];
  for (const entry of extraHosts) {
    const e = entry as Record<string, unknown>;
    if (!isNonEmptyString(e?.host) || !SAFE_HOSTNAME.test(e.host)) {
      throw new InvalidRequest('extra_hosts entry has a malformed host');
    }
    // `host-gateway` is Docker's own magic value for "the host". It is the only
    // thing that works from a user-defined network, where the default bridge's
    // 172.17.0.1 is not routable.
    if (
      !isNonEmptyString(e?.ip) ||
      (e.ip !== 'host-gateway' && !SAFE_IPV4.test(e.ip))
    ) {
      throw new InvalidRequest('extra_hosts entry has a malformed ip');
    }
  }

  const limits = (r.limits ?? {}) as Record<string, unknown>;
  const clamp = (value: unknown, ceiling: number, field: string): number => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      throw new InvalidRequest(`limits.${field} must be a positive number`);
    }
    return Math.min(value, ceiling);
  };

  return {
    organization_id: r.organization_id as string,
    project_id: r.project_id as string,
    user_container_id: r.user_container_id as string,
    name: r.name,
    image_id: r.image_id as string,
    settings: r.settings,
    capabilities: capabilities as string[],
    devices: [],
    extra_hosts: extraHosts as { host: string; ip: string }[],
    limits: {
      cpus: clamp(limits.cpus, config.maxLimits.cpus, 'cpus'),
      memoryMb: clamp(limits.memoryMb, config.maxLimits.memoryMb, 'memoryMb'),
      pidsLimit: clamp(
        limits.pidsLimit,
        config.maxLimits.pidsLimit,
        'pidsLimit'
      ),
    },
  };
};
