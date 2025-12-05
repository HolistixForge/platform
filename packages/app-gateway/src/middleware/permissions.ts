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
    // Also supports ${jwt.key} for JWT payload values
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
    permission = permission.replace(
      /\$\{jwt\.(\w+)\}/g,
      (_, key) => authReq.jwt?.[key] || ''
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

/**
 * Middleware: Require project access (member or admin, or org admin/owner)
 * Checks multiple permission formats: project:{project_id}:member, project:{project_id}:admin, org:admin, org:owner
 * Usage: requireProjectAccess() - expects req.jwt.project_id or req.body.project_id or req.params.project_id
 */
export const requireProjectAccess = (): any =>
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

    // Get project_id from JWT, body, or params (in that order of precedence)
    const project_id =
      authReq.jwt?.project_id ||
      authReq.body?.project_id ||
      authReq.params?.project_id;

    if (!project_id) {
      return res.status(400).json({ error: 'Project ID required' });
    }

    const user_id = authReq.user.id;

    // Check if user has project access (member, admin, or org-level)
    const hasProjectAccess =
      permissionManager.hasPermission(
        user_id,
        `project:${project_id}:member`
      ) ||
      permissionManager.hasPermission(user_id, `project:${project_id}:admin`) ||
      permissionManager.hasPermission(user_id, 'org:admin') ||
      permissionManager.hasPermission(user_id, 'org:owner');

    if (!hasProjectAccess) {
      return res.status(403).json({
        error: `No access to project: ${project_id}`,
      });
    }

    return next();
  });
