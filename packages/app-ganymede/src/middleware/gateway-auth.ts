import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { CONFIG } from '../config';
import { EPriority, log } from '@holistix-forge/log';
import { TJwtGateway } from '@holistix-forge/types';
import { GatewayAuthRequest } from './auth';

/**
 * Middleware to authenticate gateway requests via JWT
 *
 * Verifies X-Gateway-Token header as a JWT gateway token.
 * Used for internal API routes that should only be called by gateway.
 */
export const authenticateGatewayToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers['x-gateway-token'] as string | undefined;

  if (!token) {
    log(
      EPriority.Warning,
      'GATEWAY_AUTH',
      `Gateway token missing from ${req.method} ${req.path}`
    );
    res.status(401).json({ error: 'Gateway token required' });
    return;
  }

  try {
    const payload = jwt.verify(token, CONFIG.JWT_PUBLIC_KEY, {
      algorithms: ['RS256'],
    }) as TJwtGateway;

    if (payload.type !== 'gateway_token') {
      log(
        EPriority.Warning,
        'GATEWAY_AUTH',
        `Invalid token type from ${req.method} ${req.path}: ${payload.type}`
      );
      res.status(403).json({ error: 'Invalid token type' });
      return;
    }

    // Attach gateway info to request
    const authReq = req as GatewayAuthRequest;
    authReq.gateway = {
      id: payload.gateway_id,
      type: payload.type,
      scope: payload.scope,
    };

    // Set X-Gateway-Id for downstream use
    req.headers['x-gateway-id'] = payload.gateway_id;

    next();
  } catch (error: any) {
    log(
      EPriority.Warning,
      'GATEWAY_AUTH',
      `Invalid gateway token from ${req.method} ${req.path}: ${error.message}`
    );
    res.status(403).json({ error: 'Invalid gateway token' });
  }
};
