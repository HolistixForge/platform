import { EPriority, log } from '@holistix-forge/log';
import {
  YjsClientCollab,
  type YjsClientCollabConfig,
  NoneCollab,
  type NoneCollabConfig,
} from './collab';
import { LocalOverrider } from './overrider';
import { TValidSharedData } from '@holistix-forge/collab-engine';

/**
 * What a registry factory may return: the WebSocket client the platform
 * uses, or the local no-socket document a story or a test wants.
 */
export type TRegistryCollabConfig = YjsClientCollabConfig | NoneCollabConfig;

/**
 * Schema entry for shared data
 */
export type TSchemaEntry = {
  sdtype: 'map' | 'array';
  moduleName: string;
  name: string;
};

/**
 * CollabRegistryFrontend - Multi-Project Collab Manager (Frontend)
 *
 * Manages multiple YJS client connections, one per project.
 * This mirrors the backend CollabRegistry pattern but for frontend WebSocket connections.
 *
 * Features:
 * - Lazy loading: Creates collab instance on first access for a project
 * - Caching: Keeps instances alive for visited projects
 * - On-demand connections: Only connects to projects that are actually accessed
 * - Schema application: Applies shared data schema to each project automatically
 *
 * Usage:
 * ```typescript
 * const registry = new CollabRegistryFrontend(configFactory, schema);
 * const { collab, localOverrider } = registry.getCollabForProject('project-123');
 * ```
 */
export class CollabRegistryFrontend {
  private collabs: Map<
    string,
    {
      collab: YjsClientCollab | NoneCollab;
      localOverrider: LocalOverrider<TValidSharedData>;
    }
  > = new Map();

  private configFactory: (project_id: string) => TRegistryCollabConfig;
  private schema: Map<string, TSchemaEntry>;

  /**
   * Create a new collab registry
   *
   * @param configFactory - Function that creates YJS config for a project
   * @param schema - Shared data schema to apply to all projects
   */
  constructor(
    configFactory: (project_id: string) => TRegistryCollabConfig,
    schema?: Map<string, TSchemaEntry>
  ) {
    this.configFactory = configFactory;
    this.schema = schema || new Map();
    log(EPriority.Info, 'COLLAB_REGISTRY_FRONTEND', 'Registry created');
  }

  /**
   * Register shared data schema entry
   * Called by modules during their load phase to declare their shared data needs
   *
   * @param sdtype - Type of shared data ('map' or 'array')
   * @param moduleName - Name of the module
   * @param name - Name of the shared data
   */
  registerSharedData(
    sdtype: 'map' | 'array',
    moduleName: string,
    name: string
  ): void {
    const key = `${moduleName}:${name}`;
    this.schema.set(key, { sdtype, moduleName, name });
    log(
      EPriority.Debug,
      'COLLAB_REGISTRY_FRONTEND',
      `Registered shared data: ${key} (${sdtype})`
    );
  }

  /**
   * Get collab instance for a specific project
   *
   * Lazy loading: Creates instance on first access and caches it.
   * Subsequent calls for same project return the cached instance.
   * Applies shared data schema automatically on creation.
   *
   * @param project_id - Project ID
   * @returns Collab instance and LocalOverrider for the project
   */
  getCollabForProject(project_id: string) {
    // Check cache first
    const existing = this.collabs.get(project_id);
    if (existing) {
      log(
        EPriority.Debug,
        'COLLAB_REGISTRY_FRONTEND',
        `Returning cached collab for project: ${project_id}`
      );
      return existing;
    }

    // Create new instance
    log(
      EPriority.Info,
      'COLLAB_REGISTRY_FRONTEND',
      `Creating new collab for project: ${project_id}`
    );

    const config = this.configFactory(project_id);

    // A registry that can only build a WebSocket client cannot serve a
    // Storybook, and that is how the module `Main` stories died: their config
    // was the pre-registry `{ type: 'none', … }`, the frontend module rejected
    // it outright, `collab` exported nothing, and every module loaded after it
    // read `depsExports.collab.registry` as undefined. Six stories reported
    // that as "Cannot read properties of undefined (reading
    // 'registerSharedData')", naming neither collab nor the config.
    //
    // `NoneCollab` already existed for exactly this — a local document with no
    // socket, simulated peers, no server to run. Introducing the registry
    // dropped the ability to reach it. Dispatching on the config's own `type`
    // gives it back without widening anything: the union is closed, and a
    // caller that wants the socket still gets the socket.
    const collab =
      config.type === 'none'
        ? new NoneCollab(config)
        : new YjsClientCollab(config);

    // Apply schema - create all shared data wrappers
    for (const [, entry] of this.schema) {
      if (entry.sdtype === 'map') {
        collab.loadSharedData('map', entry.moduleName, entry.name);
      } else {
        collab.loadSharedData('array', entry.moduleName, entry.name);
      }
    }

    const localOverrider = new LocalOverrider(collab.sharedData);

    // Cache it
    const instance = { collab, localOverrider };
    this.collabs.set(project_id, instance);

    return instance;
  }

  /**
   * Check if a project has an initialized collab
   *
   * @param project_id - Project ID
   * @returns true if project has been initialized
   */
  hasProject(project_id: string): boolean {
    return this.collabs.has(project_id);
  }

  /**
   * Get count of initialized projects
   *
   * @returns Number of projects with active collab instances
   */
  getProjectCount(): number {
    return this.collabs.size;
  }

  /**
   * Clear collab for a project
   *
   * This disconnects the WebSocket and cleans up resources.
   * Used when explicitly wanting to remove a project from cache.
   *
   * @param project_id - Project ID to clear
   */
  clearProject(project_id: string): void {
    const instance = this.collabs.get(project_id);
    if (instance) {
      // Only the socket-backed collab has a connection to tear down; NoneCollab
      // holds nothing but a local document and has no `destroy`. Testing for
      // the method rather than for the class is deliberate — the suite passes
      // mocks here, and an `instanceof` check silently skipped them, which two
      // existing tests caught immediately.
      const disposable = instance.collab as { destroy?: () => void };
      if (disposable.destroy) {
        disposable.destroy();
      }

      this.collabs.delete(project_id);
      log(
        EPriority.Info,
        'COLLAB_REGISTRY_FRONTEND',
        `Cleared collab for project: ${project_id}`
      );
    }
  }

  /**
   * Clear all projects
   *
   * Cleans up all collab instances and connections.
   * Useful for logout or testing.
   */
  clearAll(): void {
    const count = this.collabs.size;
    for (const project_id of this.collabs.keys()) {
      this.clearProject(project_id);
    }
    log(
      EPriority.Info,
      'COLLAB_REGISTRY_FRONTEND',
      `Cleared all collabs (${count} projects)`
    );
  }
}
