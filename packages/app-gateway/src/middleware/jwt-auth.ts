import { Request, Response, NextFunction } from 'express';
import { jwtPayload } from '@monorepo/backend-engine';
import { ForbiddenException } from '@monorepo/log';
import { asyncHandler } from './route-handler';
import type { TJwtUser, TJwtGateway } from '@monorepo/demiurge-types';
import { trace } from '@opentelemetry/api';

// Import TJwtOrganization directly from the file since it's not exported from index
import type { TJwtOrganization } from '@monorepo/demiurge-types/src/lib/jwt/jwt';
import { getGatewayInstances } from '../initialization/gateway-instances';

/**
 * Union type for all JWT token types
 */
export type TAnyJwt = TJwtUser | TJwtOrganization | TJwtGateway;

/**
 * Extract and verify JWT from token string
 * Shared function for both Express middleware and WebSocket authentication
 * @param token - JWT token string (with or without Bearer prefix)
 * @returns Decoded JWT payload
 * @throws Error if token is invalid
 */
export function extractJwtPayload(token: string): TAnyJwt {
  // Remove Bearer/token prefix if present
  let cleanToken = token;
  if (token.startsWith('Bearer ')) {
    cleanToken = token.substring(7);
  } else if (token.startsWith('token ')) {
    cleanToken = token.substring(6);
  }

  try {
    const payload = jwtPayload(cleanToken) as TAnyJwt;
    return payload;
  } catch (error: any) {
    throw new ForbiddenException([{ message: 'Invalid JWT token' }], error);
  }
}

/**
 * Check if user has project access
 * Shared function for both Express middleware and WebSocket authentication
 * @param user_id - User ID
 * @param project_id - Project ID
 * @returns True if user has access
 */
export function checkProjectAccess(
  user_id: string,
  project_id: string
): boolean {
  const instances = getGatewayInstances();
  if (!instances) {
    return false;
  }

  const permissionManager = instances.permissionManager;
  const hasProjectAccess =
    permissionManager.hasPermission(user_id, `project:${project_id}:member`) ||
    permissionManager.hasPermission(user_id, `project:${project_id}:admin`) ||
    permissionManager.hasPermission(user_id, 'org:admin') ||
    permissionManager.hasPermission(user_id, 'org:owner');

  return hasProjectAccess;
}

/**
 * JWT Authentication Middleware
 * Extracts JWT from Authorization header and sets req.user and req.jwt
 * Handles all JWT types: TJwtUser, TJwtOrganization, TJwtGateway
 * Can be used alongside or instead of passport authentication
 *
 * Sets req.user only if JWT contains a user.id (for TJwtUser tokens).
 * Other middleware can use req.jwt to access full JWT payload.
 */
export const authenticateJwt = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization as string;

    if (!authHeader) {
      throw new ForbiddenException([{ message: 'No authorization header' }]);
    }

    const jwtPayloadData = extractJwtPayload(authHeader);

    // Extract user_id only for user tokens (TJwtUser)
    let user_id: string | undefined;
    if (
      jwtPayloadData.type === 'access_token' ||
      jwtPayloadData.type === 'refresh_token'
    ) {
      // TJwtUser has user.id
      user_id = jwtPayloadData.user?.id;
    }
    // Other token types (TJwtOrganization, TJwtGateway) don't have user_id

    // Set req.user for compatibility with permission middleware
    // Only set if we have a user_id (for user tokens)
    const authReq = req as any;
    if (user_id && !authReq.user) {
      authReq.user = { id: user_id };
    }

    // Store full JWT payload for routes that need it
    authReq.jwt = jwtPayloadData;

    // Enrich span with JWT context
    const span = trace.getActiveSpan();
    if (span) {
      if (user_id) {
        span.setAttribute('user.id', user_id);
      }
      if ((jwtPayloadData as any).organization_id) {
        span.setAttribute(
          'organization.id',
          (jwtPayloadData as TJwtOrganization).organization_id
        );
      }
      if ((jwtPayloadData as any).gateway_id) {
        span.setAttribute(
          'gateway.id',
          (jwtPayloadData as TJwtGateway).gateway_id
        );
      }
    }

    return next();
  }
);

/**
 * Normalize JWT scope property to array
 * Handles both string and array formats
 */
function normalizeScope(scope: string | string[] | undefined): string[] {
  if (!scope) {
    return [];
  }
  if (Array.isArray(scope)) {
    return scope;
  }
  // String scope - split by space
  return scope.split(' ').filter((s) => s.length > 0);
}

/**
 * Middleware: Require specific scope(s) in JWT
 * Generic scope-based authorization that works with any JWT type
 *
 * Supports template substitution:
 * - {org_id} - Replaced with gateway's organization ID
 * - ${params.key} - Replaced with req.params[key]
 * - ${body.key} - Replaced with req.body[key]
 * - ${query.key} - Replaced with req.query[key]
 * - ${jwt.key} - Replaced with req.jwt[key]
 *
 * @param requiredScope - Required scope string or array of scopes (with optional templates)
 * @returns Express middleware function
 *
 * Usage:
 *   requireScope('connect-vpn')
 *   requireScope('org:{org_id}:connect-vpn')  // Organization-specific scope
 *   requireScope(['connect-vpn', 'read-projects'])
 *   requireScope('project:${jwt.project_id}:access')  // Project-specific scope from JWT
 *
 * The JWT must have a scope property (string or string[]).
 * For string scopes, they are split by space.
 */
export const requireScope = (requiredScope: string | string[]): any => {
  const requiredScopesTemplate = Array.isArray(requiredScope)
    ? requiredScope
    : [requiredScope];

  return asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const authReq = req as any;

      // JWT must be authenticated first
      if (!authReq.jwt) {
        throw new ForbiddenException([
          { message: 'JWT authentication required' },
        ]);
      }

      // Resolve template variables in required scopes
      const instances = getGatewayInstances();
      const organizationId = instances?.gatewayState.getOrganizationId() || '';

      const requiredScopes = requiredScopesTemplate.map((scopeTemplate) => {
        let scope = scopeTemplate;

        // Replace {org_id} with gateway's organization ID
        scope = scope.replace(/{org_id}/g, organizationId);

        // Replace ${params.key} with req.params[key]
        scope = scope.replace(
          /\$\{params\.(\w+)\}/g,
          (_, key) => authReq.params[key] || ''
        );

        // Replace ${body.key} with req.body[key]
        scope = scope.replace(
          /\$\{body\.(\w+)\}/g,
          (_, key) => authReq.body[key] || ''
        );

        // Replace ${query.key} with req.query[key]
        scope = scope.replace(
          /\$\{query\.(\w+)\}/g,
          (_, key) => authReq.query[key] || ''
        );

        // Replace ${jwt.key} with req.jwt[key]
        scope = scope.replace(
          /\$\{jwt\.(\w+)\}/g,
          (_, key) => authReq.jwt?.[key] || ''
        );

        return scope;
      });

      const jwtPayloadData = authReq.jwt;

      // Check if JWT has scope property
      if (!('scope' in jwtPayloadData)) {
        throw new ForbiddenException([
          { message: 'JWT token missing scope property' },
        ]);
      }

      // Normalize token scopes to array
      const tokenScopes = normalizeScope(
        jwtPayloadData.scope as string | string[]
      );

      // Check if all required scopes are present
      const hasAllScopes = requiredScopes.every((scope) =>
        tokenScopes.includes(scope)
      );

      if (!hasAllScopes) {
        throw new ForbiddenException([
          {
            message: `Missing required scope(s): ${requiredScopes.join(', ')}`,
          },
        ]);
      }

      return next();
    }
  );
};
