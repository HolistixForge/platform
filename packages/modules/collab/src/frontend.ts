import { TModule } from '@holistix-forge/module';
import { TValidSharedData } from '@holistix-forge/collab-engine';
import { Collab } from './lib/collab';
import { YjsClientCollabConfig } from './lib/collab';
import { CollabRegistryFrontend } from './lib/collab-registry-frontend';

/**
 * Configuration for collab registry (multi-project support)
 * This is the new preferred configuration for frontend collab module
 */
export type CollabRegistryConfig = {
  type: 'registry';
  createConfigForProject: (project_id: string) => YjsClientCollabConfig;
};

/**
 * Module exports for multi-project architecture
 * Provides a getter function and registry access
 */
export type TCollabFrontendExports = {
  /**
   * Get collab instance for a specific project
   * Lazy loading: Creates connection on first access
   */
  getCollabForProject: (project_id: string) => {
    collab: Collab<TValidSharedData>;
    localOverrider: any; // LocalOverrider
  };
  
  /**
   * Registry for multi-project collab management
   * - At load time: call registry.registerSharedData() to register schema
   * - At runtime: call registry.getCollabForProject() to get collab instance
   */
  registry: CollabRegistryFrontend;
};

/**
 * Collab frontend module
 * 
 * Now supports multi-project architecture via registry pattern.
 * Each project gets its own YJS document and WebSocket connection,
 * created lazily when first accessed.
 * 
 * Configuration should be of type CollabRegistryConfig.
 */
export const moduleFrontend: TModule<undefined, TCollabFrontendExports> = {
  name: 'collab',
  version: '0.0.1',
  description: 'Collaborative module - multi-project architecture',
  dependencies: [],
  load: (args) => {
    const config = args.config as CollabRegistryConfig;
    
    if (config.type !== 'registry') {
      throw new Error(
        'Collab module frontend now requires CollabRegistryConfig. ' +
        'Use { type: "registry", createConfigForProject: (project_id) => config }'
      );
    }
    
    // Create registry (schema will be registered by other modules)
    const registry = new CollabRegistryFrontend(config.createConfigForProject);
    
    // Export registry and convenience getter
    args.moduleExports({
      getCollabForProject: (project_id: string) => 
        registry.getCollabForProject(project_id),
      registry,
    });
  },
};

//
// Re-export context provider and hooks
//

export {
  CollabProjectProvider,
  CollabProjectContext,
  useCollabProjectId,
} from './lib/collab-project-context';

export {
  useLocalSharedData,
  useLocalSharedDataManager,
  useAwareness,
  useAwarenessUserList,
  useAwarenessSelections,
  useBindEditor,
  useSharedDataDirect,
} from './lib/collab-hooks';

//
// Re-export types and classes
//

export type {
  TOverrideFunction,
  TValidSharedDataToCopy,
} from './lib/overrider';

export type { YjsClientCollabConfig } from './lib/collab';

// Export classes for advanced use cases
export { LocalOverrider } from './lib/overrider';
export { CollabRegistryFrontend } from './lib/collab-registry-frontend';
export { Collab, YjsClientCollab } from './lib/collab';
