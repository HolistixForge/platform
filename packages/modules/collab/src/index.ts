import { TModule } from '@holistix-forge/module';
import { TValidSharedData } from '@holistix-forge/collab-engine';
import { Collab, NoneCollab, type NoneCollabConfig } from './lib/collab';
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
    return this.getCollabForProject(requestData.project_id);
  }

  /**
   * The same instance, for the paths that hold a project id rather than a
   * request.
   *
   * A reducer serving something other than an event — the placements a runner
   * polls for, say — has the project id already and no `RequestData` to put it
   * in. Without this it would reach for the registry directly and get
   * `Collab<TValidSharedData>`, whose shared data is a union with no `set`; the
   * one caller doing that cast the result to `unknown` and lost every type it
   * had.
   */
  protected getCollabForProject(project_id: string): Collab<TSharedData> {
    return this.collabRegistry.getCollabForProject(
      project_id
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

/**
 * A registry over a single local document, for stories and tests.
 *
 * The backend collab module does nothing but re-export `config.registry`, so a
 * caller that supplies no registry leaves every module loaded after it reading
 * `depsExports.collab.registry` as undefined — which is how six module `Main`
 * stories died, reporting "Cannot read properties of undefined (reading
 * 'registerSharedData')" from inside core-graph rather than from collab.
 *
 * `NoneCollab` already exists for running without a server. What was missing is
 * a registry shaped like `ICollabRegistry` to hand it back: the frontend
 * registry cannot stand in, because it returns `{ collab, localOverrider }`
 * where this interface returns the collab itself.
 *
 * One document is the right answer here rather than one per project — a story
 * has exactly one — so every project id resolves to the same instance, and
 * schema registered before it exists is applied when it is built.
 */
export const createLocalCollabRegistry = (
  config: NoneCollabConfig
): ICollabRegistry => {
  const schema: {
    sdtype: 'map' | 'array';
    moduleName: string;
    name: string;
  }[] = [];
  let collab: NoneCollab | undefined;

  return {
    registerSharedData: (sdtype, moduleName, name) => {
      schema.push({ sdtype, moduleName, name });
      // Modules register during load, which may be after the first read.
      // loadSharedData is overloaded per literal, so the union has to be split.
      if (!collab) return;
      if (sdtype === 'map') collab.loadSharedData('map', moduleName, name);
      else collab.loadSharedData('array', moduleName, name);
    },
    getCollabForProject: () => {
      if (!collab) {
        collab = new NoneCollab(config);
        for (const e of schema) {
          if (e.sdtype === 'map')
            collab.loadSharedData('map', e.moduleName, e.name);
          else collab.loadSharedData('array', e.moduleName, e.name);
        }
      }
      return collab as unknown as Collab<TValidSharedData>;
    },
  };
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
