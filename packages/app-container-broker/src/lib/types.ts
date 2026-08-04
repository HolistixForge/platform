/**
 * The broker's wire contract with the gateway.
 *
 * Mirrors `TBrokerStartRequest` in the user-containers module. Kept as its own
 * declaration rather than imported: the broker runs on the platform host, out
 * of reach of a compromised gateway, and a shared type would invite the two to
 * drift into trusting each other.
 */
export type TStartRequest = {
  organization_id: string;
  project_id: string;
  user_container_id: string;
  name: string;
  image_id: string;
  settings: string;
  capabilities: string[];
  devices: string[];
  extra_hosts: { host: string; ip: string }[];
  limits: {
    cpus: number;
    memoryMb: number;
    pidsLimit: number;
  };
};

export type TStartResponse = {
  container_id: string;
  host: string;
  runtime: string;
};

/**
 * A catalogue entry, as the broker resolves it.
 *
 * The gateway never sends this — it sends an `image_id`, and the broker looks
 * the reference up itself. That is the difference between a gateway that can
 * pick from a list and a gateway that can run anything on the host.
 */
export type TResolvedImage = {
  imageId: string;
  /** Fully qualified, digest-pinned: `repo:tag@sha256:…`. */
  reference: string;
};

export type TBrokerConfig = {
  /** Container runtime to hand every start to, e.g. `kata`. */
  runtime: string;
  /** Hostname reported back to the gateway. */
  hostname: string;
  /** Shared secret the gateway authenticates with. */
  token: string;
  port: number;
  /** Ceilings a request may not exceed, whatever it asks for. */
  maxLimits: {
    cpus: number;
    memoryMb: number;
    pidsLimit: number;
  };
};

/**
 * Capabilities a container may be granted.
 *
 * NET_ADMIN alone: the container runs an OpenVPN client to reach its gateway.
 * Under a microVM runtime that capability applies to the guest kernel, not the
 * host's, which is most of the reason for running one.
 */
export const ALLOWED_CAPABILITIES = ['NET_ADMIN'];
