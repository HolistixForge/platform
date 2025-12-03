/**
 * Protected Service Registry
 *
 * Generic mechanism that allows modules to register "protected services"
 * behind the gateway. The gateway can then:
 *
 * - Authenticate the caller (JWT / TJwtUser)
 * - Run module-defined permission checks
 * - Let the module resolve a target or metadata describing how to reach it
 *
 * NOTE: This registry is intentionally generic and does NOT depend on
 * Express types or app-gateway internals, so that it can be shared
 * between the generic gateway module and the app-gateway implementation.
 */

import type { TJson, TJsonObject } from '@holistix/simple-types';
import type { PermissionManager } from './managers';

/**
 * Minimal request context passed to protected-service handlers.
 * This is adapted from the actual HTTP request in app-gateway.
 */
export type ProtectedServiceRequestContext = {
  /** Service identifier, usually taken from the URL (e.g. /svc/:serviceId) */
  serviceId: string;

  /**
   * Path segments after the serviceId, if any.
   * Example:
   *   /svc/user-containers/terminal/foo/bar
   *   → pathSegments = ['foo', 'bar']
   */
  pathSegments: string[];

  /** Query parameters (already normalized to string or string[]). */
  query: Record<string, string | string[]>;

  /** HTTP method (GET, POST, etc.) */
  method: string;

  /** Parsed JWT payload attached by gateway (TJwtUser, TJwtOrganization, etc.) */
  jwt: TJsonObject;

  /** Convenience: user id extracted from JWT when available */
  userId?: string;

  /** Optional arbitrary data that modules may attach / use */
  extras?: TJson;
};

/**
 * Result of a protected-service resolution.
 *
 * This is intentionally generic: for some services the gateway may
 * proxy traffic, for others it may simply return a URL or token.
 */
export type ProtectedServiceResolution = {
  /**
   * Arbitrary payload describing how to use the service.
   * For example:
   *   { internalUrl: "http://172.16.x.y:7681/", protocol: "http" }
   * or
   *   { wsUrl: "ws://172.16.x.y:7681/", ticket: "..." }
   */
  data: TJsonObject;
};

/**
 * Handler definition for a protected service.
 *
 * Modules register one handler per logical service (e.g. "user-container-terminal").
 */
export type ProtectedServiceHandler = {
  /** Unique identifier, e.g. "user-containers:terminal" */
  id: string;

  /**
   * Permission check callback.
   * Receives the request context and a PermissionManager facade.
   * Should return true if access is allowed.
   */
  checkPermission: (
    ctx: ProtectedServiceRequestContext,
    helpers: { permissionManager: PermissionManager }
  ) => boolean | Promise<boolean>;

  /**
   * Resolve the service for this request.
   * Returns null if the service cannot be resolved (e.g. container not found).
   */
  resolve: (
    ctx: ProtectedServiceRequestContext
  ) =>
    | ProtectedServiceResolution
    | Promise<ProtectedServiceResolution | null>
    | null;
};

/**
 * Registry storing protected-service handlers.
 *
 * app-gateway will consult this registry when handling /svc/* requests.
 */
export class ProtectedServiceRegistry {
  private services: Map<string, ProtectedServiceHandler> = new Map();

  /**
   * Register a new protected service.
   * Throws if the id is already registered.
   */
  registerService(handler: ProtectedServiceHandler): void {
    if (this.services.has(handler.id)) {
      throw new Error(
        `ProtectedServiceRegistry: service with id "${handler.id}" already registered`
      );
    }
    this.services.set(handler.id, handler);
  }

  /**
   * Get a service handler by id.
   */
  getService(id: string): ProtectedServiceHandler | undefined {
    return this.services.get(id);
  }

  /**
   * List all registered services.
   */
  listServices(): ProtectedServiceHandler[] {
    return Array.from(this.services.values());
  }
}
