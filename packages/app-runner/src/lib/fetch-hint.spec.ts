/**
 * What a failed request says.
 *
 * The runner talks to one platform and does nothing else, so a transport
 * failure is the failure — and the person reading it is on their own laptop
 * with no server log to check. `fetch failed` is two words that send them
 * nowhere.
 */

import { explainFetchFailure } from './fetch-hint';

const withCause = (code: string) =>
  Object.assign(new Error('fetch failed'), { cause: { code } });

describe('explainFetchFailure', () => {
  // The one that cost an afternoon: a mkcert certificate, whose authority node
  // does not carry, behind two words that name neither.
  it('names the local authority remedy on an untrusted certificate', () => {
    const message = explainFetchFailure(
      withCause('UNABLE_TO_VERIFY_LEAF_SIGNATURE'),
      'https://ganymede.apollo.test:8443'
    );

    expect(message).toContain('UNABLE_TO_VERIFY_LEAF_SIGNATURE');
    expect(message).toContain('NODE_EXTRA_CA_CERTS');
    expect(message).toContain('mkcert -CAROOT');
  });

  // The repository directory holds an untracked, exported copy — gitignored,
  // and on this machine four months older than the authority in use. Reaching
  // for it is the first thing anybody tries, and it is what did not work.
  it('steers away from a rootCA.pem lying in the repository', () => {
    expect(
      explainFetchFailure(withCause('SELF_SIGNED_CERT_IN_CHAIN'), 'https://x')
    ).toContain('not a rootCA.pem sitting in the repository');
  });

  it.each([
    'SELF_SIGNED_CERT_IN_CHAIN',
    'DEPTH_ZERO_SELF_SIGNED_CERT',
    'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  ])('treats %s as the same problem', (code) => {
    expect(explainFetchFailure(withCause(code), 'https://x')).toContain(
      'NODE_EXTRA_CA_CERTS'
    );
  });

  it('says when nothing is listening', () => {
    expect(
      explainFetchFailure(withCause('ECONNREFUSED'), 'https://x:8443')
    ).toContain('nothing is listening');
  });

  it('points a name that does not resolve at the resolver', () => {
    expect(
      explainFetchFailure(withCause('ENOTFOUND'), 'https://a.test')
    ).toContain('resolver');
  });

  // A message that explains the wrong thing sends somebody looking where the
  // fault is not, so an unrecognised code says only itself.
  it('reports an unknown code without inventing a remedy', () => {
    const message = explainFetchFailure(withCause('EHOSTUNREACH'), 'https://x');

    expect(message).toBe('EHOSTUNREACH.');
  });

  it('says nothing when there is no cause to read', () => {
    expect(explainFetchFailure(new Error('boom'), 'https://x')).toBeUndefined();
  });
});

//

/**
 * The wrapper is installed *as* the global, so a bare `fetch` inside it would
 * resolve to itself. It did: every command answered `Exception in
 * PromiseRejectCallback`, including the ones with nothing wrong. Unit tests
 * could not see it — they call `fetchWithHint` directly, with the global still
 * native — so this one reproduces the installation.
 */
describe('fetchWithHint installed as the global', () => {
  const native = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = native;
  });

  it('does not call itself', async () => {
    // Arrange - the module captures the global when it loads, so the mock has
    // to be in place *before* a fresh copy of it is imported. The module
    // registry is reset for exactly that: the copy at the top of this file
    // captured the real fetch long ago.
    const real = jest
      .fn()
      .mockResolvedValue(new Response('ok', { status: 200 }));
    globalThis.fetch = real as never;

    jest.resetModules();

    const { fetchWithHint: wrapper } = require('./fetch-hint');

    // The installation main.ts performs.
    globalThis.fetch = wrapper;

    // Act
    const response = await wrapper('https://x');

    // Assert - one hop to the real one, and no recursion
    expect(response.status).toBe(200);
    expect(real).toHaveBeenCalledTimes(1);
  });
});
