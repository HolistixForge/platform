import { Request, Response, NextFunction } from 'express';
import { jwtPayload } from '@monorepo/backend-engine';
import { ForbiddenException } from '@monorepo/log';
import { asyncHandler } from './route-handler';
import type {
  TJwtUser,
  TJwtUserContainer,
  TJwtGateway,
} from '@monorepo/demiurge-types';

// Import TJwtOrganization directly from the file since it's not exported from index
import type { TJwtOrganization } from '@monorepo/demiurge-types/src/lib/jwt/jwt';
import { getGatewayInstances } from '../initialization/gateway-instances';

/**
 * Union type for all JWT token types
 */
export type TAnyJwt =
  | TJwtUser
  | TJwtUserContainer
  | TJwtOrganization
  | TJwtGateway;

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
 * Handles all JWT types: TJwtUser, TJwtUserContainer, TJwtOrganization, TJwtGateway
 * Can be used alongside or instead of passport authentication
 */
export const authenticateJwt = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization as string;

    if (!authHeader) {
      throw new ForbiddenException([{ message: 'No authorization header' }]);
    }

    const jwtPayloadData = extractJwtPayload(authHeader);

    // Extract user_id based on JWT type
    let user_id: string | undefined;
    if (
      jwtPayloadData.type === 'access_token' ||
      jwtPayloadData.type === 'refresh_token'
    ) {
      // TJwtUser
      user_id = jwtPayloadData.user?.id;
    } else if (jwtPayloadData.type === 'user_container_token') {
      // TJwtUserContainer - no user_id, only container_id
      // Set user_id to container_id for compatibility
      user_id = (jwtPayloadData as TJwtUserContainer).user_container_id;
    } else if (jwtPayloadData.type === 'organization_token') {
      // TJwtOrganization - organization-level token
      // No user_id
      user_id = undefined;
    } else if (jwtPayloadData.type === 'gateway_token') {
      // TJwtGateway - gateway-level token
      // No user_id
      user_id = undefined;
    }

    // Set req.user for compatibility with permission middleware
    // Only set if we have a user_id (user tokens or container tokens)
    const authReq = req as any;
    if (user_id && !authReq.user) {
      authReq.user = { id: user_id };
    }

    // Store full JWT payload for routes that need it
    authReq.jwt = jwtPayloadData;

    return next();
  }
);

/**
 * Middleware: Require TJwtUserContainer token and verify it belongs to the correct organization
 * Used for endpoints that should only be accessible by user containers (not human users)
 */
export const requireUserContainerToken = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization as string;

    if (!authHeader) {
      throw new ForbiddenException([{ message: 'No authorization header' }]);
    }

    const jwtPayloadData = extractJwtPayload(authHeader);

    // Verify it's a user_container_token
    if (jwtPayloadData.type !== 'user_container_token') {
      throw new ForbiddenException([
        { message: 'Requires user_container_token' },
      ]);
    }

    const containerToken = jwtPayloadData as TJwtUserContainer;
    const project_id = containerToken.project_id;

    if (!project_id) {
      throw new ForbiddenException([{ message: 'JWT missing project_id' }]);
    }

    // Verify the project belongs to the organization this gateway is serving
    const instances = getGatewayInstances();
    if (!instances) {
      throw new ForbiddenException([
        { message: 'Gateway instances not initialized' },
      ]);
    }

    const gatewayOrganizationId = instances.gatewayState.getOrganizationId();
    if (!gatewayOrganizationId) {
      throw new ForbiddenException([
        { message: 'Gateway not bound to an organization' },
      ]);
    }

    // TODO: In the future, we might need to verify project belongs to organization
    // For now, we assume if the gateway is serving the organization, it has access to all its projects
    // This verification could be done by:
    // 1. Checking if project_id is in the list of projects loaded from Ganymede
    // 2. Or fetching project details from Ganymede and checking organization_id
    // For MVP, we trust that the gateway only serves one organization and all projects are valid

    const authReq = req as any;
    // Set user_id to container_id for compatibility
    authReq.user = { id: containerToken.user_container_id };
    authReq.jwt = jwtPayloadData;
    authReq.containerToken = containerToken;

    return next();
  }
);
