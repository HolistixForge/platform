/**
 * Runner authentication.
 *
 * A runner token is signed for a year and lives on a machine its owner may
 * lose. The signature will keep verifying for that whole year whatever the UI
 * says, so revocation is only real if every request consults the runner row —
 * these tests are what hold that check in place.
 */

jest.mock('../database/pg', () => ({
  pg: {
    query: jest.fn(),
  },
}));

jest.mock('../config', () => ({
  CONFIG: {
    JWT_PUBLIC_KEY: 'a-public-key',
  },
}));

jest.mock('@holistix-forge/log', () => {
  class ForbiddenException extends Error {
    constructor(public messages: { message: string }[], cause?: unknown) {
      super(messages[0]?.message ?? 'Forbidden');
    }
  }
  return {
    EPriority: { Info: 'info', Error: 'error' },
    log: jest.fn(),
    error: jest.fn(),
    ForbiddenException,
  };
});

jest.mock('jsonwebtoken', () => ({
  __esModule: true,
  default: { verify: jest.fn() },
}));

import jwt from 'jsonwebtoken';
import { authenticateJwtRunner } from './auth';
import { pg } from '../database/pg';

//

const RUNNER_ID = '7f1d0b9c-2b3a-4a5e-9c6d-8e0f1a2b3c4d';

const validPayload = {
  type: 'runner_token',
  runner_id: RUNNER_ID,
  user_id: 'user-123',
  scope: `runner:${RUNNER_ID}`,
};

const run = async (payload: unknown, row: unknown | undefined) => {
  jest.mocked(jwt.verify).mockReturnValue(payload as any);
  jest.mocked(pg.query).mockResolvedValue({
    next: () => ({ oneRow: () => row }),
  } as any);

  const req: any = { headers: { authorization: `Bearer a.token` } };
  const next = jest.fn();
  await authenticateJwtRunner(req, {} as any, next);
  return { req, next };
};

const enrolledRow = {
  runner_id: RUNNER_ID,
  user_id: 'user-123',
  label: 'laptop',
};

describe('authenticateJwtRunner', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should admit an enrolled runner and attach it to the request', async () => {
    // Act
    const { req, next } = await run(validPayload, enrolledRow);

    // Assert
    expect(next).toHaveBeenCalledWith();
    expect(req.runner).toEqual({
      id: RUNNER_ID,
      user_id: 'user-123',
      label: 'laptop',
    });
  });

  it('should refuse a token whose runner row is gone or revoked', async () => {
    // Arrange / Act - func_runners_touch returns nothing for either case
    const { next } = await run(validPayload, undefined);

    // Assert - this is the entire mechanism by which revocation works
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toMatch(/not enrolled/i);
  });

  it('should consult the database on every request, not only the signature', async () => {
    // Act
    await run(validPayload, enrolledRow);

    // Assert - a middleware that trusted the signature alone would honour a
    // revoked token for the remaining year of its life
    expect(pg.query).toHaveBeenCalledWith(
      'select * from func_runners_touch($1)',
      [RUNNER_ID]
    );
  });

  it('should refuse a user access token presented as a runner token', async () => {
    // Act
    const { next } = await run(
      { type: 'access_token', user: { id: 'user-123' } },
      enrolledRow
    );

    // Assert
    expect(next.mock.calls[0][0].message).toMatch(/token type/i);
    expect(pg.query).not.toHaveBeenCalled();
  });

  it('should refuse a token whose scope names a different runner', async () => {
    // Act - a payload assembled rather than issued
    const { next } = await run(
      { ...validPayload, scope: 'runner:some-other-machine' },
      enrolledRow
    );

    // Assert
    expect(next.mock.calls[0][0].message).toMatch(/token scope/i);
    expect(pg.query).not.toHaveBeenCalled();
  });

  it('should take the owner from the row rather than from the token', async () => {
    // Act - the token claims one owner, the row says another
    const { req } = await run(
      { ...validPayload, user_id: 'someone-else' },
      enrolledRow
    );

    // Assert - the row is what a transfer or a correction would have updated
    expect(req.runner.user_id).toBe('user-123');
  });

  it('should refuse a request with no authorization header', async () => {
    // Arrange
    jest.mocked(jwt.verify).mockReturnValue(validPayload as any);
    const req: any = { headers: {} };
    const next = jest.fn();

    // Act
    await authenticateJwtRunner(req, {} as any, next);

    // Assert
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(pg.query).not.toHaveBeenCalled();
  });
});
