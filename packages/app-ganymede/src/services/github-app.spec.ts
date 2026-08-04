/**
 * GitHub App token chain tests.
 *
 * Three hops, each narrower than the last: App key → App JWT → installation
 * token → GHCR pull token. Only the last leaves this process. These tests pin
 * that the narrowing actually happens, because a mistake in it hands the
 * platform host something more powerful than a single-repository pull.
 */

import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import {
  appJwt,
  installationToken,
  ghcrPullToken,
  ghcrRepository,
  resolveDigest,
  GithubAppError,
} from './github-app';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const config = { appId: '12345', privateKey };

type TStubbed = { status?: number; headers?: Headers; json?: unknown };

/** A fetch stub that records what it was called with. */
const stub = (handler: (url: string, init?: RequestInit) => TStubbed) => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const doFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const r = handler(String(url), init);
    const status = r.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: r.headers ?? new Headers(),
      json: async () => r.json ?? {},
      text: async () => '',
    } as Response;
  }) as unknown as typeof fetch;
  return { calls, doFetch };
};

describe('appJwt', () => {
  it('is signed with the App key and names the App', () => {
    // Signed at the current time, so `verify` exercises the real expiry path
    // rather than rejecting a token that was backdated by the test itself.
    const decoded = jwt.verify(appJwt(config), publicKey, {
      algorithms: ['RS256'],
    }) as jwt.JwtPayload;

    expect(decoded.iss).toBe('12345');
  });

  it('is rejected when signed by a different key', () => {
    const other = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });

    expect(() =>
      jwt.verify(
        appJwt({ appId: '12345', privateKey: other.privateKey }),
        publicKey,
        {
          algorithms: ['RS256'],
        }
      )
    ).toThrow();
  });

  it('backdates iat and stays inside the ten minutes GitHub allows', () => {
    // GitHub rejects anything longer, and is strict about clock skew.
    const now = 1_000_000;
    const decoded = jwt.decode(appJwt(config, now)) as jwt.JwtPayload;

    expect(decoded.iat).toBeLessThan(now);
    expect(decoded.exp! - decoded.iat!).toBeLessThanOrEqual(600);
  });
});

describe('installationToken', () => {
  it('narrows the App JWT to one installation', async () => {
    const { calls, doFetch } = stub(() => ({
      json: { token: 'ghs_installation', expires_at: '2026-08-04T10:00:00Z' },
    }));

    const result = await installationToken(config, 42, doFetch);

    expect(result.token).toBe('ghs_installation');
    expect(calls[0].url).toBe(
      'https://api.github.com/app/installations/42/access_tokens'
    );
    expect(calls[0].init?.method).toBe('POST');
  });

  it('reports a removed installation distinctly', async () => {
    // "The customer uninstalled the App" is a different problem from "GitHub is
    // down", and the caller answers each differently.
    const { doFetch } = stub(() => ({ status: 404 }));

    await expect(installationToken(config, 42, doFetch)).rejects.toThrow(
      'no longer exists'
    );
  });

  it('fails on any other error rather than returning nothing', async () => {
    const { doFetch } = stub(() => ({ status: 500 }));

    await expect(installationToken(config, 42, doFetch)).rejects.toThrow(
      GithubAppError
    );
  });
});

describe('ghcrRepository', () => {
  it('extracts owner/name from a GHCR reference', () => {
    expect(ghcrRepository('ghcr.io/acme/etl')).toBe('acme/etl');
    expect(ghcrRepository('ghcr.io/Acme/ETL')).toBe('acme/etl');
    expect(ghcrRepository('ghcr.io/acme/team/etl')).toBe('acme/team/etl');
  });

  it.each([['docker.io/acme/etl'], ['acme/etl'], ['ghcr.io/acme']])(
    'refuses %s rather than guessing',
    (uri) => {
      // This value becomes a registry scope. A wrong guess asks for access to
      // the wrong thing.
      expect(() => ghcrRepository(uri)).toThrow(GithubAppError);
    }
  );
});

describe('ghcrPullToken', () => {
  it('asks for pull on exactly one repository', async () => {
    // This is the only token that reaches the platform host, so its scope is
    // the ceiling on what a compromised host could do with it.
    const { calls, doFetch } = stub(() => ({ json: { token: 'ghcr_pull' } }));

    const token = await ghcrPullToken('ghs_installation', 'acme/etl', doFetch);

    expect(token).toBe('ghcr_pull');
    expect(calls[0].url).toContain(
      encodeURIComponent('repository:acme/etl:pull')
    );
    expect(calls[0].url).not.toContain('push');
  });

  it('sends the installation token as basic auth, not as a bearer', async () => {
    const { calls, doFetch } = stub(() => ({ json: { token: 'ghcr_pull' } }));

    await ghcrPullToken('ghs_installation', 'acme/etl', doFetch);

    const auth = (calls[0].init?.headers as Record<string, string>)
      .Authorization;
    expect(auth).toBe(
      `Basic ${Buffer.from('x-access-token:ghs_installation').toString(
        'base64'
      )}`
    );
  });

  it('fails when GHCR answers without a token', async () => {
    const { doFetch } = stub(() => ({ json: {} }));

    await expect(
      ghcrPullToken('ghs_installation', 'acme/etl', doFetch)
    ).rejects.toThrow('no pull token');
  });
});

describe('resolveDigest', () => {
  const withDigest = (digest: string) =>
    stub(() => ({
      headers: new Headers({ 'docker-content-digest': digest }),
    }));

  it('reads the digest a tag currently points at', async () => {
    // This is what lets a tenant supply a readable tag while we store an exact
    // artifact — one HEAD request, so demanding a digest buys only friction.
    const { calls, doFetch } = withDigest(`sha256:${'a'.repeat(64)}`);

    const digest = await resolveDigest('tok', 'acme/etl', '1.4.0', doFetch);

    expect(digest).toBe('a'.repeat(64));
    expect(calls[0].url).toBe('https://ghcr.io/v2/acme/etl/manifests/1.4.0');
    expect(calls[0].init?.method).toBe('HEAD');
  });

  it('accepts multi-architecture images', async () => {
    // A multi-arch image answers with an index. Omitting the index media types
    // gets a 404, or the digest of one architecture rather than of the image
    // the user actually named.
    const { calls, doFetch } = withDigest(`sha256:${'b'.repeat(64)}`);

    await resolveDigest('tok', 'acme/etl', 'latest', doFetch);

    const accept = (calls[0].init?.headers as Record<string, string>).Accept;
    expect(accept).toContain('image.index.v1+json');
    expect(accept).toContain('manifest.list.v2+json');
  });

  it('reports a missing tag distinctly', async () => {
    const { doFetch } = stub(() => ({ status: 404 }));

    await expect(
      resolveDigest('tok', 'acme/etl', 'nope', doFetch)
    ).rejects.toThrow('does not exist');
  });

  it('refuses a malformed digest rather than storing it', async () => {
    // A short or absent digest stored now becomes a pull that fails much
    // later, somewhere far less obvious.
    const { doFetch } = stub(() => ({
      headers: new Headers({ 'docker-content-digest': 'sha256:abc' }),
    }));

    await expect(
      resolveDigest('tok', 'acme/etl', '1.0', doFetch)
    ).rejects.toThrow('no usable digest');
  });

  it('escapes the tag in the request path', async () => {
    const { calls, doFetch } = withDigest(`sha256:${'c'.repeat(64)}`);

    await resolveDigest('tok', 'acme/etl', 'v1/../../etc', doFetch);

    expect(calls[0].url).not.toContain('../');
  });
});
