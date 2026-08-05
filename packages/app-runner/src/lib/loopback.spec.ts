import { listenForCallback } from './loopback';

/**
 * The loopback listener is where the authorization code re-enters this process,
 * so it is also where a code that belongs to somebody else would.
 */
describe('listenForCallback', () => {
  it('should bind a loopback address on a port the OS chose', async () => {
    // Act
    const listener = await listenForCallback('a-state');

    // Assert - the port is not registered anywhere in advance, which is the
    // whole reason Ganymede ignores it when matching loopback redirects
    expect(listener.redirectUri).toMatch(
      /^http:\/\/127\.0\.0\.1:\d+\/callback$/
    );

    listener.close();
  });

  it('should take a different port each time', async () => {
    // Act - two runners on one machine, or a second attempt after a failure
    const first = await listenForCallback('a');
    const second = await listenForCallback('b');

    // Assert
    expect(first.redirectUri).not.toBe(second.redirectUri);

    first.close();
    second.close();
  });

  it('should hand back the code when the state matches', async () => {
    // Arrange
    const listener = await listenForCallback('a-state');

    // Act
    const response = await fetch(
      `${listener.redirectUri}?code=the-code&state=a-state`
    );

    // Assert
    await expect(listener.waitForCode).resolves.toEqual({
      code: 'the-code',
      state: 'a-state',
    });
    expect(response.status).toBe(200);
  });

  it('should refuse a callback carrying a different state', async () => {
    // Arrange
    const listener = await listenForCallback('a-state');
    const settled = listener.waitForCode.catch((e: Error) => e);

    // Act - a code from a flow this process did not start
    const response = await fetch(
      `${listener.redirectUri}?code=someone-elses&state=another-state`
    );

    // Assert - refused before the code is looked at, which is what stops it
    // being exchanged for a token this machine then stores
    expect(response.status).toBe(400);
    expect((await settled) as Error).toBeInstanceOf(Error);
    await expect(settled).resolves.toMatchObject({
      message: expect.stringMatching(/state/i),
    });
  });

  it('should surface a refusal from the authorization server', async () => {
    // Arrange
    const listener = await listenForCallback('a-state');
    const settled = listener.waitForCode.catch((e: Error) => e.message);

    // Act - the user declined, or the client is unknown
    await fetch(`${listener.redirectUri}?error=access_denied&state=a-state`);

    // Assert
    await expect(settled).resolves.toBe('access_denied');
  });

  it('should ignore anything that is not the callback path', async () => {
    // Arrange - a browser preloading, or a stray request on a local port
    const listener = await listenForCallback('a-state');

    // Act
    const base = listener.redirectUri.replace('/callback', '');
    const response = await fetch(`${base}/favicon.ico`);

    // Assert - and the flow is still waiting, not resolved by the noise
    expect(response.status).toBe(404);

    let settled = false;
    listener.waitForCode.then(
      () => (settled = true),
      () => (settled = true)
    );
    await new Promise((r) => setImmediate(r));
    expect(settled).toBe(false);

    listener.close();
  });

  it('should give up rather than wait forever', async () => {
    // Arrange - nobody ever opens the browser
    const listener = await listenForCallback('a-state', 10);

    // Act / Assert
    await expect(listener.waitForCode).rejects.toThrow(/timed out/i);
  });
});

/**
 * The refusal page shows why an enrolment failed, and the reason comes out of
 * a URL the browser was sent to.
 */
describe('the callback page', () => {
  it('escapes an error the callback carried', async () => {
    // Reflected XSS, and not a theoretical one: this page is served to the
    // user's own browser on 127.0.0.1, where it shares an origin with whatever
    // else that machine hosts.
    const listener = await listenForCallback('state-123', 60_000);
    const hostile = "</p><script>alert('xss')</script>";

    const response = await fetch(
      `${listener.redirectUri}?state=state-123&error=${encodeURIComponent(
        hostile
      )}`
    );
    const body = await response.text();

    expect(response.status).toBe(400);
    expect(body).not.toContain('<script>');
    expect(body).toContain('&lt;script&gt;');

    listener.close();
    await listener.waitForCode.catch(() => undefined);
  });
});
