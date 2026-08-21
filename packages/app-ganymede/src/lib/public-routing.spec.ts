/**
 * Ganymede's half of the tunnel arrangement: given a request, which set of
 * addresses does the caller get back.
 *
 * The property worth holding onto is that the local answers are unchanged. A
 * request on the configured domain must produce exactly the URLs it always
 * did, whether or not the flag is on — the flag widens what is *accepted*, it
 * does not move anything that already worked.
 */

import type { Request } from 'express';

// jest.setup.ts already provides everything config.ts demands; these three are
// the ones this suite is about, and they have to be in place *before* config.ts
// is evaluated — it reads the environment at import time and derives the URLs
// once. Hence the require below rather than an import, which would be hoisted
// above these lines and pick up the setup file's `localhost:3000`.
process.env.FRONTEND_FQDN = 'apollo.test:8443';
process.env.GANYMEDE_FQDN = 'ganymede.apollo.test:8443';
process.env.DOMAIN = 'apollo.test:8443';

const {
  frontendUrlFor,
  ganymedeUrlFor,
  gatewayHostnameFor,
  isTunnelRequest,
  tunnelRedirectUris,
  withTunnelOrigin,
} = require('./public-routing');

const ORG = '522b0170-82e4-4358-9ff5-55adc9558811';

const on = (host: string): Request =>
  ({
    headers: { host, 'x-forwarded-proto': 'https' },
    protocol: 'https',
  } as unknown as Request);

describe('Ganymede public routing', () => {
  afterEach(() => {
    delete process.env.PUBLIC_TUNNEL;
  });

  describe('on the configured domain', () => {
    // Both with and without the flag, because turning it on must not change
    // anything about the arrangement it is not for.
    it.each(['0', '1'])(
      'answers with the subdomain layout (PUBLIC_TUNNEL=%s)',
      (flag) => {
        process.env.PUBLIC_TUNNEL = flag;
        const req = on('ganymede.apollo.test:8443');

        expect(isTunnelRequest(req)).toBe(false);
        expect(gatewayHostnameFor(ORG, req)).toBe(
          `org-${ORG}.apollo.test:8443`
        );
        expect(frontendUrlFor(req)).toBe('https://apollo.test:8443');
        expect(ganymedeUrlFor(req)).toBe('https://ganymede.apollo.test:8443');
      }
    );
  });

  describe('on a hostname it was never configured with', () => {
    it('is not a tunnel request while the flag is off', () => {
      const req = on('foo.trycloudflare.com');

      expect(isTunnelRequest(req)).toBe(false);
      // …and so the answers stay local, which is the pre-existing behaviour.
      expect(gatewayHostnameFor(ORG, req)).toBe(`org-${ORG}.apollo.test:8443`);
    });

    it('routes everything by path once the flag is on', () => {
      process.env.PUBLIC_TUNNEL = '1';
      const req = on('foo.trycloudflare.com');

      expect(isTunnelRequest(req)).toBe(true);
      expect(gatewayHostnameFor(ORG, req)).toBe(
        `foo.trycloudflare.com/-/gw/org-${ORG}`
      );
      expect(frontendUrlFor(req)).toBe('https://foo.trycloudflare.com');
      expect(ganymedeUrlFor(req)).toBe(
        'https://foo.trycloudflare.com/-/ganymede'
      );
    });

    // What the frontend builds is `https://${gateway_hostname}` and
    // `wss://${gateway_hostname}/project/<id>`. Both have to come out right,
    // which is the reason this value carries a path at all.
    it('produces a gateway value both consumers can build a URL from', () => {
      process.env.PUBLIC_TUNNEL = '1';
      const value = gatewayHostnameFor(ORG, on('foo.trycloudflare.com'));

      expect(`https://${value}`).toBe(
        `https://foo.trycloudflare.com/-/gw/org-${ORG}`
      );
      expect(`wss://${value}/project/p1`).toBe(
        `wss://foo.trycloudflare.com/-/gw/org-${ORG}/project/p1`
      );
    });

    it('follows X-Forwarded-Host when a tunnel rewrote Host', () => {
      process.env.PUBLIC_TUNNEL = '1';
      const req = {
        headers: {
          host: 'localhost:8443',
          'x-forwarded-host': 'box.taila29aef.ts.net',
          'x-forwarded-proto': 'https',
        },
        protocol: 'https',
      } as unknown as Request;

      expect(gatewayHostnameFor(ORG, req)).toBe(
        `box.taila29aef.ts.net/-/gw/org-${ORG}`
      );
    });
  });

  describe('the OAuth redirect target', () => {
    const run = (req: Request, fn: () => void) =>
      withTunnelOrigin(req, {} as never, fn as never);

    it('is empty outside a request', () => {
      expect(tunnelRedirectUris()).toEqual([]);
    });

    it('is empty for a request on the configured domain', () => {
      process.env.PUBLIC_TUNNEL = '1';
      run(on('apollo.test:8443'), () => {
        expect(tunnelRedirectUris()).toEqual([]);
      });
    });

    it('is the request origin for a tunnel request', () => {
      process.env.PUBLIC_TUNNEL = '1';
      run(on('foo.trycloudflare.com'), () => {
        expect(tunnelRedirectUris()).toEqual(['https://foo.trycloudflare.com']);
      });
    });

    // The value is scoped to one request's async tree, which is the whole
    // reason for an async context rather than a module-level variable: two
    // browsers on two hostnames are served concurrently.
    it('does not leak out of the request it belongs to', () => {
      process.env.PUBLIC_TUNNEL = '1';
      run(on('foo.trycloudflare.com'), () => {
        expect(tunnelRedirectUris()).toHaveLength(1);
      });
      expect(tunnelRedirectUris()).toEqual([]);
    });
  });
});
