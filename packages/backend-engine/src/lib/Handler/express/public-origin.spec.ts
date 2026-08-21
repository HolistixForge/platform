/**
 * Same-origin trust, which is what lets the platform answer on a hostname it
 * was never configured with — see public-origin.ts.
 *
 * Two halves are worth pinning down separately: the helpers, where the port
 * and the forwarded headers are the parts that have been wrong before, and the
 * CSRF gate they feed, where the thing to prove is that with the flag off
 * nothing at all changes.
 */

import request from 'supertest';
import express from 'express';
import { setupBasicExpressApp } from './app-setup';
import {
  declaredOrigin,
  isPublicTunnelEnabled,
  isSameOriginRequest,
  requestOrigin,
} from './public-origin';

const fakeRequest = (headers: Record<string, string>, protocol = 'https') =>
  ({ headers, protocol } as unknown as express.Request);

describe('public-origin helpers', () => {
  afterEach(() => {
    delete process.env.PUBLIC_TUNNEL;
  });

  describe('isPublicTunnelEnabled', () => {
    it('is off when unset', () => {
      expect(isPublicTunnelEnabled()).toBe(false);
    });

    it('accepts 1 and true', () => {
      process.env.PUBLIC_TUNNEL = '1';
      expect(isPublicTunnelEnabled()).toBe(true);
      process.env.PUBLIC_TUNNEL = 'true';
      expect(isPublicTunnelEnabled()).toBe(true);
    });

    it('is off for any other value', () => {
      process.env.PUBLIC_TUNNEL = '0';
      expect(isPublicTunnelEnabled()).toBe(false);
    });
  });

  describe('requestOrigin', () => {
    it('builds the origin from Host and X-Forwarded-Proto', () => {
      expect(
        requestOrigin(
          fakeRequest({
            host: 'tunnel.example.com',
            'x-forwarded-proto': 'https',
          })
        )
      ).toBe('https://tunnel.example.com');
    });

    // The port is the whole reason this does not use req.hostname: Express
    // strips it, and nginx listens on 8443 on the macOS layout.
    it('keeps the port, because a browser origin carries it', () => {
      expect(requestOrigin(fakeRequest({ host: 'apollo.test:8443' }))).toBe(
        'https://apollo.test:8443'
      );
    });

    it('prefers X-Forwarded-Host, which is where a tunnel puts the public name', () => {
      expect(
        requestOrigin(
          fakeRequest({
            host: 'localhost:8443',
            'x-forwarded-host': 'foo.trycloudflare.com',
          })
        )
      ).toBe('https://foo.trycloudflare.com');
    });

    it('is null without a host to build from', () => {
      expect(requestOrigin(fakeRequest({}))).toBeNull();
    });
  });

  describe('declaredOrigin', () => {
    it('reads Origin when present', () => {
      expect(
        declaredOrigin(fakeRequest({ origin: 'https://a.example.com' }))
      ).toBe('https://a.example.com');
    });

    it('falls back to the origin part of Referer', () => {
      expect(
        declaredOrigin(
          fakeRequest({ referer: 'https://a.example.com/org/1/project/2' })
        )
      ).toBe('https://a.example.com');
    });

    // A sandboxed iframe or a redirected cross-origin POST sends the literal
    // string "null", which must not be treated as an origin.
    it('ignores the opaque origin', () => {
      expect(
        declaredOrigin(fakeRequest({ origin: 'null', referer: '' }))
      ).toBeNull();
    });

    it('ignores an unparseable Referer', () => {
      expect(declaredOrigin(fakeRequest({ referer: 'not a url' }))).toBeNull();
    });
  });

  describe('isSameOriginRequest', () => {
    it('is false while the flag is off, whatever the headers say', () => {
      expect(
        isSameOriginRequest(
          fakeRequest({
            host: 'tunnel.example.com',
            origin: 'https://tunnel.example.com',
          })
        )
      ).toBe(false);
    });

    it('is true for a request from the page it was sent to', () => {
      process.env.PUBLIC_TUNNEL = '1';
      expect(
        isSameOriginRequest(
          fakeRequest({
            host: 'tunnel.example.com',
            origin: 'https://tunnel.example.com',
          })
        )
      ).toBe(true);
    });

    it('is false for a cross-site origin — the attack this gate exists for', () => {
      process.env.PUBLIC_TUNNEL = '1';
      expect(
        isSameOriginRequest(
          fakeRequest({
            host: 'tunnel.example.com',
            origin: 'https://evil.example.com',
          })
        )
      ).toBe(false);
    });

    it('is false when the scheme differs', () => {
      process.env.PUBLIC_TUNNEL = '1';
      expect(
        isSameOriginRequest(
          fakeRequest({
            host: 'tunnel.example.com',
            origin: 'http://tunnel.example.com',
            'x-forwarded-proto': 'https',
          })
        )
      ).toBe(false);
    });

    it('is false when the port differs', () => {
      process.env.PUBLIC_TUNNEL = '1';
      expect(
        isSameOriginRequest(
          fakeRequest({
            host: 'apollo.test:8443',
            origin: 'https://apollo.test:9443',
          })
        )
      ).toBe(false);
    });
  });
});

//

describe('CSRF gate on an unconfigured hostname', () => {
  const buildApp = () => {
    const app = express();
    app.set('trust proxy', 1);
    setupBasicExpressApp(app);
    app.post('/test/post', (req, res) => res.json({ success: true }));
    return app;
  };

  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = JSON.stringify(['https://apollo.test:8443']);
  });

  afterEach(() => {
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.PUBLIC_TUNNEL;
  });

  it('rejects an unknown origin while the flag is off', async () => {
    const res = await request(buildApp())
      .post('/test/post')
      .set('Host', 'foo.trycloudflare.com')
      .set('X-Forwarded-Proto', 'https')
      .set('Origin', 'https://foo.trycloudflare.com');

    expect(res.status).toBe(403);
  });

  it('accepts the same unknown origin once the flag is on', async () => {
    process.env.PUBLIC_TUNNEL = '1';

    const res = await request(buildApp())
      .post('/test/post')
      .set('Host', 'foo.trycloudflare.com')
      .set('X-Forwarded-Proto', 'https')
      .set('Origin', 'https://foo.trycloudflare.com');

    expect(res.status).toBe(200);
  });

  it('still rejects a cross-site origin with the flag on', async () => {
    process.env.PUBLIC_TUNNEL = '1';

    const res = await request(buildApp())
      .post('/test/post')
      .set('Host', 'foo.trycloudflare.com')
      .set('X-Forwarded-Proto', 'https')
      .set('Origin', 'https://evil.example.com');

    expect(res.status).toBe(403);
  });

  it('echoes the tunnel origin back in the CORS header', async () => {
    process.env.PUBLIC_TUNNEL = '1';

    const res = await request(buildApp())
      .post('/test/post')
      .set('Host', 'foo.trycloudflare.com')
      .set('X-Forwarded-Proto', 'https')
      .set('Origin', 'https://foo.trycloudflare.com');

    expect(res.headers['access-control-allow-origin']).toBe(
      'https://foo.trycloudflare.com'
    );
  });
});
