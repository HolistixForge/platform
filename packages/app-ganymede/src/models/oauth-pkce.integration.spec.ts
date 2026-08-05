/**
 * The unit tests next door check that the model passes the challenge to the
 * database and reads it back. They cannot tell whether that is *enough* — the
 * verification itself lives in @node-oauth/oauth2-server, and the bug being
 * fixed here was invisible from inside the model: every call succeeded, a token
 * came back, and nothing was ever proved. What makes it visible is running the
 * library's own authorize → token sequence against this model and watching a
 * wrong verifier get refused.
 *
 * The database is a small in-memory stand-in for the two stored procedures. The
 * procedures themselves are exercised against a real Postgres — see
 * migrations/006-add-pkce-to-authorization-codes.sql.
 */

jest.mock('../database/pg', () => ({
  pg: {
    query: jest.fn(),
  },
}));

jest.mock('../config', () => ({
  CONFIG: {
    APP_FRONTEND_URL: 'http://localhost:3000',
    APP_FRONTEND_URL_DEV: 'http://localhost:3001',
  },
}));

jest.mock('@holistix-forge/log', () => ({
  EPriority: { Debug: 'debug', Error: 'error' },
  log: jest.fn(),
  error: jest.fn(),
}));

jest.mock('@holistix-forge/backend-engine', () => ({
  development: jest.fn((fn) => fn()),
  generateJwtToken: jest.fn(() => 'a-token'),
}));

jest.mock('@holistix-forge/simple-types', () => ({
  makeUuid: jest.fn(() => 'test-uuid-123'),
}));

jest.mock('@holistix-forge/types', () => ({
  GLOBAL_CLIENT_ID: 'app-main-client-id',
}));

jest.mock('../routes/auth/totp', () => ({
  userFromSession: jest.fn(() => ({
    id: 'user-123',
    username: 'runner-tester',
  })),
}));

import { createHash } from 'crypto';
import OAuth2Server, {
  Request as OAuthRequest,
  Response as OAuthResponse,
} from '@node-oauth/oauth2-server';

import { authenticateHandler, model } from './oauth';
import { pg } from '../database/pg';

//

const RUNNER_CLIENT = 'holistix-runner';
const REDIRECT_URI = 'http://127.0.0.1:54321/callback';

// The verifier never leaves the machine; only its hash is sent to authorize.
const VERIFIER = 'a'.repeat(43);
const challengeFor = (verifier: string) =>
  createHash('sha256').update(verifier).digest('base64url');

//

/** Stands in for oauth_clients and the code columns of oauth_tokens. */
type StoredCode = {
  code: string;
  code_expires_on: Date;
  code_redirect_uri: string;
  scope: string[];
  code_challenge: string | null;
  code_challenge_method: string | null;
};

const codes = new Map<string, StoredCode>();

const clientRow = {
  client_id: RUNNER_CLIENT,
  // A public client: nothing here can be presented as a secret.
  client_secret: '',
  client_secret_hash: null,
  redirect_uris: ['http://127.0.0.1/callback', 'http://[::1]/callback'],
  grants: ['authorization_code'],
  expires_at: null,
  access_token_lifetime: 600,
  refresh_token_lifetime: 3600,
};

const rows = (row: unknown | undefined) => ({
  next: () => (row ? { oneRow: () => row } : null),
});

const installFakeDatabase = () => {
  jest
    .mocked(pg.query)
    .mockImplementation(async (sql: string, params: any[]) => {
      if (sql.startsWith('SELECT * FROM oauth_clients'))
        return rows(params[0] === RUNNER_CLIENT ? clientRow : undefined) as any;

      if (sql.startsWith('call proc_oauth_tokens_save_code')) {
        codes.set(params[2], {
          code: params[2],
          code_expires_on: params[3],
          code_redirect_uri: params[5],
          scope: JSON.parse(params[4]),
          code_challenge: params[6],
          code_challenge_method: params[7],
        });
        return undefined as any;
      }

      if (sql.startsWith('select * from func_oauth_tokens_get_code')) {
        const stored = codes.get(params[0]);
        return rows(
          stored && {
            ...stored,
            client_id: RUNNER_CLIENT,
            client_grants: ['authorization_code'],
            user_id: 'user-123',
            username: 'runner-tester',
            session_id: 'sess-1',
          }
        ) as any;
      }

      if (sql.startsWith('call proc_oauth_tokens_revoke_code')) {
        codes.delete(params[0]);
        return undefined as any;
      }

      return undefined as any;
    });
};

