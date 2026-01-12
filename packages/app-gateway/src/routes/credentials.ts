/**
 * Credential Routes for Gateway
 *
 * Provides API endpoints for:
 * - Listing available credential providers (from modules)
 * - Creating credentials (API key or OAuth)
 * - Listing/managing user credentials
 * - OAuth callback handling
 */

import { Router, Request, Response } from 'express';
import { EPriority, log } from '@holistix-forge/log';
import crypto from 'crypto';
import { asyncHandler } from '../middleware/route-handler';
import { getGatewayInstances } from '../initialization/gateway-instances';
import type { CredentialManagerImpl } from '../credentials';
import type { TOAuthCredentialProvider } from '@holistix-forge/gateway';

/**
 * Setup credential routes
 */
export const setupCredentialRoutes = (router: Router): void => {
  // ==========================================================================
  // GET /credentials/providers - List available credential providers
  // ==========================================================================
  router.get(
    '/credentials/providers',
    asyncHandler(async (req: Request, res: Response) => {
      const instances = getGatewayInstances();
      if (!instances?.credentialManager) {
        return res
          .status(503)
          .json({ error: 'Credential service not available' });
      }

      const credentialManager =
        instances.credentialManager as CredentialManagerImpl;
      const providers = credentialManager.getProviders();

      // Return providers with sensitive data removed
      const safeProviders = providers.map((p) => {
        if (p.collectionMethod === 'oauth') {
          // Don't expose OAuth secrets
          return {
            id: p.id,
            displayName: p.displayName,
            description: p.description,
            icon: p.icon,
            collectionMethod: p.collectionMethod,
            // Only expose scopes, not client credentials
            scopes: p.oauth.scopes,
          };
        }
        return {
          id: p.id,
          displayName: p.displayName,
          description: p.description,
          icon: p.icon,
          collectionMethod: p.collectionMethod,
          fields: p.fields,
        };
      });

      return res.json({ providers: safeProviders });
    })
  );

  // ==========================================================================
  // GET /credentials - List user's credentials
  // ==========================================================================
  router.get(
    '/credentials',
    asyncHandler(async (req: Request, res: Response) => {
      const instances = getGatewayInstances();
      if (!instances?.credentialManager) {
        return res
          .status(503)
          .json({ error: 'Credential service not available' });
      }

      // Get user_id from auth context (populated by auth middleware)
      const user_id = (req as any).user?.id;
      if (!user_id) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const credentialManager =
        instances.credentialManager as CredentialManagerImpl;
      const credentials = await credentialManager.listCredentials(user_id);

      return res.json({ credentials });
    })
  );

  // ==========================================================================
  // POST /credentials/api-key - Create API key credential
  // ==========================================================================
  router.post(
    '/credentials/api-key',
    asyncHandler(async (req: Request, res: Response) => {
      const instances = getGatewayInstances();
      if (!instances?.credentialManager) {
        return res
          .status(503)
          .json({ error: 'Credential service not available' });
      }

      const user_id = (req as any).user?.id;
      if (!user_id) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const { provider_id, name, values, metadata } = req.body;

      if (!provider_id || !name || !values) {
        return res
          .status(400)
          .json({
            error: 'Missing required fields: provider_id, name, values',
          });
      }

      const credentialManager =
        instances.credentialManager as CredentialManagerImpl;

      // Validate provider exists and is API key type
      const provider = credentialManager.getProvider(provider_id);
      if (!provider) {
        return res
          .status(400)
          .json({ error: `Unknown provider: ${provider_id}` });
      }
      if (provider.collectionMethod !== 'api_key') {
        return res
          .status(400)
          .json({
            error: `Provider ${provider_id} requires OAuth, not API key`,
          });
      }

      // Validate required fields are provided
      const missingFields = provider.fields
        .filter((f) => f.required !== false && !values[f.name])
        .map((f) => f.name);
      if (missingFields.length > 0) {
        return res
          .status(400)
          .json({
            error: `Missing required fields: ${missingFields.join(', ')}`,
          });
      }

      try {
        const credential = await credentialManager.createApiKeyCredential(
          user_id,
          {
            provider_id,
            name,
            values,
            metadata,
          }
        );

        log(
          EPriority.Info,
          'CREDENTIALS',
          `Created API key credential ${credential.id} for user ${user_id}`
        );
        return res.status(201).json({ credential });
      } catch (error: any) {
        log(
          EPriority.Error,
          'CREDENTIALS',
          `Failed to create credential`,
          error
        );
        return res
          .status(500)
          .json({ error: error.message || 'Failed to create credential' });
      }
    })
  );

  // ==========================================================================
  // GET /credentials/oauth/start/:provider_id - Start OAuth flow
  // ==========================================================================
  router.get(
    '/credentials/oauth/start/:provider_id',
    asyncHandler(async (req: Request, res: Response) => {
      const instances = getGatewayInstances();
      if (!instances?.credentialManager) {
        return res
          .status(503)
          .json({ error: 'Credential service not available' });
      }

      const user_id = (req as any).user?.id;
      if (!user_id) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const { provider_id } = req.params;
      const { name, redirect_uri } = req.query;

      if (!name || !redirect_uri) {
        return res
          .status(400)
          .json({ error: 'Missing required query params: name, redirect_uri' });
      }

      const credentialManager =
        instances.credentialManager as CredentialManagerImpl;

      // Validate provider exists and is OAuth type
      const provider = credentialManager.getProvider(provider_id);
      if (!provider) {
        return res
          .status(400)
          .json({ error: `Unknown provider: ${provider_id}` });
      }
      if (provider.collectionMethod !== 'oauth') {
        return res
          .status(400)
          .json({ error: `Provider ${provider_id} is not OAuth-based` });
      }

      const oauthProvider = provider as TOAuthCredentialProvider;
      const { oauth } = oauthProvider;

      // Get client credentials from env
      const clientId = process.env[oauth.clientIdEnvVar];
      if (!clientId) {
        log(
          EPriority.Error,
          'CREDENTIALS',
          `Missing env var: ${oauth.clientIdEnvVar}`
        );
        return res
          .status(500)
          .json({ error: 'OAuth not configured for this provider' });
      }

      // Generate state and PKCE verifier
      const state = crypto.randomBytes(32).toString('hex');
      let pkceVerifier: string | undefined;
      let pkceChallenge: string | undefined;

      if (oauth.pkce) {
        pkceVerifier = crypto.randomBytes(32).toString('base64url');
        pkceChallenge = crypto
          .createHash('sha256')
          .update(pkceVerifier)
          .digest('base64url');
      }

      // Save state for callback
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes
      credentialManager.saveOAuthState({
        state,
        provider_id,
        name: name as string,
        user_id,
        redirect_uri: redirect_uri as string,
        pkce_verifier: pkceVerifier,
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
      });

      // Build authorization URL
      const authUrl = new URL(oauth.authorizationUrl);
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set(
        'redirect_uri',
        `${req.protocol}://${req.get('host')}/credentials/oauth/callback`
      );
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('state', state);

      if (oauth.scopes.length > 0) {
        authUrl.searchParams.set('scope', oauth.scopes.join(' '));
      }

      if (pkceChallenge) {
        authUrl.searchParams.set('code_challenge', pkceChallenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');
      }

      // Add any extra authorization params
      if (oauth.authorizationParams) {
        for (const [key, value] of Object.entries(oauth.authorizationParams)) {
          authUrl.searchParams.set(key, value);
        }
      }

      log(
        EPriority.Info,
        'CREDENTIALS',
        `Starting OAuth flow for provider ${provider_id}, user ${user_id}`
      );

      return res.json({ authorization_url: authUrl.toString() });
    })
  );

  // ==========================================================================
  // GET /credentials/oauth/callback - OAuth callback handler
  // ==========================================================================
  router.get(
    '/credentials/oauth/callback',
    asyncHandler(async (req: Request, res: Response) => {
      const instances = getGatewayInstances();
      if (!instances?.credentialManager) {
        return res
          .status(503)
          .json({ error: 'Credential service not available' });
      }

      const { code, state, error, error_description } = req.query;

      // Handle OAuth errors
      if (error) {
        log(
          EPriority.Warning,
          'CREDENTIALS',
          `OAuth error: ${error} - ${error_description}`
        );
        return res.redirect(`/?error=${encodeURIComponent(error as string)}`);
      }

      if (!code || !state) {
        return res.status(400).json({ error: 'Missing code or state' });
      }

      const credentialManager =
        instances.credentialManager as CredentialManagerImpl;

      // Consume and validate state
      const stateData = credentialManager.consumeOAuthState(state as string);
      if (!stateData) {
        return res.status(400).json({ error: 'Invalid or expired state' });
      }

      // Check expiration
      if (new Date(stateData.expires_at) < new Date()) {
        return res.status(400).json({ error: 'OAuth state expired' });
      }

      // Get provider
      const provider = credentialManager.getProvider(stateData.provider_id);
      if (!provider || provider.collectionMethod !== 'oauth') {
        return res.status(400).json({ error: 'Invalid provider' });
      }

      const oauthProvider = provider as TOAuthCredentialProvider;
      const { oauth } = oauthProvider;

      // Get client credentials
      const clientId = process.env[oauth.clientIdEnvVar];
      const clientSecret = process.env[oauth.clientSecretEnvVar];

      if (!clientId || !clientSecret) {
        log(EPriority.Error, 'CREDENTIALS', 'Missing OAuth client credentials');
        return res.status(500).json({ error: 'OAuth not configured' });
      }

      try {
        // Exchange code for tokens
        const tokenParams = new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          code: code as string,
          redirect_uri: `${req.protocol}://${req.get(
            'host'
          )}/credentials/oauth/callback`,
        });

        if (stateData.pkce_verifier) {
          tokenParams.set('code_verifier', stateData.pkce_verifier);
        }

        // Add any extra token params
        if (oauth.tokenParams) {
          for (const [key, value] of Object.entries(oauth.tokenParams)) {
            tokenParams.set(key, value);
          }
        }

        const tokenResponse = await fetch(oauth.tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: tokenParams,
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          log(
            EPriority.Error,
            'CREDENTIALS',
            `Token exchange failed: ${errorText}`
          );
          return res.redirect(
            `${stateData.redirect_uri}?error=token_exchange_failed`
          );
        }

        const tokens = await tokenResponse.json();

        // Create credential
        const credential = await credentialManager.createOAuthCredential(
          stateData.user_id,
          stateData.provider_id,
          stateData.name,
          {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_in: tokens.expires_in,
            refresh_expires_in: tokens.refresh_expires_in,
            scope: tokens.scope,
          }
        );

        log(
          EPriority.Info,
          'CREDENTIALS',
          `Created OAuth credential ${credential.id} for user ${stateData.user_id}`
        );

        // Redirect back to app with success
        return res.redirect(
          `${stateData.redirect_uri}?success=true&credential_id=${credential.id}`
        );
      } catch (error: any) {
        log(EPriority.Error, 'CREDENTIALS', `OAuth callback failed`, error);
        return res.redirect(
          `${stateData.redirect_uri}?error=${encodeURIComponent(error.message)}`
        );
      }
    })
  );

  // ==========================================================================
  // DELETE /credentials/:credential_id - Delete credential
  // ==========================================================================
  router.delete(
    '/credentials/:credential_id',
    asyncHandler(async (req: Request, res: Response) => {
      const instances = getGatewayInstances();
      if (!instances?.credentialManager) {
        return res
          .status(503)
          .json({ error: 'Credential service not available' });
      }

      const user_id = (req as any).user?.id;
      if (!user_id) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const { credential_id } = req.params;
      const credentialManager =
        instances.credentialManager as CredentialManagerImpl;

      // TODO: Verify ownership before deletion
      const success = await credentialManager.deleteCredential(credential_id);

      if (success) {
        log(
          EPriority.Info,
          'CREDENTIALS',
          `Deleted credential ${credential_id}`
        );
        return res.json({ success: true });
      } else {
        return res.status(404).json({ error: 'Credential not found' });
      }
    })
  );

  // ==========================================================================
  // POST /credentials/:credential_id/use - Get decrypted credential for use
  // ==========================================================================
  router.post(
    '/credentials/:credential_id/use',
    asyncHandler(async (req: Request, res: Response) => {
      const instances = getGatewayInstances();
      if (!instances?.credentialManager) {
        return res
          .status(503)
          .json({ error: 'Credential service not available' });
      }

      const user_id = (req as any).user?.id;
      if (!user_id) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const { credential_id } = req.params;
      const credentialManager =
        instances.credentialManager as CredentialManagerImpl;

      // TODO: Verify ownership before use
      const decrypted = await credentialManager.useCredential(credential_id);

      if (!decrypted) {
        return res
          .status(404)
          .json({ error: 'Credential not found or could not be decrypted' });
      }

      // Note: This returns sensitive data - should only be called over secure channel
      return res.json({ credential: decrypted });
    })
  );

  log(EPriority.Info, 'ROUTES', 'Credential routes registered');
};
