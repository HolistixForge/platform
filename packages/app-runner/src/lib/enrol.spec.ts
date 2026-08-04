import { createHash } from 'node:crypto';
import { disconnect, enrol, RUNNER_CLIENT_ID, whoAmI } from './enrol';

/**
 * The whole of `runner login`, against a Ganymede stub that checks what a real
 * one checks: that the verifier matches the challenge, that the redirect is the
 * one the code was issued for, and that no client secret is involved anywhere.
 */

type TStubOptions = {
  /** Return a token response the runner should reject. */
  tokenResponse?: () => Response;
  enrolResponse?: () => Response;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/**
 * Stands in for Ganymede's /oauth/token and /runners, and records what it was
 * sent so the flow can be inspected afterwards.
 */
const stubGanymede = (options: TStubOptions = {}) => {
  const seen = {
    authorizeUrl: undefined as URL | undefined,
    tokenBody: undefined as URLSearchParams | undefined,
    enrolAuth: undefined as string | undefined,
    enrolBody: undefined as Record<string, unknown> | undefined,
  };

  const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));

    if (url.pathname === '/oauth/token') {
      seen.tokenBody = new URLSearchParams(String(init?.body));
      if (options.tokenResponse) return options.tokenResponse();
      return json({ access_token: 'a-user-access-token' });
    }

    if (url.pathname === '/runners') {
      seen.enrolAuth = (init?.headers as Record<string, string>)?.authorization;
      seen.enrolBody = JSON.parse(String(init?.body));
      if (options.enrolResponse) return options.enrolResponse();
      return json(
        {
          runner_id: 'runner-1',
          label: (seen.enrolBody as { label: string }).label,
          token: 'a-runner-token',
        },
        201
      );
    }

    throw new Error(`Unexpected request to ${url.pathname}`);
  }) as unknown as typeof fetch;

  /**
   * Plays the browser: reads the authorize URL, and sends the code back to the
   * loopback redirect exactly as a redirect would.
   */
  const openBrowser = async (url: string) => {
    seen.authorizeUrl = new URL(url);
    const redirect = seen.authorizeUrl.searchParams.get('redirect_uri') ?? '';
    const state = seen.authorizeUrl.searchParams.get('state') ?? '';
    await fetch(`${redirect}?code=an-authorization-code&state=${state}`);
  };

  return { fetchImpl, openBrowser, seen };
};

describe('enrol', () => {
  it('should come back with a runner token and where it belongs', async () => {
    // Arrange
    const { fetchImpl, openBrowser } = stubGanymede();

    // Act
    const credentials = await enrol({
      ganymedeUrl: 'http://ganymede.test/',
      label: 'laptop',
      openBrowser,
      fetchImpl,
    });

    // Assert - the trailing slash is gone, so later requests do not double it
    expect(credentials).toEqual({
      ganymedeUrl: 'http://ganymede.test',
      runner_id: 'runner-1',
      label: 'laptop',
      token: 'a-runner-token',
    });
  });

  it('should send a challenge the verifier actually derives', async () => {
    // Arrange
    const { fetchImpl, openBrowser, seen } = stubGanymede();

    // Act
    await enrol({
      ganymedeUrl: 'http://ganymede.test',
      openBrowser,
      fetchImpl,
    });

    // Assert - Ganymede re-derives this at the token step; a mismatch here is
    // an enrolment that always fails
    const challenge = seen.authorizeUrl?.searchParams.get('code_challenge');
    const verifier = seen.tokenBody?.get('code_verifier');
    expect(seen.authorizeUrl?.searchParams.get('code_challenge_method')).toBe(
      'S256'
    );
    expect(challenge).toBe(
      createHash('sha256').update(String(verifier)).digest('base64url')
    );
  });

  it('should ask for a code on a loopback redirect', async () => {
    // Arrange
    const { fetchImpl, openBrowser, seen } = stubGanymede();

    // Act
    await enrol({
      ganymedeUrl: 'http://ganymede.test',
      openBrowser,
      fetchImpl,
    });

    // Assert - the code comes back to a socket on this machine, never over the
    // network, which is what makes a public client acceptable at all
    expect(seen.authorizeUrl?.searchParams.get('response_type')).toBe('code');
    expect(seen.authorizeUrl?.searchParams.get('redirect_uri')).toMatch(
      /^http:\/\/127\.0\.0\.1:\d+\/callback$/
    );
  });

  it('should exchange against the same redirect it was issued for', async () => {
    // Arrange
    const { fetchImpl, openBrowser, seen } = stubGanymede();

    // Act
    await enrol({
      ganymedeUrl: 'http://ganymede.test',
      openBrowser,
      fetchImpl,
    });

    // Assert - RFC 6749 §4.1.3 requires them identical, port included
    expect(seen.tokenBody?.get('redirect_uri')).toBe(
      seen.authorizeUrl?.searchParams.get('redirect_uri')
    );
  });

  it('should never send a client secret', async () => {
    // Arrange
    const { fetchImpl, openBrowser, seen } = stubGanymede();

    // Act
    await enrol({
      ganymedeUrl: 'http://ganymede.test',
      openBrowser,
      fetchImpl,
    });

    // Assert - a secret shipped to every laptop is not a secret; PKCE is what
    // replaces it, and the client id is public by design
    expect(seen.tokenBody?.get('client_id')).toBe(RUNNER_CLIENT_ID);
    expect(seen.tokenBody?.has('client_secret')).toBe(false);
    expect(seen.authorizeUrl?.searchParams.has('client_secret')).toBe(false);
  });

  it('should label the machine with its hostname when none is given', async () => {
    // Arrange
    const { fetchImpl, openBrowser, seen } = stubGanymede();

    // Act
    await enrol({
      ganymedeUrl: 'http://ganymede.test',
      openBrowser,
      fetchImpl,
    });

    // Assert
    const { hostname } = await import('node:os');
    expect(seen.enrolBody).toEqual({ label: hostname() });
  });

  it('should enrol with the user token, and keep only the runner one', async () => {
    // Arrange
    const { fetchImpl, openBrowser, seen } = stubGanymede();

    // Act
    const credentials = await enrol({
      ganymedeUrl: 'http://ganymede.test',
      openBrowser,
      fetchImpl,
    });

    // Assert - the user token is spent on this one call. Keeping it would put
    // the person's whole session on a laptop for as long as it kept renewing.
    expect(seen.enrolAuth).toBe('token a-user-access-token');
    expect(JSON.stringify(credentials)).not.toContain('a-user-access-token');
  });

  it('should fail loudly when the exchange is refused', async () => {
    // Arrange - a mismatched verifier looks exactly like this
    const { fetchImpl, openBrowser } = stubGanymede({
      tokenResponse: () => json({ error: 'invalid_grant' }, 400),
    });

    // Act / Assert
    await expect(
      enrol({ ganymedeUrl: 'http://ganymede.test', openBrowser, fetchImpl })
    ).rejects.toThrow(/Token exchange failed/);
  });

  it('should fail when enrolment returns no token', async () => {
    // Arrange
    const { fetchImpl, openBrowser } = stubGanymede({
      enrolResponse: () => json({ runner_id: 'runner-1' }, 201),
    });

    // Act / Assert - writing credentials with no token would leave a file that
    // makes the next login refuse to start
    await expect(
      enrol({ ganymedeUrl: 'http://ganymede.test', openBrowser, fetchImpl })
    ).rejects.toThrow(/no runner token/i);
  });

  it('should give up when the browser never comes back', async () => {
    // Arrange
    const { fetchImpl } = stubGanymede();

    // Act / Assert
    await expect(
      enrol({
        ganymedeUrl: 'http://ganymede.test',
        openBrowser: () => undefined,
        fetchImpl,
        timeoutMs: 10,
      })
    ).rejects.toThrow(/timed out/i);
  });
});

