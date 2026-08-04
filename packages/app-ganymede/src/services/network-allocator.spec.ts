/**
 * Address plan tests.
 *
 * The split between the VPN client pool and service networks is the point of
 * this module. Getting it wrong does not fail at deploy time — it fails once an
 * organization has enough containers for OpenVPN's pool to grow into a range
 * already handed to a network, and then presents as connectivity that works
 * until it doesn't.
 */

import {
  nextNetworkCidr,
  usableHostRange,
  assertNetworkName,
  NetworkAllocationError,
  FIRST_NETWORK_OCTET,
  LAST_NETWORK_OCTET,
} from './network-allocator';

describe('nextNetworkCidr', () => {
  it('starts above the VPN client pool', () => {
    // OpenVPN hands out a /30 per client from the bottom of the /16 upward, so
    // anything allocated below this would eventually be handed out twice.
    expect(nextNetworkCidr([])).toBe('172.16.16.0/24');
  });

  it('takes the next free range', () => {
    expect(nextNetworkCidr(['172.16.16.0/24'])).toBe('172.16.17.0/24');
    expect(nextNetworkCidr(['172.16.16.0/24', '172.16.17.0/24'])).toBe(
      '172.16.18.0/24'
    );
  });

  it('fills a gap left by a deleted network', () => {
    // Marching upward instead would exhaust the space long before 240 networks
    // actually existed at once.
    expect(nextNetworkCidr(['172.16.16.0/24', '172.16.18.0/24'])).toBe(
      '172.16.17.0/24'
    );
  });

  it('ignores surrounding whitespace on what it was given', () => {
    expect(nextNetworkCidr([' 172.16.16.0/24 '])).toBe('172.16.17.0/24');
  });

  it('fails rather than wrapping into the client pool when full', () => {
    const all = Array.from(
      { length: LAST_NETWORK_OCTET - FIRST_NETWORK_OCTET },
      (_, i) => `172.16.${FIRST_NETWORK_OCTET + i}.0/24`
    );

    expect(() => nextNetworkCidr(all)).toThrow(NetworkAllocationError);
  });

  it('offers 240 networks per organization', () => {
    expect(LAST_NETWORK_OCTET - FIRST_NETWORK_OCTET).toBe(240);
  });
});

describe('assertNetworkName', () => {
  it.each(['data', 'web', 'a', 'db-primary', 'net2'])('accepts %s', (name) => {
    expect(assertNetworkName(name)).toBe(name);
  });

  it.each([
    ['Data', 'uppercase does not survive a DNS label'],
    ['my_net', 'underscores are not valid in a hostname'],
    ['-net', 'a leading hyphen'],
    ['net-', 'a trailing hyphen'],
    ['', 'an empty name'],
    ['a'.repeat(33), 'longer than a label allows'],
  ])('refuses %s (%s)', (name) => {
    // A network is addressed by <name>.org-<uuid>.<domain>, so a bad name would
    // otherwise reach a certificate or a routing table before anyone noticed.
    expect(() => assertNetworkName(name)).toThrow(NetworkAllocationError);
  });
});

describe('usableHostRange', () => {
  it('reserves .1 for the segment router', () => {
    // On a runner that is its local bridge; on the platform, the gateway.
    expect(usableHostRange('172.16.16.0/24')).toEqual({
      first: '172.16.16.2',
      last: '172.16.16.254',
    });
  });

  it('refuses anything that is not an allocated /24', () => {
    expect(() => usableHostRange('172.16.16.0/16')).toThrow(
      NetworkAllocationError
    );
    expect(() => usableHostRange('172.16.16.5/24')).toThrow(
      NetworkAllocationError
    );
  });
});
