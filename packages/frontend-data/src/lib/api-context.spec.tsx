/**
 * Where the bundle looks for Ganymede.
 *
 * The rule has one job: a build served from the domain it was built for must
 * behave exactly as it did before, and the same build served from anywhere
 * else must stop using names only the platform host can resolve.
 */

import { resolveEndpoints } from './api-context';

const DOMAIN = 'apollo.test:8443';

describe('resolveEndpoints', () => {
  describe('served from the domain it was built for', () => {
    it('uses the subdomain layout, unchanged', () => {
      expect(
        resolveEndpoints(DOMAIN, {
          host: 'apollo.test:8443',
          origin: 'https://apollo.test:8443',
        })
      ).toEqual({
        frontendUrl: 'https://apollo.test:8443',
        ganymedeUrl: 'https://ganymede.apollo.test:8443',
        ganymedeFQDN: 'ganymede.apollo.test:8443',
      });
    });

    // The dev layout serves the frontend from frontend.<domain>; that is still
    // inside the domain, so nothing about it is a tunnel.
    it('treats a subdomain of it as local too', () => {
      const r = resolveEndpoints(DOMAIN, {
        host: 'frontend.apollo.test:8443',
        origin: 'https://frontend.apollo.test:8443',
      });
      expect(r.ganymedeUrl).toBe('https://ganymede.apollo.test:8443');
    });
  });

  describe('served from somewhere else — a tunnel', () => {
    const tunnel = {
      host: 'foo.trycloudflare.com',
      origin: 'https://foo.trycloudflare.com',
    };

    it('keeps everything on the host the page came from', () => {
      expect(resolveEndpoints(DOMAIN, tunnel)).toEqual({
        frontendUrl: 'https://foo.trycloudflare.com',
        ganymedeUrl: 'https://foo.trycloudflare.com/-/ganymede',
        ganymedeFQDN: 'foo.trycloudflare.com/-/ganymede',
      });
    });

    // The OAuth redirect_uri is this value, and Ganymede compares it to the
    // origin the request arrived on. A trailing slash would make them differ.
    it('produces a frontend URL with no trailing slash', () => {
      expect(resolveEndpoints(DOMAIN, tunnel).frontendUrl).toBe(
        'https://foo.trycloudflare.com'
      );
    });

    it('carries a non-default port through', () => {
      const r = resolveEndpoints(DOMAIN, {
        host: 'box.taila29aef.ts.net:8443',
        origin: 'https://box.taila29aef.ts.net:8443',
      });
      expect(r.ganymedeUrl).toBe(
        'https://box.taila29aef.ts.net:8443/-/ganymede'
      );
    });
  });

  describe('with no location passed', () => {
    // The argument exists for the tests; the application never passes it.
    it('reads the page it is running on', () => {
      const expected =
        typeof window === 'undefined'
          ? // No page at all — Storybook's node-side render, a unit test under
            // the node environment. The built-in domain is all there is.
            'https://ganymede.apollo.test:8443'
          : `${window.location.origin}/-/ganymede`;

      expect(resolveEndpoints(DOMAIN).ganymedeUrl).toBe(expected);
    });
  });
});
