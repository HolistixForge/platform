import { hostname } from 'node:os';

import { createPkcePair, createState } from './pkce';
import { listenForCallback } from './loopback';
import { TRunnerCredentials } from './credentials';

/**
 * `runner login`, end to end.
 *
 * The shape is RFC 8252: a public client, a browser for the human part, and a
 * loopback redirect for the machine part. What comes back is deliberately *not*
 * the user's access token — that token is the person, every project they belong
 * to, and it would sit here for as long as its refresh chain kept renewing it.
 * It is used once, to enrol, and then dropped; what stays on disk is a token
 * that names this machine and can be pulled without signing anyone out.
 */

/** The public client Ganymede seeds. No secret goes with it, by construction. */
export const RUNNER_CLIENT_ID = 'holistix-runner';

export type TEnrolOptions = {
  /** e.g. https://apollo.local — where this runner is enrolling. */
  ganymedeUrl: string;
  /** Shown in the owner's machine list. Defaults to this host's name. */
  label?: string;
  /** Hands the authorize URL to the human. Injected so tests stay headless. */
  openBrowser: (url: string) => Promise<void> | void;
  /** Injected for the same reason. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

const trimSlash = (url: string) => url.replace(/\/+$/, '');

const readError = async (response: Response): Promise<string> => {
  const body = await response.text().catch(() => '');
  return `${response.status} ${response.statusText}${body ? `: ${body}` : ''}`;
};

export const enrol = async ({
  ganymedeUrl,
  label,
  openBrowser,
  fetchImpl = fetch,
  timeoutMs,
}: TEnrolOptions): Promise<TRunnerCredentials> => {
  const base = trimSlash(ganymedeUrl);
  const pkce = createPkcePair();
  const state = createState();

  // Listening before the browser opens, not after: the callback can arrive as
  // soon as the URL is handed over, and a race here loses the code.
  const listener = await listenForCallback(state, timeoutMs);

  try {
    const authorize = new URL(`${base}/oauth/authorize`);
    authorize.searchParams.set('response_type', 'code');
    authorize.searchParams.set('client_id', RUNNER_CLIENT_ID);
    authorize.searchParams.set('redirect_uri', listener.redirectUri);
    authorize.searchParams.set('state', state);
    authorize.searchParams.set('code_challenge', pkce.challenge);
    authorize.searchParams.set('code_challenge_method', pkce.method);

    await openBrowser(authorize.toString());

    const { code } = await listener.waitForCode;

    // The exchange carries no client secret — there is none — and Ganymede
    // accepts it precisely because code_verifier is present.
    const tokenResponse = await fetchImpl(`${base}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: listener.redirectUri,
        client_id: RUNNER_CLIENT_ID,
        code_verifier: pkce.verifier,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      throw new Error(
        `Token exchange failed: ${await readError(tokenResponse)}`
      );
    }

    const { access_token } = (await tokenResponse.json()) as {
      access_token?: string;
    };
    if (!access_token) {
      throw new Error('Token exchange returned no access token');
    }

    const machineLabel = label?.trim() || hostname();

    // `token ` and not `Bearer `: authenticateJwtUser in Ganymede accepts that
    // prefix for user tokens, and reserves Bearer for the machine ones.
    const enrolResponse = await fetchImpl(`${base}/runners`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `token ${access_token}`,
      },
      body: JSON.stringify({ label: machineLabel }),
    });

    if (!enrolResponse.ok) {
      throw new Error(`Enrolment failed: ${await readError(enrolResponse)}`);
    }

    const enrolled = (await enrolResponse.json()) as {
      runner_id?: string;
      label?: string;
      token?: string;
    };

    if (!enrolled.runner_id || !enrolled.token) {
      throw new Error('Enrolment returned no runner token');
    }

    // access_token is not stored anywhere. It has done its one job.
    return {
      ganymedeUrl: base,
      runner_id: enrolled.runner_id,
      label: enrolled.label ?? machineLabel,
      token: enrolled.token,
    };
  } finally {
    listener.close();
  }
};

/**
 * `runner status` — who this machine says it is, checked against the platform
 * rather than read off the disk. Returns undefined when the runner has been
 * revoked, which is the answer the owner's UI action is supposed to produce.
 */
export const whoAmI = async (
  credentials: TRunnerCredentials,
  fetchImpl: typeof fetch = fetch
): Promise<
  { runner_id: string; user_id: string; label: string } | undefined
> => {
  const response = await fetchImpl(`${credentials.ganymedeUrl}/runners/me`, {
    headers: { authorization: `Bearer ${credentials.token}` },
  });

  if (response.status === 401 || response.status === 403) return undefined;
  if (!response.ok)
    throw new Error(`Status check failed: ${await readError(response)}`);

  return response.json() as Promise<{
    runner_id: string;
    user_id: string;
    label: string;
  }>;
};

/**
 * `runner disconnect` — the machine withdrawing itself.
 *
 * Deleting the local file alone would leave a runner the platform still
 * believes in: it would keep appearing in its owner's machine list as
 * something to place services on. Revoking server-side first is what makes
 * disconnecting mean what it says, and a runner may only ever revoke itself.
 */
export const disconnect = async (
  credentials: TRunnerCredentials,
  fetchImpl: typeof fetch = fetch
): Promise<boolean> => {
  const response = await fetchImpl(`${credentials.ganymedeUrl}/runners/me`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${credentials.token}` },
  });

  // Already revoked from the UI: the local file still has to go, and that is
  // not a failure to report.
  if (response.status === 403 || response.status === 404) return false;
  if (!response.ok)
    throw new Error(`Disconnect failed: ${await readError(response)}`);

  return true;
};
