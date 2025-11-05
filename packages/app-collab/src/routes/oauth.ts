import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/route-handler';
import { oauth2Server, oauthManager } from '../oauth';
import { requirePermission } from '../middleware/permissions';
import { log } from '@monorepo/log';
import { makeUuid } from '@monorepo/simple-types';

const router = Router();

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

    const request = new (oauth2Server as any).Request(req);
    const response = new (oauth2Server as any).Response(res);

    try {
      const code = await oauth2Server.authorize(request, response, {
        authenticateHandler: {
          handle: () => ({ id: req.user.id }),
        },
      });

      log(7, 'OAUTH', `Authorization code created for user: ${req.user.id}`);
      
      // Redirect back to client with code
      const redirectUri = req.query.redirect_uri as string;
      const state = req.query.state as string;
      const authCode = code.authorizationCode;

      const redirectUrl = `${redirectUri}?code=${authCode}${state ? `&state=${state}` : ''}`;
      return res.redirect(redirectUrl);
    } catch (error: any) {
      log(3, 'OAUTH', `Authorization error: ${error.message}`);
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
    const request = new (oauth2Server as any).Request(req);
    const response = new (oauth2Server as any).Response(res);

    try {
      const token = await oauth2Server.token(request, response);

      log(7, 'OAUTH', `Token issued: ${token.accessToken.substring(0, 10)}...`);

      return res.json({
        access_token: token.accessToken,
        token_type: 'Bearer',
        expires_in: token.accessTokenExpiresAt
          ? Math.floor((token.accessTokenExpiresAt.getTime() - Date.now()) / 1000)
          : 3600,
        refresh_token: token.refreshToken,
        scope: Array.isArray(token.scope) ? token.scope.join(' ') : token.scope,
      });
    } catch (error: any) {
      log(3, 'OAUTH', `Token error: ${error.message}`);
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
    const request = new (oauth2Server as any).Request(req);
    const response = new (oauth2Server as any).Response(res);

    try {
      const token = await oauth2Server.authenticate(request, response);

      log(7, 'OAUTH', `Token authenticated for user: ${token.user?.id}`);

      return res.json({
        user_id: token.user?.id,
        scope: Array.isArray(token.scope) ? token.scope : [token.scope],
        client_id: token.client?.clientId,
      });
    } catch (error: any) {
      log(5, 'OAUTH', `Authentication failed: ${error.message}`);
      return res.status(401).json({ error: 'Invalid token' });
    }
  })
);

/**
 * Register OAuth Client (admin only, container management)
 * POST /oauth/clients
 * Body: {
 *   container_id: string,
 *   project_id: string,
 *   service_name: string,
 *   redirect_uris: string[],
 *   grants: string[]
 * }
 */
router.post(
  '/clients',
  requirePermission('org:admin'), // Only org admins can register OAuth clients
  asyncHandler(async (req: any, res: Response) => {
    
    const { container_id, project_id, service_name, redirect_uris, grants } = req.body;

    if (!container_id || !project_id || !service_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const client_id = makeUuid();
    const client_secret = makeUuid();

    oauthManager.addClient({
      client_id: client_id,
      client_secret: client_secret,
      container_id: String(container_id),
      project_id: String(project_id),
      service_name: String(service_name),
      redirect_uris: redirect_uris || [],
      grants: grants || ['authorization_code', 'refresh_token'],
      created_at: new Date().toISOString(),
    });

    log(6, 'OAUTH', `Registered OAuth client: ${client_id} for container: ${container_id}`);

    return res.json({
      client_id,
      client_secret,
      container_id,
      service_name,
    });
  })
);

/**
 * List OAuth Clients (for a project or container)
 * GET /oauth/clients?project_id=...&container_id=...
 */
router.get(
  '/clients',
  asyncHandler(async (req: Request, res: Response) => {
    // TODO: Add permission check
    
    const { project_id, container_id } = req.query;

    let clients = oauthManager.getAllClients();

    if (container_id) {
      clients = clients.filter((c) => c.container_id === container_id);
    } else if (project_id) {
      clients = clients.filter((c) => c.project_id === project_id);
    }

    // Don't return client_secret in list
    const sanitized = clients.map((c) => ({
      client_id: c.client_id,
      container_id: c.container_id,
      project_id: c.project_id,
      service_name: c.service_name,
      redirect_uris: c.redirect_uris,
      grants: c.grants,
    }));

    return res.json({ clients: sanitized });
  })
);

export default router;

