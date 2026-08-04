import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';

/**
 * The one-shot server the authorization code comes back to.
 *
 * RFC 8252 §7.3: the redirect is `http://127.0.0.1:<port>/callback`, on a port
 * the OS hands out rather than one registered in advance — a fixed port is one
 * already-bound socket away from an enrolment that cannot start, on a machine
 * where anything else may hold it. Ganymede's validateRedirectUri ignores the
 * port for loopback hosts and nothing else, which is what makes that legal.
 *
 * 127.0.0.1 and not localhost: what localhost resolves to is the host's
 * business, and the code must not leave this machine.
 */

export type TLoopbackResult = {
  code: string;
  state: string;
};

export type TLoopbackListener = {
  /** The exact string to send as `redirect_uri`, port included. */
  redirectUri: string;
  /** Resolves with the callback query, or rejects on refusal or timeout. */
  waitForCode: Promise<TLoopbackResult>;
  /** Idempotent; also called for you once the promise settles. */
  close: () => void;
};

const CALLBACK_PATH = '/callback';

const page = (title: string, message: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head>` +
  `<body style="font-family:system-ui;padding:3rem;text-align:center">` +
  `<h1>${title}</h1><p>${message}</p></body></html>`;

/**
 * @param expectedState the `state` sent to the authorize endpoint
 * @param timeoutMs how long to wait for the browser before giving up
 */
export const listenForCallback = async (
  expectedState: string,
  timeoutMs = 5 * 60 * 1000
): Promise<TLoopbackListener> => {
  let settle: (r: TLoopbackResult) => void = () => undefined;
  let fail: (e: Error) => void = () => undefined;

  const waitForCode = new Promise<TLoopbackResult>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    // The Host header is attacker-influenced; only the path and query matter,
    // and the base here exists solely to make the URL parse.
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');

    if (url.pathname !== CALLBACK_PATH) {
      res.writeHead(404).end();
      return;
    }

    const error = url.searchParams.get('error');
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    // Compared before the code is touched: a callback carrying somebody else's
    // state is a request this process did not start, and exchanging its code
    // would be the login-CSRF the parameter exists to prevent.
    if (state !== expectedState) {
      res.writeHead(400, { 'content-type': 'text/html' });
      res.end(page('Not this request', 'This callback does not belong here.'));
      fail(new Error('Callback state does not match the request'));
      return;
    }

    if (error || !code) {
      res.writeHead(400, { 'content-type': 'text/html' });
      res.end(page('Enrolment refused', error ?? 'No authorization code.'));
      fail(new Error(error ?? 'No authorization code in the callback'));
      return;
    }

    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(page('Runner enrolled', 'You can close this tab.'));
    settle({ code, state });
  });

  const timer = setTimeout(
    () => fail(new Error('Timed out waiting for the browser')),
    timeoutMs
  );
  // A pending enrolment must not be what keeps the process alive.
  timer.unref?.();

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    server.close();
  };

  // Settled either way, the socket goes.
  waitForCode.then(close, close);

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    // Port 0: the OS chooses. Bound to the loopback address explicitly, so the
    // callback cannot be delivered from another machine.
    server.listen(0, '127.0.0.1', resolve);
  });

  const { port } = server.address() as AddressInfo;

  return {
    redirectUri: `http://127.0.0.1:${port}${CALLBACK_PATH}`,
    waitForCode,
    close,
  };
};