//

const credentials = {
  ganymedeUrl: 'http://ganymede.test',
  runner_id: 'runner-1',
  label: 'laptop',
  token: 'a-runner-token',
};

describe('whoAmI', () => {
  it('should present the runner token as a bearer', async () => {
    // Arrange
    const fetchImpl = jest.fn(async () =>
      json({ runner_id: 'runner-1', user_id: 'user-1', label: 'laptop' })
    ) as unknown as typeof fetch;

    // Act
    const me = await whoAmI(credentials, fetchImpl);

    // Assert
    expect(me?.runner_id).toBe('runner-1');
    expect(jest.mocked(fetchImpl).mock.calls[0][0]).toBe(
      'http://ganymede.test/runners/me'
    );
    expect(
      (
        jest.mocked(fetchImpl).mock.calls[0][1]?.headers as Record<
          string,
          string
        >
      ).authorization
    ).toBe('Bearer a-runner-token');
  });

  it('should report a revoked runner as not enrolled rather than throw', async () => {
    // Arrange - the owner pressed disconnect in the UI
    const fetchImpl = (async () =>
      json({ error: 'forbidden' }, 403)) as unknown as typeof fetch;

    // Act / Assert - this is the expected end of a runner's life, not a fault
    await expect(whoAmI(credentials, fetchImpl)).resolves.toBeUndefined();
  });

  it('should throw on anything else', async () => {
    // Arrange - the platform is down, which is a different problem
    const fetchImpl = (async () => json({}, 500)) as unknown as typeof fetch;

    // Act / Assert
    await expect(whoAmI(credentials, fetchImpl)).rejects.toThrow(/500/);
  });
});

describe('disconnect', () => {
  it('should withdraw the machine server-side', async () => {
    // Arrange
    const fetchImpl = jest.fn(async () =>
      json({ runner_id: 'runner-1', revoked_at: '2026-08-05T00:00:00Z' })
    ) as unknown as typeof fetch;

    // Act
    const revoked = await disconnect(credentials, fetchImpl);

    // Assert - deleting the local file alone would leave the platform still
    // offering this machine as somewhere to place services
    expect(revoked).toBe(true);
    expect(jest.mocked(fetchImpl).mock.calls[0][1]?.method).toBe('DELETE');
  });

  it('should treat an already-revoked runner as done, not failed', async () => {
    // Arrange
    const fetchImpl = (async () => json({}, 403)) as unknown as typeof fetch;

    // Act / Assert - the local token still has to go
    await expect(disconnect(credentials, fetchImpl)).resolves.toBe(false);
  });
});
