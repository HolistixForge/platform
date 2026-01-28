import { TabsReducer } from './lib/tabs-reducer';
import type { TModule } from '@holistix-forge/module';
import type { TCollabBackendExports } from '@holistix-forge/collab';
import type { TReducersBackendExports } from '@holistix-forge/reducers';

type TBackendRequired = {
  collab: TCollabBackendExports;
  reducers: TReducersBackendExports;
};

export const moduleBackend: TModule<TBackendRequired> = {
  name: 'tabs',
  version: '0.0.1',
  description: 'Tabs module',
  dependencies: ['core-graph', 'collab', 'reducers'],
  load: ({ depsExports }) => {
    // Register shared data schema with registry
    depsExports.collab.registry.registerSharedData('map', 'tabs', 'tabs');
    depsExports.reducers.loadReducers(new TabsReducer(depsExports));
  },
};

export type { TTabEvents } from './lib/tabs-event';

export type { TTabsSharedData } from './lib/tabs-shared-model';
export { MAX_TAB_ROW } from './lib/tabs-types';
export type { TabPayload, TabPath } from './lib/tabs-types';

export { ReadOnlyTree } from './lib/tree';
export type { TreeElement } from './lib/tree';

export type { TTabsTree } from './lib/tabs-types';
