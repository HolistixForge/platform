/**
 * Request validation tests.
 *
 * The gateway is tenant-facing, so what it is able to ask this broker for is a
 * security boundary. These tests pin the shape of that vocabulary — in
 * particular that nothing in a request can widen the container's privileges or
 * reach the host.
 */

import { validateStartRequest, InvalidRequest } from './validate';
import { TBrokerConfig } from './types';

const config: TBrokerConfig = {
  engine: 'docker',
  runtime: 'kata',
  acceptedConcessions: [],
  hostname: 'platform-host-1',
  token: 'broker-token',
  port: 9080,
  maxLimits: { cpus: 4, memoryMb: 8192, pidsLimit: 2048 },
};

const valid = (overrides: Record<string, unknown> = {}) => ({
  organization_id: 'org-abc',
  project_id: 'project-1',
  user_container_id: 'uc_abc12345',
  name: 'holistix_My_Terminal_uc_abc12',
  image_id: 'ubuntu:terminal',
  settings: Buffer.from('{"user_id":"u1"}').toString('base64'),
  capabilities: ['NET_ADMIN'],
  devices: [],
  extra_hosts: [{ host: 'ganymede.domain.local', ip: '172.17.0.1' }],
  limits: { cpus: 2, memoryMb: 2048, pidsLimit: 512 },
  ...overrides,
});

describe('validateStartRequest', () => {
  it('accepts a well-formed request', () => {
    const result = validateStartRequest(valid(), config);

    expect(result.image_id).toBe('ubuntu:terminal');
    expect(result.capabilities).toEqual(['NET_ADMIN']);
    expect(result.limits).toEqual({
      cpus: 2,
      memoryMb: 2048,
      pidsLimit: 512,
    });
  });

  describe('privilege', () => {
    it('refuses a capability outside the allowlist', () => {
      expect(() =>
        validateStartRequest(valid({ capabilities: ['SYS_ADMIN'] }), config)
      ).toThrow(InvalidRequest);
    });

    it('refuses host device passthrough outright', () => {
      // Not filtered but refused: under a microVM the guest has its own kernel,
      // so a request for a host device is either meaningless or an attempt to
      // reach past the isolation. Both are worth hearing about.
      expect(() =>
        validateStartRequest(valid({ devices: ['/dev/net/tun'] }), config)
      ).toThrow('host device passthrough is not permitted');
    });

    it('drops devices from the returned request', () => {
      expect(validateStartRequest(valid(), config).devices).toEqual([]);
    });
  });

  describe('argument injection', () => {
    it.each([
      ['--privileged', 'a name that would parse as a flag'],
      ['-v/:/host', 'a name that would parse as a short flag'],
      ['name with spaces', 'a name with separators'],
      ['name;rm -rf /', 'a name carrying shell metacharacters'],
    ])('refuses %s (%s)', (name) => {
      expect(() => validateStartRequest(valid({ name }), config)).toThrow(
        InvalidRequest
      );
    });

    it('refuses an image id that would parse as a flag', () => {
      expect(() =>
        validateStartRequest(valid({ image_id: '--runtime=runc' }), config)
      ).toThrow(InvalidRequest);
    });

    it('refuses a malformed extra host', () => {
      expect(() =>
        validateStartRequest(
          valid({ extra_hosts: [{ host: '--add-host=x', ip: '1.2.3.4' }] }),
          config
        )
      ).toThrow(InvalidRequest);
    });

    it('refuses a non-IPv4 extra host address', () => {
      expect(() =>
        validateStartRequest(
          valid({
            extra_hosts: [{ host: 'ganymede.local', ip: 'not-an-ip' }],
          }),
          config
        )
      ).toThrow(InvalidRequest);
    });

    it('refuses settings that are not base64', () => {
      expect(() =>
        validateStartRequest(valid({ settings: 'not base64!' }), config)
      ).toThrow(InvalidRequest);
    });
  });

  describe('limits', () => {
    it('clamps a request that asks for more than the ceiling', () => {
      // A tenant asking for 64 cores gets the host's ceiling, not an error:
      // the request is not malicious, merely optimistic.
      const result = validateStartRequest(
        valid({ limits: { cpus: 64, memoryMb: 1_000_000, pidsLimit: 99_999 } }),
        config
      );

      expect(result.limits).toEqual({
        cpus: 4,
        memoryMb: 8192,
        pidsLimit: 2048,
      });
    });

    it.each([
      ['zero', 0],
      ['negative', -1],
      ['not a number', 'lots'],
    ])('refuses a %s cpu limit', (_label, cpus) => {
      expect(() =>
        validateStartRequest(
          valid({ limits: { cpus, memoryMb: 2048, pidsLimit: 512 } }),
          config
        )
      ).toThrow(InvalidRequest);
    });

    it('refuses a request with no limits at all', () => {
      // Uncapped was acceptable while containers ran on the user's own machine.
      // On shared infrastructure it is not, so absence is an error rather than
      // a default.
      expect(() => validateStartRequest(valid({ limits: {} }), config)).toThrow(
        InvalidRequest
      );
    });
  });

  it('refuses a body that is not an object', () => {
    expect(() => validateStartRequest('nope', config)).toThrow(InvalidRequest);
    expect(() => validateStartRequest(null, config)).toThrow(InvalidRequest);
  });
});
