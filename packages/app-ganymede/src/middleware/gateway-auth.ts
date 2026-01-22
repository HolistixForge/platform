import { Request, Response, NextFunction } from 'express';
import { EPriority, log } from '@holistix-forge/log';

/**
 * Middleware to authenticate gateway requests
 * 
 * Checks X-Gateway-Token header against GATEWAY_TOKEN env var.
 * Used for internal API routes that should only be called by gateway.
 */
export const authenticateGatewayToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const providedToken = req.headers['x-gateway-token'];
  const expectedToken = process.env.GATEWAY_TOKEN;

  if (!expectedToken) {
    log(
      EPriority.Error,
      'GATEWAY_AUTH',
      'GATEWAY_TOKEN environment variable not configured'
    );
    res.status(500).json({ error: 'Server misconfigured' });
    return;
  }

  if (!providedToken) {
    log(
      EPriority.Warning,
      'GATEWAY_AUTH',
      `Gateway token missing from ${req.method} ${req.path}`
    );
    res.status(401).json({ error: 'Gateway token required' });
    return;
  }

  if (providedToken !== expectedToken) {
    log(
      EPriority.Warning,
      'GATEWAY_AUTH',
      `Invalid gateway token from ${req.method} ${req.path}`
    );
    res.status(403).json({ error: 'Invalid gateway token' });
    return;
  }

  // Token valid
  next();
};
