import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { CONFIG } from '../config';
import { ForbiddenException } from '@monorepo/log';

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

export const authenticateJwt: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authReq = req as AuthRequest;

  try {
    const payload = verifyJwtToken(authReq.headers.authorization, ['token ']);

    authReq.user = {
      id: payload.user.id,
      username: payload.user.username,
    };

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
export const authenticateGatewayToken: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authReq = req as GatewayAuthRequest;

  try {
    const payload = verifyJwtToken(authReq.headers.authorization, ['Bearer ']);

    // Validate it's a gateway token
    if (payload.type !== 'gateway_token') {
      return next(new ForbiddenException([{ message: 'Invalid token type' }]));
    }

    authReq.gateway = {
      id: payload.gateway_id,
      type: payload.type,
      scope: payload.scope,
    };

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
export const authenticateOrganizationToken: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authReq = req as OrganizationAuthRequest;

  try {
    const payload = verifyJwtToken(authReq.headers.authorization, ['Bearer ']);

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

    next();
  } catch (error: any) {
    return next(error);
  }
};
