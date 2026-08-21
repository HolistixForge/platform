/**
 * @jest-environment node
 *
 * This runs in the gateway, on Node, and uses `node:http` and the global
 * `Response`. The package's default jsdom environment has neither.
 */
import http from 'node:http';
import { hostRoutedFetch } from './host-routed-fetch';

describe('hostRoutedFetch', () => {
  let server: http.Server;
  let port: number;
  let seen: {
    host?: string;
    url?: string;
    method?: string;
    body?: string;
    auth?: string;
  };

  beforeEach(async () => {
    seen = {};
    server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(Buffer.from(c)));
      req.on('end', () => {
        seen = {
          host: req.headers.host,
          auth: req.headers.authorization,
          url: req.url,
          method: req.method,
          body: Buffer.concat(chunks).toString(),
        };
        if (req.url?.includes('empty')) {
          res.writeHead(204);
          res.end();
          return;
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    port = (server.address() as { port: number }).port;
  });

  afterEach(async () => {
    await new Promise<void>((r) => server.close(() => r()));
  });

  it('sends the name from the URL while connecting to the address', async () => {
    // The whole point: the guard routes by name, the VPN offers an address.
    // undici discards a Host given in `headers`, so this cannot be done with
    // the platform's ordinary fetch.
    const f = hostRoutedFetch('127.0.0.1', port);

    const res = await f(
      'http://jupyterlab.uc-x.org-y.apollo.test:8443/api/terminals'
    );

    expect(res.status).toBe(200);
    expect(seen.host).toBe('jupyterlab.uc-x.org-y.apollo.test:8443');
    expect(seen.url).toBe('/api/terminals');
  });

  it('refuses to let a caller override the name', async () => {
    // The URL says which service is meant. A second Host in the headers would
    // be a silent override of that.
    const f = hostRoutedFetch('127.0.0.1', port);

    await f('http://jupyterlab.uc-x.org-y.apollo.test:8443/api/terminals', {
      headers: { Host: 'somewhere.else.test' },
    });

    expect(seen.host).toBe('jupyterlab.uc-x.org-y.apollo.test:8443');
  });

  it('carries the method, the query and the body', async () => {
    const f = hostRoutedFetch('127.0.0.1', port);

    await f('http://svc.uc-x.apollo.test:8443/api/terminals?a=1', {
      method: 'POST',
      body: '{"name":"t1"}',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(seen.method).toBe('POST');
    expect(seen.url).toBe('/api/terminals?a=1');
    expect(seen.body).toBe('{"name":"t1"}');
  });

  it('does not build a body onto a 204', async () => {
    // `Response` throws on a body with 204, and Jupyter answers 204 on delete —
    // which would surface inside the client as a network failure.
    const f = hostRoutedFetch('127.0.0.1', port);

    const res = await f('http://svc.uc-x.apollo.test:8443/api/empty');

    expect(res.status).toBe(204);
  });

  it('rejects rather than hanging when the address refuses', async () => {
    const f = hostRoutedFetch('127.0.0.1', 1);
    await expect(
      f('http://svc.uc-x.apollo.test:8443/api/terminals')
    ).rejects.toBeDefined();
  });

  it('reads what the caller set on a Request, not only on init', async () => {
    // `ServerConnection` calls `fetch(request)` with no second argument, so the
    // Authorization header lives on the Request. Reading `init` alone sent an
    // anonymous call, the guard answered 302 to the sign-in flow, and the
    // client reported "Invalid response: 302 Found".
    const f = hostRoutedFetch('127.0.0.1', port);

    await f(
      new Request('http://svc.uc-x.apollo.test:8443/api/terminals', {
        method: 'POST',
        headers: { Authorization: 'token abc.def.ghi' },
        body: '{"name":"t1"}',
      })
    );

    expect(seen.host).toBe('svc.uc-x.apollo.test:8443');
    expect(seen.auth).toBe('token abc.def.ghi');
    expect(seen.method).toBe('POST');
    expect(seen.body).toBe('{"name":"t1"}');
  });
});
