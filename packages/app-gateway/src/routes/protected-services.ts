import { Router, Request } from 'express';
import { asyncHandler } from '../middleware/route-handler';
import { authenticateJwt } from '../middleware/jwt-auth';
import { getGatewayInstances } from '../initialization/gateway-instances';
import { EPriority, log } from '@holistix-forge/log';
import type { ProtectedServiceRequestContext } from '@holistix-forge/gateway';

/**
 * Build a generic ProtectedServiceRequestContext from an Express request.
 */
function buildContext(req: Request): ProtectedServiceRequestContext {
  const authReq = req as any;
  const serviceId = req.params.serviceId;

  // Remaining path segments after /svc/:serviceId
  const basePrefix = `/svc/${serviceId}`;
  const remainingPath = req.path.startsWith(basePrefix)
    ? req.path.substring(basePrefix.length)
    : '';
  const pathSegments = remainingPath
    .split('/')
    .filter((seg) => seg.length > 0);

  // Normalize query to string | string[]
  const query: Record<string, string | string[]> = {};
  Object.entries(req.query).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      query[key] = value.map((v) => String(v));
    } else if (value !== undefined) {
      query[key] = String(value);
    }
  });

  const ctx: ProtectedServiceRequestContext = {
    serviceId,
    pathSegments,
    query,
    method: req.method,
    jwt: (authReq.jwt as any) || {},
    userId: authReq.user?.id,
  };

  return ctx;
}

/**
 * Setup routes for generic protected services.
 *
 * These routes do not proxy traffic themselves; instead, they:
 * - Authenticate the caller (JWT)
 * - Run module-defined permission checks
 * - Ask the module to resolve a ProtectedServiceResolution
 * - Return that resolution as JSON to the caller
 *
 * This gives modules a generic "protected service" mechanism without
 * coupling app-gateway to specific module concepts like user-containers.
 */
export const setupProtectedServicesRoutes = (router: Router) => {
  // ALL /svc/:serviceId - Resolve a protected service
  router.all(
    '/svc/:serviceId',
    authenticateJwt,
    asyncHandler(async (req: Request, res) => {
      const instances = getGatewayInstances();
      if (!instances) {
        return res.status(500).json({ error: 'Gateway not initialized' });
      }

      const { permissionManager, protectedServiceRegistry } = instances;
      const ctx = buildContext(req);

      const handler = protectedServiceRegistry.getService(ctx.serviceId);
      if (!handler) {
        return res.status(404).json({
          error: `Protected service not found: ${ctx.serviceId}`,
        });
      }

      // Permission check
      const allowed = await handler.checkPermission(ctx, { permissionManager });
      if (!allowed) {
        log(
          EPriority.Warning,
          'PROTECTED_SERVICE',
          `Permission denied for service ${ctx.serviceId}`,
          {
            serviceId: ctx.serviceId,
            userId: ctx.userId,
          }
        );
        return res
          .status(403)
          .json({ error: `Permission denied for service ${ctx.serviceId}` });
      }

      // Resolve target / metadata
      const resolution = await handler.resolve(ctx);
      if (!resolution) {
        return res.status(404).json({
          error: `Service ${ctx.serviceId} could not be resolved`,
        });
      }

      return res.json({
        serviceId: ctx.serviceId,
        resolution: resolution,
      });
    })
  );
}


