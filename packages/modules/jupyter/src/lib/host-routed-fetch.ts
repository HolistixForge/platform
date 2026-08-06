import http from 'node:http';

/**
 * A `fetch` that keeps the name in the URL and connects somewhere else.
 *
 * The gateway drives a notebook over the VPN, where the container is an
 * address. The container's auth guard routes by *name* — a container publishes
 * several services and answers on `{service}.uc-X.org-Y.{domain}` — so a
 * request that arrives with `Host: 172.16.0.10:8443` matches nothing and comes
 * back "Service not found". Measured, creating a terminal from a service card.
 *
 * The obvious fix is to force the `Host` header. It does not work: undici, the
 * runtime behind `fetch` under Node, silently discards a `Host` given in
 * `headers` — verified on Node 25, both spellings, the server seeing
 * `127.0.0.1:PORT` either way. `node:http` takes the connection target and the
 * header as separate arguments, which is exactly the distinction needed here,
 * so that is what this uses.
 *
 * Backend only. In a browser the name resolves and none of this is necessary,
 * and `node:http` does not exist there.
 */
export const hostRoutedFetch =
  (address: string, port: number) =>
  async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
    // `ServerConnection` builds a `Request` and calls `fetch(request)` with no
    // second argument — `settings.fetch.call(null, request)`. Everything the
    // caller set is therefore on the Request, and reading `init` alone found no
    // Authorization header at all: the guard saw an anonymous call and answered
    // 302 to the sign-in flow, which surfaced as "Invalid response: 302 Found".
    //
    // Both shapes are accepted, because the plain `(url, init)` form is what
    // anyone reading this signature will reach for.
    const asRequest =
      typeof input === 'string' ? undefined : (input as Request);
    const url = new URL(asRequest ? asRequest.url : (input as string));

    // The name the guard routes on, port included: it is part of the Host
    // header a client would have sent, and the guard strips it before looking
    // the service up.
    const host = url.host;

    const headers: Record<string, string> = { Host: host };
    const merge = (h: HeadersInit | Headers | undefined) => {
      if (!h) return;
      new Headers(h).forEach((value, key) => {
        // Not the caller's Host — the URL is the authority on which service is
        // meant, and a second one here would be a silent override.
        if (key.toLowerCase() === 'host') return;
        headers[key] = value;
      });
    };
    merge(asRequest?.headers);
    merge(init?.headers);

    const body = asRequest
      ? (await asRequest.text()) || undefined
      : (init?.body as string | undefined);

    return new Promise<Response>((resolve, reject) => {
      const req = http.request(
        {
          hostname: address,
          port,
          path: `${url.pathname}${url.search}`,
          method: init?.method ?? asRequest?.method ?? 'GET',
          headers,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(Buffer.from(c)));
          res.on('end', () => {
            const payload = Buffer.concat(chunks);
            // `Response` rejects a body on 204/304, and Jupyter answers 204 on
            // a delete — constructing one anyway throws inside the client and
            // reads as a network failure.
            const empty = res.statusCode === 204 || res.statusCode === 304;
            resolve(
              new Response(empty ? null : payload, {
                status: res.statusCode ?? 502,
                statusText: res.statusMessage ?? '',
                headers: Object.entries(res.headers).flatMap(([k, v]) =>
                  v === undefined
                    ? []
                    : Array.isArray(v)
                    ? v.map((one) => [k, one] as [string, string])
                    : [[k, v] as [string, string]]
                ),
              })
            );
          });
        }
      );

      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  };
