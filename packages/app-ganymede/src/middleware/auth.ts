import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { CONFIG } from '../config';
import { ForbiddenException } from '@holistix-forge/log';
import { trace } from '@opentelemetry/api';
import {
  TJwtGateway,
  TJwtOrganization,
  TJwtRunner,
  TJwtUser,
} from '@holistix-forge/types';
import { pg } from '../database/pg';

export interface AuthRequest extends Request {
  user: {
    id: string;
    username: string;
  };
}

export interface GatewayAuthRequest extends Request {
  gateway: {
    id: string;
    type: 'gateway_token';
    scope: string;
  };
}

export interface OrganizationAuthRequest extends Request {
  organization: {
    id: string;
    gateway_id: string;
    type: 'organization_token';
    scope: string;
  };
}

export interface RunnerAuthRequest extends Request {
  runner: {
    id: string;
    user_id: string;
    label: string;
  };
}

/**
 * Common JWT verification logic
 * Extracts and verifies JWT token from Authorization header
 */
function verifyJwtToken(
  authHeader: string | undefined,
  prefixes: string[] = ['token ', 'Bearer ']
): any {
  if (!authHeader) {
    throw new ForbiddenException([{ message: 'No authorization header' }]);
  }

  let token = authHeader;
  for (const prefix of prefixes) {
    if (authHeader.startsWith(prefix)) {
      token = authHeader.replace(prefix, '');
      break;
    }
  }

  try {
    return jwt.verify(token, CONFIG.JWT_PUBLIC_KEY, {
      algorithms: ['RS256'],
    });
  } catch (error: any) {
    throw new ForbiddenException([{ message: 'Invalid token' }], error);
  }
}

export const authenticateJwtUser: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authReq = req as AuthRequest;

  try {
    const payload: TJwtUser = verifyJwtToken(authReq.headers.authorization, [
      'token ',
    ]) as TJwtUser;

    // Validate it's a user token
    if (payload.type !== 'access_token') {
      return next(new ForbiddenException([{ message: 'Invalid token type' }]));
    }

    authReq.user = {
      id: payload.user.id,
      username: payload.user.username,
    };

    // Enrich span with user context
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttribute('user.id', payload.user.id);
      span.setAttribute('user.username', payload.user.username);
    }

    next();
  } catch (error: any) {
    return next(error);
  }
};

/**
 * Authenticate gateway JWT token (TJwtGateway)
 * Token from add-gateway command when container starts:
 * {
 *   type: 'gateway_token',
 *   gateway_id: string,
 *   scope: string
 * }
 */
export const authenticateJwtGateway: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authReq = req as GatewayAuthRequest;

  try {
    const payload: TJwtGateway = verifyJwtToken(authReq.headers.authorization, [
      'Bearer ',
    ]) as TJwtGateway;

    // Validate it's a gateway token
    if (payload.type !== 'gateway_token') {
      return next(new ForbiddenException([{ message: 'Invalid token type' }]));
    }

    authReq.gateway = {
      id: payload.gateway_id,
      type: payload.type,
      scope: payload.scope,
    };

    // Enrich span with user context
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttribute('gateway.id', payload.gateway_id);
    }

    next();
  } catch (error: any) {
    return next(error);
  }
};

/**
 * Authenticate a runner JWT token (TJwtRunner)
 *
 * Token minted at enrolment, once, for one machine:
 * {
 *   type: 'runner_token',
 *   runner_id: string,
 *   user_id: string,
 *   scope: 'runner:<runner_id>'
 * }
 *
 * Unlike the other three, this one goes to the database on every request. A
 * runner token lives a year on a machine its owner may lose, sell or lend, and
 * revoking it has to mean something before that year is out — a signature stays
 * valid however loudly the UI says otherwise, so the runner row is what decides.
 * The same statement records that the runner was here, so the check costs one
 * round trip rather than two.
 */
export const authenticateJwtRunner: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authReq = req as RunnerAuthRequest;

  try {
    const payload: TJwtRunner = verifyJwtToken(authReq.headers.authorization, [
      'Bearer ',
    ]) as TJwtRunner;

    if (payload.type !== 'runner_token') {
      return next(new ForbiddenException([{ message: 'Invalid token type' }]));
    }

    // The scope names the machine, so a token whose scope and runner_id
    // disagree was assembled rather than issued.
    if (payload.scope !== `runner:${payload.runner_id}`) {
      return next(new ForbiddenException([{ message: 'Invalid token scope' }]));
    }

    const qr = await pg.query('select * from func_runners_touch($1)', [
      payload.runner_id,
    ]);
    const row = qr.next()?.oneRow();

    if (!row) {
      // Unknown or revoked — deliberately the same answer, so a refusal cannot
      // be used to learn which runner ids exist.
      return next(
        new ForbiddenException([{ message: 'Runner is not enrolled' }])
      );
    }

    // The owner comes from the row, not from the token: if a runner changes
    // hands the row is what was updated.
    authReq.runner = {
      id: row['runner_id'] as string,
      user_id: row['user_id'] as string,
      label: row['label'] as string,
    };

    const span = trace.getActiveSpan();
    if (span) {
      span.setAttribute('runner.id', authReq.runner.id);
      span.setAttribute('user.id', authReq.runner.user_id);
    }

    next();
  } catch (error: any) {
    return next(error);
  }
};

/**
 * Authenticate organization JWT token (TJwtOrganization)
 * Token given to gateway when allocated to organization:
 * {
 *   type: 'organization_token',
 *   organization_id: string,
 *   gateway_id: string,
 *   scope: string
 * }
 */
export const authenticateJwtOrganization: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authReq = req as OrganizationAuthRequest;

  try {
    const payload: TJwtOrganization = verifyJwtToken(
      authReq.headers.authorization,
      ['Bearer ']
    ) as TJwtOrganization;

    // Validate it's an organization token
    if (payload.type !== 'organization_token') {
      return next(new ForbiddenException([{ message: 'Invalid token type' }]));
    }

    authReq.organization = {
      id: payload.organization_id,
      gateway_id: payload.gateway_id,
      type: payload.type,
      scope: payload.scope,
    };

    // Enrich span with organization context
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttribute('organization.id', payload.organization_id);
      span.setAttribute('gateway.id', payload.gateway_id);
    }

    next();
  } catch (error: any) {
    return next(error);
  }
};