//

const server = new OAuth2Server({
  model,
  accessTokenLifetime: 3600,
  refreshTokenLifetime: 1209600,
  authenticateHandler,
});

const authorize = (params: Record<string, string>) => {
  const request = new OAuthRequest({
    method: 'GET',
    headers: {},
    query: {
      response_type: 'code',
      client_id: RUNNER_CLIENT,
      redirect_uri: REDIRECT_URI,
      state: 'a-state',
      scope: 'read',
      ...params,
    },
    body: {},
    sessionID: 'sess-1',
  });
  return server.authorize(request, new OAuthResponse({} as any), {
    allowEmptyState: false,
    authorizationCodeLifetime: 300,
  });
};

const exchange = (body: Record<string, string>) => {
  const request = new OAuthRequest({
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      // type-is looks at the length before it looks at the type
      'content-length': '1',
    },
    query: {},
    body: {
      grant_type: 'authorization_code',
      client_id: RUNNER_CLIENT,
      redirect_uri: REDIRECT_URI,
      ...body,
    },
  });
  return server.token(request, new OAuthResponse({} as any), {
    accessTokenLifetime: 3600,
    refreshTokenLifetime: 1209600,
    requireClientAuthentication: {},
    alwaysIssueNewRefreshToken: true,
  } as any);
};

//

describe('PKCE, end to end through the library', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    codes.clear();
    installFakeDatabase();
  });

  it('issues a token to a public client that presents the right verifier', async () => {
    // Arrange
    const code = await authorize({
      code_challenge: challengeFor(VERIFIER),
      code_challenge_method: 'S256',
    });

    // Act
    const token = await exchange({
      code: code.authorizationCode,
      code_verifier: VERIFIER,
    });

    // Assert - no client secret was involved anywhere in this flow
    expect(token.accessToken).toBeTruthy();
    expect(token.client.id).toBe(RUNNER_CLIENT);
  });

  it('refuses a verifier that does not match the challenge', async () => {
    // Arrange
    const code = await authorize({
      code_challenge: challengeFor(VERIFIER),
      code_challenge_method: 'S256',
    });

    // Act / Assert
    await expect(
      exchange({
        code: code.authorizationCode,
        code_verifier: 'b'.repeat(43),
      })
    ).rejects.toThrow(/code verifier is invalid/);

    // ...for the right reason. A dropped challenge produces the same refusal
    // here — the library rejects a verifier it has nothing to compare against —
    // so the rejection alone would not tell us anything.
    expect(codes.get(code.authorizationCode)?.code_challenge).toBe(
      challengeFor(VERIFIER)
    );
  });

  it('refuses an intercepted code presented with no verifier at all', async () => {
    // Arrange
    const code = await authorize({
      code_challenge: challengeFor(VERIFIER),
      code_challenge_method: 'S256',
    });

    // Act / Assert - whoever steals the code off the loopback redirect does not
    // have the verifier, and without a secret there is no other way through
    await expect(exchange({ code: code.authorizationCode })).rejects.toThrow();
  });

  it('accepts the loopback redirect on whatever port the runner was given', async () => {
    // Arrange - the client registered http://127.0.0.1/callback, portless
    const code = await authorize({
      redirect_uri: 'http://127.0.0.1:9999/callback',
      code_challenge: challengeFor(VERIFIER),
      code_challenge_method: 'S256',
    });

    // Assert
    expect(code.redirectUri).toBe('http://127.0.0.1:9999/callback');
  });

  it('refuses an authorize request pointing anywhere but loopback', async () => {
    // Act / Assert
    await expect(
      authorize({
        redirect_uri: 'http://evil.example.com:9999/callback',
        code_challenge: challengeFor(VERIFIER),
        code_challenge_method: 'S256',
      })
    ).rejects.toThrow(/redirect_uri/i);
  });

  it('leaves a used code unusable', async () => {
    // Arrange
    const code = await authorize({
      code_challenge: challengeFor(VERIFIER),
      code_challenge_method: 'S256',
    });
    await exchange({ code: code.authorizationCode, code_verifier: VERIFIER });

    // Act / Assert
    await expect(
      exchange({ code: code.authorizationCode, code_verifier: VERIFIER })
    ).rejects.toThrow(/authorization code is invalid/);
  });
});
