/**
 * Address plan for an organization's private networks.
 *
 * Each organization has a /16 on its gateway's VPN — `server 172.16.0.0
 * 255.255.0.0` in the OpenVPN config. That space has to be shared between two
 * things that must never overlap:
 *
 *   172.16.0.0/20    the VPN client pool. OpenVPN hands out a /30 per client
 *                    from the bottom of the space upward, so it grows into
 *                    whatever is above it. 4096 addresses is 1024 clients.
 *   172.16.16.0/20   service networks, one /24 each — 240 of them.
 *
 * The split is the whole reason this file exists. Carving service networks out
 * of the same range OpenVPN allocates from works until an organization has
 * enough containers to reach them, and then breaks in a way that looks like
 * random connectivity loss.
 */

/** First octet pair of every organization's VPN space. */
export const VPN_PREFIX = '172.16';

/** Third octet where service networks begin, above the client pool. */
export const FIRST_NETWORK_OCTET = 16;

/** Third octet after the last usable service network. */
export const LAST_NETWORK_OCTET = 256;

export class NetworkAllocationError extends Error {}

/**
 * A network name, which is also its DNS label.
 *
 * A network is addressed by `<name>.org-<uuid>.<domain>`, so the name has to
 * survive being a subdomain: lowercase, no underscores, no leading or trailing
 * hyphen. Rejecting here rather than at first use means a bad name never
 * reaches a certificate or a routing table.
 */
const NAME = /^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$/;

export const assertNetworkName = (name: string): string => {
  if (!NAME.test(name)) {
    throw new NetworkAllocationError(
      `network name "${name}" is not a valid DNS label`
    );
  }
  return name;
};

/**
 * The next free /24, given what an organization already holds.
 *
 * Deterministic and gap-filling: a network that is deleted frees its range for
 * the next one, rather than the space marching upward until it runs out. The
 * caller is responsible for doing this under a constraint that makes the write
 * atomic — two concurrent allocations that both read the same set would
 * otherwise both pick the same range.
 */
export const nextNetworkCidr = (taken: readonly string[]): string => {
  const used = new Set(taken.map((cidr) => cidr.trim()));

  for (let octet = FIRST_NETWORK_OCTET; octet < LAST_NETWORK_OCTET; octet++) {
    const candidate = `${VPN_PREFIX}.${octet}.0/24`;
    if (!used.has(candidate)) return candidate;
  }

  throw new NetworkAllocationError(
    `no free network range left: all ${
      LAST_NETWORK_OCTET - FIRST_NETWORK_OCTET
    } are allocated`
  );
};

/**
 * The addresses inside an allocated range that a container may take.
 *
 * `.1` is the segment's router — on a runner that is its local bridge, on the
 * platform it is the gateway. `.0` and `.255` are the network and broadcast
 * addresses. What is left is what can be handed out.
 */
export const usableHostRange = (
  cidr: string
): { first: string; last: string } => {
  const match = /^(\d+\.\d+\.\d+)\.0\/24$/.exec(cidr);
  if (!match) {
    throw new NetworkAllocationError(`not an allocated /24: ${cidr}`);
  }
  return { first: `${match[1]}.2`, last: `${match[1]}.254` };
};
