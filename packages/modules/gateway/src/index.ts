import type { TModule } from '@holistix-forge/module';
import { TMyfetchRequest } from '@holistix-forge/simple-types';
import type { TCollabFrontendExports } from '@holistix-forge/collab/frontend';

import { TokenManager, PermissionManager } from './lib/managers';

//

import { PermissionRegistry } from './lib/permission-registry';

/**
 * Environment a module cannot read for itself.
 *
 * Module packages are bundled through Vite with `vite-plugin-node-polyfills`,
 * which substitutes a **browser** `process` shim. Inside a module,
 * `process.env` is therefore an empty object at runtime in the gateway — it
 * reads as "not configured" rather than failing, which is the worst way for it
 * to be wrong. app-gateway's own code keeps the real `process`, so anything a
 * module needs from the environment has to arrive through here.
 */
export type TGatewayEnvironment = {
  /** Where user containers run when the platform runner is used. */
  containerBroker?: { endpoint: string; token: string };
  /** True in local development, where `.local` names need `--add-host`. */
  devMode: boolean;
  /** Address containers reach the Docker host at. */
  dockerHostIp: string;
};

export type TGatewayExports = {
  toGanymede: <T>(r: TMyfetchRequest) => Promise<T>;
  toGanymedeInternal: <T>(r: TMyfetchRequest) => Promise<T>;
  /**
   * Publish the services one project exposes.
   *
   * Takes a project id because the underlying config file is per **gateway**
   * while callers reason per **project**. Without it, a gateway serving two
   * projects has each one overwrite the other's routes — and a project with no
   * containers wipes every route on the gateway a few milliseconds after they
   * were written.
   */
  updateReverseProxy: (
    projectId: string,
    services: { host: string; ip: string; port: number }[]
  ) => Promise<void>;
  /**
   * Tell the VPN which hosting token belongs to which container.
   *
   * Read by `vpn-auth-verify.sh` when a container connects, so that the shared
   * client certificate proves membership of the organization and the token
   * proves which container. Inert until VPN_PER_CLIENT_IDENTITY is on, and
   * writing it is what makes turning that on possible at all — until now
   * nothing produced the file the script reads.
   */
  recordVpnCredentials: (
    entries: { user_container_id: string; token: string }[]
  ) => Promise<void>;
  gatewayFQDN: string;
  /**
   * What a project is called, or undefined when this gateway was not told.
   *
   * A container's services are published under the project they belong to, so
   * a module minting those names needs more than the id. Undefined is a real
   * answer and not an error: a Ganymede older than this one sends no names,
   * and a service named without its project is what services were called
   * before — so the absent case degrades to the previous behaviour.
   *
   * A lookup rather than a map, so nothing can hold a copy that stops being
   * true when a project is renamed.
   */
  projectName: (projectId: string) => string | undefined;
  organization_id: string;
  tokenManager: TokenManager;
  permissionManager: PermissionManager;
  permissionRegistry: PermissionRegistry;
  environment: TGatewayEnvironment;
};

//

export const moduleFrontend: TModule<
  { collab: TCollabFrontendExports },
  TGatewayExports
> = {
  name: 'gateway',
  version: '0.0.1',
  description: 'Gateway module',
  dependencies: ['collab'],
  load: ({ depsExports }) => {
    // Register shared data schema with registry
    depsExports.collab.registry.registerSharedData('map', 'gateway', 'gateway');
  },
};

//

export type { TGatewayEvents } from './lib/gateway-events';
export type { TGatewaySharedData, TGatewayMeta } from './lib/gateway-types';
export type {
  TProjectEvents,
  TEventProjectInit,
} from './lib/project-init-events';

// Export manager interfaces and types
export { TokenManager, PermissionManager } from './lib/managers';

// Export PermissionRegistry
export {
  PermissionRegistry,
  type PermissionDefinition,
} from './lib/permission-registry';

export type { TEventDisableProjectUnloading } from './lib/gateway-events';
