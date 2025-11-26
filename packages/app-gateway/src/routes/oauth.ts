import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/route-handler';
import { getGatewayInstances } from '../initialization/gateway-instances';
import { createOAuth2Server } from '../oauth';
import { EPriority, log } from '@monorepo/log';

const router = Router();

// Cache OAuth2Server instance
let oauth2ServerInstance: ReturnType<typeof createOAuth2Server> | null = null;

/**
 * Get OAuth2Server instance from gateway instances
 * Creates instance on first call and caches it
 */
function getOAuth2Server() {
  if (oauth2ServerInstance) {
    return oauth2ServerInstance;
  }
  const instances = getGatewayInstances();
  if (!instances) {
    throw new Error('Gateway instances not initialized');
  }
  oauth2ServerInstance = createOAuth2Server(
    instances.oauthManager,
    instances.permissionManager
  );
  return oauth2ServerInstance;
}

/**
 * OAuth Authorization Endpoint
 * GET /oauth/authorize?response_type=code&client_id=...&redirect_uri=...&scope=...
 *
 * User must be authenticated (req.user set by passport)
 */
router.get(
  '/authorize',
  asyncHandler(async (req: any, res: Response) => {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const oauth2Server = getOAuth2Server();
    const request = new (oauth2Server as any).Request(req);
    const response = new (oauth2Server as any).Response(res);

    try {
      const code = await oauth2Server.authorize(request, response, {
        authenticateHandler: {
          handle: () => ({ id: req.user.id }),
        },
      });

      log(EPriority.Debug, 'OAUTH', `Authorization code created for user: ${req.user.id}`);

      // Redirect back to client with code
      const redirectUri = req.query.redirect_uri as string;
      const state = req.query.state as string;
      const authCode = code.authorizationCode;

      const redirectUrl = `${redirectUri}?code=${authCode}${
        state ? `&state=${state}` : ''
      }`;
      return res.redirect(redirectUrl);
    } catch (error: any) {
      log(EPriority.Error, 'OAUTH', `Authorization error: ${error.message}`);
      return res.status(error.code || 500).json({ error: error.message });
    }
  })
);

/**
 * OAuth Token Endpoint
 * POST /oauth/token
 * Body: {
 *   grant_type: 'authorization_code' | 'refresh_token',
 *   code: '...' (for authorization_code),
 *   refresh_token: '...' (for refresh_token),
 *   client_id: '...',
 *   client_secret: '...',
 *   redirect_uri: '...'
 * }
 */
router.post(
  '/token',
  asyncHandler(async (req: Request, res: Response) => {
    const oauth2Server = getOAuth2Server();
    const request = new (oauth2Server as any).Request(req);
    const response = new (oauth2Server as any).Response(res);

    try {
      const token = await oauth2Server.token(request, response);

      log(EPriority.Debug, 'OAUTH', `Token issued: ${token.accessToken.substring(0, 10)}...`);

      return res.json({
        access_token: token.accessToken,
        token_type: 'Bearer',
        expires_in: token.accessTokenExpiresAt
          ? Math.floor(
              (token.accessTokenExpiresAt.getTime() - Date.now()) / 1000
            )
          : 3600,
        refresh_token: token.refreshToken,
        scope: Array.isArray(token.scope) ? token.scope.join(' ') : token.scope,
      });
    } catch (error: any) {
      log(EPriority.Error, 'OAUTH', `Token error: ${error.message}`);
      return res.status(error.code || 500).json({ error: error.message });
    }
  })
);

/**
 * OAuth Authenticate Endpoint (for resource servers)
 * POST /oauth/authenticate
 * Headers: Authorization: Bearer <token>
 *
 * Returns user_id and scopes if token is valid
 */
router.post(
  '/authenticate',
  asyncHandler(async (req: Request, res: Response) => {
    const oauth2Server = getOAuth2Server();
    const request = new (oauth2Server as any).Request(req);
    const response = new (oauth2Server as any).Response(res);

    try {
      const token = await oauth2Server.authenticate(request, response);

      log(EPriority.Debug, 'OAUTH', `Token authenticated for user: ${token.user?.id}`);

      return res.json({
        user_id: token.user?.id,
        scope: Array.isArray(token.scope) ? token.scope : [token.scope],
        client_id: token.client?.clientId,
      });
    } catch (error: any) {
      log(EPriority.Notice, 'OAUTH', `Authentication failed: ${error.message}`);
      return res.status(401).json({ error: 'Invalid token' });
    }
  })
);

export default router;
