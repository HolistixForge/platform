import { TModule } from '@holistix-forge/module';
import { TValidSharedData } from '@holistix-forge/collab-engine';
import { Collab } from './lib/collab';
import { Reducer, RequestData } from '@holistix-forge/reducers';

//

export { Collab };

/**
 * Collab Registry Interface
 * Used in multi-project architecture to get per-project collab instances
 */
export interface ICollabRegistry {
  /**
   * Register shared data schema (called at module load time)
   */
  registerSharedData(
    sdtype: 'map' | 'array',
    moduleName: string,
    name: string
  ): void;
  /**
   * Get collab instance for a specific project (called at event processing time)
   */
  getCollabForProject(project_id: string): Collab<TValidSharedData>;
}

/**
 * Collab module config
 * The registry is created by app-gateway and passed to the collab module
 */
export type CollabConfig = {
  registry: ICollabRegistry;
};

/**
 * Base class for reducers that need project-specific collab
 *
 * All reducers that need access to shared collaborative data should extend this class.
 * The collab instance is project-specific and obtained from the CollabRegistry.
 *
 * @example
 * ```typescript
 * export class MyReducer extends ReducerWithCollab<MyEvents, MySharedData> {
 *   constructor(depsExports: { collab: TCollabBackendExports }) {
 *     super(depsExports.collab.registry, 'my-module');
 *   }
 *
 *   async reduce(event: MyEvents, requestData: RequestData) {
 *     const collab = this.getCollab(requestData);
 *     collab.sharedData['my-module:data'].set(...);
 *   }
 * }
 * ```
 */
export abstract class ReducerWithCollab<
  TEvents = { type: string },
  TSharedData extends TValidSharedData = TValidSharedData
> extends Reducer<TEvents> {
  protected collabRegistry: ICollabRegistry;
  protected moduleName: string;

  constructor(collabRegistry: ICollabRegistry, moduleName: string) {
    super();
    this.collabRegistry = collabRegistry;
    this.moduleName = moduleName;
  }

  /**
   * Get project-specific collab instance
   * @param requestData Must contain project_id
   * @returns Collab instance for the project with typed shared data
   * @throws Error if project_id is missing
   */
  protected getCollab(requestData: RequestData): Collab<TSharedData> {
    if (!requestData.project_id) {
      throw new Error(
        `project_id is required for ${this.moduleName} reducer events. ` +
          `Ensure the event includes project context.`
      );
    }
    return this.collabRegistry.getCollabForProject(
      requestData.project_id
    ) as Collab<TSharedData>;
  }
}

/**
 * Backend collab exports
 * For multi-project architecture
 */
export type TCollabBackendExports = {
  /**
   * Registry for multi-project collab management
   * - At load time: call registry.registerSharedData() to register schema
   * - At runtime: passed to ReducerWithCollab constructor
   */
  registry: ICollabRegistry;
};

export const moduleBackend: TModule<undefined, TCollabBackendExports> = {
  name: 'collab',
  version: '0.0.1',
  description: 'Collaborative module - multi-project architecture',
  dependencies: [],
  load: (args) => {
    const config = args.config as CollabConfig;

    args.moduleExports({
      registry: config.registry,
    });
  },
};

//

export type { TEventUserLeave } from './lib/collab-events';

export { LocalOverrider } from './lib/overrider';

// Export YjsServerCollab for CollabRegistry usage
export { YjsServerCollab } from './lib/collab';
