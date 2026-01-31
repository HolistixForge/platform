import type { TModule } from '@holistix-forge/module';
import type { TCollabFrontendExports } from '@holistix-forge/collab/frontend';

type TFrontendRequired = {
  collab: TCollabFrontendExports;
};

export const moduleFrontend: TModule<TFrontendRequired> = {
  name: 'tabs',
  version: '0.0.1',
  description: 'Tabs module',
  dependencies: ['collab'],
  load: ({ depsExports }) => {
    // Register shared data schema with registry
    depsExports.collab.registry.registerSharedData('map', 'tabs', 'tabs');
  },
};

// Export React components for frontend use
export { TabsRadix } from './lib/components/tabs-radix';
export type { PanelProps } from './lib/components/tabs-radix';
