import { Router, Request, RequestHandler } from 'express';
import { randomBytes, randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { authenticateGatewayToken } from '../../middleware/gateway-auth';
import { pg } from '../../database/pg';
import { asyncHandler } from '../../middleware/route-handler';
import { EPriority, log } from '@holistix-forge/log';

const BCRYPT_ROUNDS = 10;
const VALID_GRANTS = [
  'authorization_code',
  'refresh_token',
  'client_credentials',
];
const LEGACY_SECRET_PLACEHOLDER = 'hashed';

/**
 * Validate that every redirect URI is a subdomain of the platform DOMAIN.
 * Defense-in-depth: prevents rogue OAuth clients from redirecting to external domains.
 */
function validateRedirectUris(redirectUris: string[], domain: string): boolean {
  // Compared against `URL.hostname`, which never carries a port — so neither
  // may this. DOMAIN does carry one wherever nginx is not on 443, and the
  // comparison below is then false for every URI ever submitted: not a
  // loosening of the check but a permanent refusal, and the caller is the
  // gateway registering a user container's own sign-in endpoint. Starting a
  // service would get a 400 saying its redirect is not a subdomain of a domain
  // it plainly is a subdomain of.
  const host = domain.split(':')[0];

  for (const uri of redirectUris) {
    let hostname: string;
    try {
      hostname = new URL(uri).hostname;
    } catch {
      return false;
    }
    // Must be exactly the domain or a subdomain of it
    if (hostname !== host && !hostname.endsWith('.' + host)) {
      return false;
    }
  }
  return true;
}

/**
 * Internal OAuth Client Routes
 *
 * These routes are ONLY callable by gateway (not frontend).
 * Protected by gateway token authentication.
 *
 * Ganymede stores generic OAuth clients — it has zero awareness of containers.
 * The fact that clients are used by auth guard proxies is the gateway's concern.
 */
export const setupInternalOAuthClientRoutes = (
  router: Router,
  rateLimiter?: RequestHandler
) => {
  const middlewares = rateLimiter
    ? [rateLimiter, authenticateGatewayToken]
    : [authenticateGatewayToken];

  /**
   * POST /internal/oauth/clients
   * Register a new OAuth client (Gateway-only)
   *
   * Server generates both client_id (UUID) and client_secret (random hex).
   * The plaintext secret is returned ONCE. Ganymede stores bcrypt hash only.
   */
  router.post(
    '/internal/oauth/clients',
    ...middlewares,
    asyncHandler(async (req: Request, res) => {
      const {
        redirect_uris,
        grants,
        access_token_lifetime,
        refresh_token_lifetime,
        label,
      } = req.body;

      if (
        !redirect_uris ||
        !Array.isArray(redirect_uris) ||
        redirect_uris.length === 0
      ) {
        return res
          .status(400)
          .json({ error: 'redirect_uris required (array)' });
      }

      if (!grants || !Array.isArray(grants) || grants.length === 0) {
        return res.status(400).json({ error: 'grants required (array)' });
      }

      const invalidGrants = grants.filter(
        (g: string) => !VALID_GRANTS.includes(g)
      );
      if (invalidGrants.length > 0) {
        return res.status(400).json({
          error: `Invalid grant types: ${invalidGrants.join(
            ', '
          )}. Allowed: ${VALID_GRANTS.join(', ')}`,
        });
      }

      // Validate redirect URIs against platform domain (Threat 2 mitigation)
      const domain = process.env.DOMAIN || 'domain.local';
      if (!validateRedirectUris(redirect_uris, domain)) {
        log(
          EPriority.Warning,
          'OAUTH_CLIENT',
          `Rejected client registration: redirect_uri not a subdomain of ${domain}`,
          { redirect_uris }
        );
        return res.status(400).json({
          error: `All redirect_uris must be subdomains of ${domain}`,
        });
      }

      // Server-generated credentials
      const clientId = randomUUID();
      const clientSecret = randomBytes(32).toString('hex');
      const clientSecretHash = await bcrypt.hash(clientSecret, BCRYPT_ROUNDS);

      const createdBy =
        req.headers['x-gateway-id']?.toString() || 'gateway:unknown';

      await pg.query(
        `INSERT INTO oauth_clients
         (client_id, client_secret, client_secret_hash, redirect_uris, grants,
          access_token_lifetime, refresh_token_lifetime, label, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          clientId,
          LEGACY_SECRET_PLACEHOLDER, // placeholder for legacy column (not used for new clients)
          clientSecretHash,
          JSON.stringify(redirect_uris),
          JSON.stringify(grants),
          access_token_lifetime || 300,
          refresh_token_lifetime || 3600,
          label || null,
          createdBy,
        ]
      );

      log(EPriority.Info, 'OAUTH_CLIENT', `Created OAuth client ${clientId}`, {
        label,
        created_by: createdBy,
        redirect_uris,
      });

      return res.status(201).json({
        client_id: clientId,
        client_secret: clientSecret, // returned ONCE, plaintext
        redirect_uris,
        grants,
      });
    })
  );

  /**
   * DELETE /internal/oauth/clients/:client_id
   * Delete an OAuth client and cascade tokens (Gateway-only)
   */
  router.delete(
    '/internal/oauth/clients/:client_id',
    ...middlewares,
    asyncHandler(async (req: Request, res) => {
      const { client_id } = req.params;

      await pg.query('DELETE FROM oauth_clients WHERE client_id = $1', [
        client_id,
      ]);

      log(EPriority.Info, 'OAUTH_CLIENT', `Deleted OAuth client ${client_id}`);

      return res.status(200).json({ deleted: true });
    })
  );
};
