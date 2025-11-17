import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from './route-handler';
import { getGatewayInstances } from '../initialization/gateway-instances';

/**
 * Get PermissionManager instance from gateway instances
 */
function getPermissionManager() {
  const instances = getGatewayInstances();
  if (!instances) {
    return null;
  }
  return instances.permissionManager;
}

/**
 * Middleware: Require exact permission
 * Usage: requirePermission('container:create')
 */
export const requirePermission = (permission: string): any =>
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as any;
    const permissionManager = getPermissionManager();

    if (!permissionManager) {
      return res
        .status(500)
        .json({ error: 'PermissionManager not initialized' });
    }

    if (!authReq.user || !authReq.user.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!permissionManager.hasPermission(authReq.user.id, permission)) {
      return res
        .status(403)
        .json({ error: `Permission denied: ${permission}` });
    }

    return next();
  });

/**
 * Middleware: Require permission with template substitution
 * Usage: requirePermissionTemplate('container:${params.id}:delete')
 * Replaces ${params.id} with actual value from request
 */
export const requirePermissionTemplate = (template: string): any =>
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as any;
    const permissionManager = getPermissionManager();

    if (!permissionManager) {
      return res
        .status(500)
        .json({ error: 'PermissionManager not initialized' });
    }

    if (!authReq.user || !authReq.user.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Simple template replacement: ${params.id} → req.params.id
    let permission = template;
    permission = permission.replace(
      /\$\{params\.(\w+)\}/g,
      (_, key) => authReq.params[key] || ''
    );
    permission = permission.replace(
      /\$\{body\.(\w+)\}/g,
      (_, key) => authReq.body[key] || ''
    );
    permission = permission.replace(
      /\$\{query\.(\w+)\}/g,
      (_, key) => authReq.query[key] || ''
    );

    if (!permissionManager.hasPermission(authReq.user.id, permission)) {
      return res
        .status(403)
        .json({ error: `Permission denied: ${permission}` });
    }

    return next();
  });

/**
 * Middleware: Require organization membership (any role)
 */
export const requireOrgMember = (): any =>
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as any;
    const permissionManager = getPermissionManager();

    if (!permissionManager) {
      return res
        .status(500)
        .json({ error: 'PermissionManager not initialized' });
    }

    if (!authReq.user || !authReq.user.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const perms = permissionManager.getPermissions(authReq.user.id);
    const isOrgMember = perms.some((p: string) => p.startsWith('org:'));

    if (!isOrgMember) {
      return res.status(403).json({ error: 'Not an organization member' });
    }

    return next();
  });
